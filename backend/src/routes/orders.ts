import express from 'express';
import { pool } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendOrderCreatedEmail } from '../services/emailService';
import { createSignatureObject } from '../services/signatureService';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// ============================================
// GET ALL ORDERS
// ============================================
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(`
            SELECT o.*, c.customer_name 
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            ORDER BY o.created_at DESC
        `);
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// ============================================
// CHECK IF ORDER NUMBER EXISTS (FOR INFO ONLY)
// ============================================
router.get('/check/:orderNumber', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orderNumber } = req.params;
        
        const result = await pool.query(
            `SELECT o.order_number, o.order_review_number, o.created_at, 
                    o.quantity, o.status, c.customer_name 
             FROM orders o 
             LEFT JOIN customers c ON o.customer_id = c.id 
             WHERE o.order_number = $1
             ORDER BY o.created_at DESC`,
            [orderNumber]
        );
        
        if (result.rows.length > 0) {
            const order = result.rows[0];
            const prevDate = new Date(order.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            res.json({
                exists: true,
                count: result.rows.length,
                order: {
                    order_number: order.order_number,
                    review_number: order.order_review_number,
                    created_on: prevDate,
                    customer: order.customer_name || 'Unknown',
                    quantity: order.quantity || 0,
                    status: order.status || 'Unknown'
                },
                message: `Order "${orderNumber}" has been used ${result.rows.length} time(s), last used on ${prevDate}`
            });
        } else {
            res.json({ 
                exists: false,
                message: `Order "${orderNumber}" has never been used before`
            });
        }
    } catch (error) {
        console.error('Error checking order number:', error);
        res.status(500).json({ error: 'Failed to check order number' });
    }
});

// ============================================
// ⭐ CREATE NEW ORDER - RESTRICTED TO MARKETING ONLY
// ============================================
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        console.log('📦 Creating new order...');
        console.log('User ID:', req.user?.id);
        console.log('User Name:', req.user?.name);
        console.log('User Department:', req.user?.department);
        console.log('User Role:', req.user?.role);

        if (!req.user) {
            console.log('❌ No user found in request');
            await client.query('ROLLBACK');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        // ⭐ RESTRICT ORDER CREATION TO MARKETING ONLY
        if (req.user.department !== 'Marketing' && req.user.role !== 'Administrator') {
            await client.query('ROLLBACK');
            console.log('❌ Unauthorized: Only Marketing can create orders');
            return res.status(403).json({ 
                error: 'Access Denied',
                message: 'Only Marketing department can create orders. Please contact Marketing department.',
                user_department: req.user.department
            });
        }

        const {
            orderNumber,
            customerName,
            customerContact,
            customerPhone,
            customerEmail,
            salesperson,
            quantity,
            boardSize,
            materialCombination,
            expectedDeliveryDate,
            previousOrderNumber,
            reelSize,
            remarks,
            materials,
            // ⭐ SPECIFICATION FIELDS
            requiredMachines,
            requiredMaterials,
            requiredManpower,
            estimatedProcessingDays,
            specialRequirements,
            qualityStandards,
            technicalSpecifications,
            // ⭐ FINANCE REVIEW FIELDS
            financePaymentTerms,
            financeCustomerCredit,
            financeBudgetAllocation,
            financeRiskLevel,
            financeProfitability,
            financeClearanceStatus,
            financeReviewComments,
            // ⭐ QUALITY REVIEW FIELDS
            qualitySpecCompliance,
            qualityRequirements,
            qualityPrintingRequirements,
            qualityRiskLevel,
            qualityTestingRequirements,
            qualityCertifications,
            qualityReviewComments,
            // ⭐ NEW COLOR FIELDS
            numberOfColors,
            colorTypes,
            colorOptions,
            colorSpecifications
        } = req.body;

        console.log('📝 Received data:');
        console.log('  orderNumber:', orderNumber);
        console.log('  customerName:', customerName);
        console.log('  quantity:', quantity);
        console.log('  requiredMachines:', requiredMachines);
        console.log('  requiredMaterials:', requiredMaterials);
        console.log('  requiredManpower:', requiredManpower);
        console.log('  financePaymentTerms:', financePaymentTerms);
        console.log('  financeCustomerCredit:', financeCustomerCredit);
        console.log('  financeRiskLevel:', financeRiskLevel);
        console.log('  qualitySpecCompliance:', qualitySpecCompliance);
        console.log('  qualityRequirements:', qualityRequirements);
        console.log('  numberOfColors:', numberOfColors);
        console.log('  colorTypes:', colorTypes);
        console.log('  colorOptions:', colorOptions);

        if (!orderNumber || !customerName || !quantity || !expectedDeliveryDate) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check for duplicate order number (warning only)
        const existingOrder = await client.query(
            `SELECT o.order_number, o.order_review_number, o.created_at, c.customer_name 
             FROM orders o 
             LEFT JOIN customers c ON o.customer_id = c.id 
             WHERE o.order_number = $1`,
            [orderNumber]
        );

        let duplicateWarning = null;
        if (existingOrder.rows.length > 0) {
            const prev = existingOrder.rows[0];
            const prevDate = new Date(prev.created_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            duplicateWarning = {
                exists: true,
                count: existingOrder.rows.length,
                previous_order: {
                    order_number: prev.order_number,
                    review_number: prev.order_review_number,
                    created_on: prevDate,
                    customer: prev.customer_name || 'Unknown'
                }
            };
            console.log('⚠️ Duplicate order number detected (WARNING ONLY):', orderNumber);
        }

        const quantityNum = parseInt(quantity) || 0;

        // Handle customer
        let customerResult = await client.query(
            'SELECT id FROM customers WHERE customer_name = $1',
            [customerName]
        );

        let customerId;
        let customerData;
        if (customerResult.rows.length > 0) {
            customerId = customerResult.rows[0].id;
            const fullCustomer = await client.query(
                'SELECT * FROM customers WHERE id = $1',
                [customerId]
            );
            customerData = fullCustomer.rows[0];
            console.log('✅ Existing customer ID:', customerId);
        } else {
            const newCustomer = await client.query(
                `INSERT INTO customers (customer_name, contact_person, phone, email) 
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [customerName, customerContact || null, customerPhone || null, customerEmail || null]
            );
            customerId = newCustomer.rows[0].id;
            const fullCustomer = await client.query(
                'SELECT * FROM customers WHERE id = $1',
                [customerId]
            );
            customerData = fullCustomer.rows[0];
            console.log('✅ New customer created with ID:', customerId);
        }

        // Generate order review number
        const year = new Date().getFullYear();
        const reviewResult = await client.query(
            `SELECT COUNT(*) as count FROM orders WHERE order_review_number LIKE $1`,
            [`OR-${year}-%`]
        );
        const count = parseInt(reviewResult.rows[0].count) || 0;
        const nextNum = String(count + 1).padStart(5, '0');
        const orderReviewNumber = `OR-${year}-${nextNum}`;
        console.log('✅ Generated order review number:', orderReviewNumber);

        const userId = req.user.id;

        // ⭐ INSERT ORDER WITH ALL FIELDS (SPECIFICATION + FINANCE + QUALITY + COLOR)
        const orderResult = await client.query(
            `INSERT INTO orders (
                order_number, order_review_number, customer_id, previous_order_number,
                quantity, board_size, material_combination, reel_size,
                expected_delivery_date, customer_contact, customer_phone,
                customer_email, salesperson, remarks, created_by,
                required_machines, required_materials, required_manpower,
                estimated_processing_days, special_requirements,
                quality_standards, technical_specifications, order_status,
                -- FINANCE FIELDS
                finance_payment_terms, finance_customer_credit, finance_budget_allocation,
                finance_risk_level, finance_profitability, finance_clearance_status,
                finance_review_comments, finance_review_status,
                -- QUALITY FIELDS
                quality_spec_compliance, quality_requirements, quality_printing_requirements,
                quality_risk_level, quality_testing_requirements, quality_certifications,
                quality_review_comments, quality_review_status,
                -- ⭐ NEW COLOR FIELDS
                number_of_colors, color_types, color_options, color_specifications
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                      $16, $17, $18, $19, $20, $21, $22, 'pending_department_review',
                      $23, $24, $25, $26, $27, $28, $29, 'pending',
                      $30, $31, $32, $33, $34, $35, $36, 'pending',
                      $37, $38, $39, $40)
            RETURNING id`,
            [
                String(orderNumber),
                String(orderReviewNumber),
                customerId,
                previousOrderNumber ? String(previousOrderNumber) : null,
                quantityNum,
                boardSize || null,
                materialCombination || null,
                reelSize ? String(reelSize) : null,
                expectedDeliveryDate,
                customerContact || null,
                customerPhone || null,
                customerEmail || null,
                salesperson || null,
                remarks || null,
                userId,
                requiredMachines || null,
                requiredMaterials || null,
                requiredManpower || null,
                estimatedProcessingDays || null,
                specialRequirements || null,
                qualityStandards || null,
                technicalSpecifications || null,
                // FINANCE VALUES
                financePaymentTerms || null,
                financeCustomerCredit || null,
                financeBudgetAllocation || null,
                financeRiskLevel || null,
                financeProfitability || null,
                financeClearanceStatus || null,
                financeReviewComments || null,
                // QUALITY VALUES
                qualitySpecCompliance || null,
                qualityRequirements || null,
                qualityPrintingRequirements || null,
                qualityRiskLevel || null,
                qualityTestingRequirements || null,
                qualityCertifications || null,
                qualityReviewComments || null,
                // ⭐ NEW COLOR VALUES
                numberOfColors ? parseInt(numberOfColors) : null,
                colorTypes || null,
                colorOptions || null,
                colorSpecifications || null
            ]
        );

        const orderId = orderResult.rows[0].id;
        console.log('✅ Order created with ID:', orderId);

        const fullOrder = await client.query(
            `SELECT o.*, c.customer_name, c.contact_person, c.phone, c.email as customer_email
             FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             WHERE o.id = $1`,
            [orderId]
        );
        const orderData = fullOrder.rows[0];

        // Add materials
        if (materials && Array.isArray(materials) && materials.length > 0) {
            console.log('📝 Adding', materials.length, 'materials...');
            for (const material of materials) {
                if (material.materialType && material.requiredQty > 0) {
                    let materialResult = await client.query(
                        'SELECT id FROM materials WHERE material_type = $1 AND gsm = $2',
                        [material.materialType, material.gsm]
                    );
                    
                    let materialId;
                    if (materialResult.rows.length === 0) {
                        const newMaterial = await client.query(
                            `INSERT INTO materials (material_type, gsm, stock_balance) 
                             VALUES ($1, $2, 0) RETURNING id`,
                            [material.materialType, material.gsm]
                        );
                        materialId = newMaterial.rows[0].id;
                        console.log('  ✅ Created new material:', material.materialType, material.gsm);
                    } else {
                        materialId = materialResult.rows[0].id;
                        console.log('  ✅ Using existing material:', material.materialType, material.gsm);
                    }

                    await client.query(
                        `INSERT INTO order_materials (order_id, material_id, required_quantity, remarks)
                         VALUES ($1, $2, $3, $4)`,
                        [orderId, materialId, material.requiredQty, material.remarks || '']
                    );
                }
            }
        }

        // ⭐ CREATE DEPARTMENT REVIEWS WITH REQUIREMENTS
        const departments = [
            { 
                name: 'Material Management', 
                required_data: requiredMaterials || 'Material requirements to be specified'
            },
            { 
                name: 'Finance', 
                required_data: financeReviewComments || 'Financial review required' 
            },
            { 
                name: 'PDQM', 
                required_data: qualityStandards || 'Quality standards to be specified' 
            },
            { 
                name: 'Technical', 
                required_data: technicalSpecifications || 'Technical specifications to be specified' 
            },
            { 
                name: 'Production', 
                required_data: requiredMachines || 'Production requirements to be specified' 
            }
        ];

        for (const dept of departments) {
            await client.query(
                `INSERT INTO department_reviews (
                    order_id, 
                    department, 
                    status, 
                    reviewer_id,
                    required_info,
                    review_required
                ) VALUES ($1, $2, 'pending', $3, $4, true)`,
                [orderId, dept.name, userId, dept.required_data]
            );
        }
        console.log('✅ Department reviews created with requirements');

        // ⭐ SEND NOTIFICATIONS TO ALL DEPARTMENTS
        const allUsers = await client.query(
            `SELECT id, email, name FROM users WHERE department IN ($1, $2, $3, $4, $5) AND status = 'active'`,
            ['Material Management', 'Finance', 'PDQM', 'Technical', 'Production']
        );

        for (const user of allUsers.rows) {
            await client.query(
                `INSERT INTO notifications (
                    user_id, 
                    order_id, 
                    title, 
                    message, 
                    type,
                    link
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    user.id,
                    orderId,
                    '📦 New Order Requires Your Review',
                    `Order ${orderNumber} from ${customerName} has been created by ${req.user.name}. Please review the specifications and provide your department's input.`,
                    'review_required',
                    `/orders/${orderId}/review`
                ]
            );
        }
        console.log('✅ Notifications sent to all departments');

        // Audit log
        await client.query(
            `INSERT INTO audit_logs (
                user_id, 
                action, 
                table_name, 
                record_id, 
                new_value,
                timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                userId,
                'CREATE_ORDER',
                'orders',
                orderId,
                JSON.stringify({ order_number: orderNumber, customer: customerName }),
                new Date()
            ]
        );

        await client.query('COMMIT');
        console.log('✅ Order created successfully!');

        // Try to send email notification
        try {
            await sendOrderCreatedEmail(orderData, customerData, req.user);
            console.log('📧 Email notification sent');
        } catch (emailError) {
            console.error('❌ Email error (order still created):', emailError);
        }
        
        res.status(201).json({ 
            id: orderId, 
            orderReviewNumber,
            message: 'Order created successfully and sent to all departments for review',
            warning: duplicateWarning,
            departments_notified: ['Material Management', 'Finance', 'PDQM', 'Technical', 'Production']
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error creating order:', error);
        console.error('❌ Error details:', error.detail || 'No detail');
        res.status(500).json({ error: 'Failed to create order', details: error.message });
    } finally {
        client.release();
    }
});

// ============================================
// ⭐ GET DEPARTMENT REVIEW REQUIREMENTS
// ============================================
router.get('/:orderId/department-requirements', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;
        
        // Get order details
        const orderResult = await pool.query(
            `SELECT o.order_number, o.order_review_number, c.customer_name,
                    o.required_machines, o.required_materials, o.required_manpower,
                    o.estimated_processing_days, o.special_requirements,
                    o.quality_standards, o.technical_specifications,
                    -- FINANCE FIELDS
                    o.finance_payment_terms, o.finance_customer_credit,
                    o.finance_budget_allocation, o.finance_risk_level,
                    o.finance_profitability, o.finance_clearance_status,
                    o.finance_review_comments,
                    -- QUALITY FIELDS
                    o.quality_spec_compliance, o.quality_requirements,
                    o.quality_printing_requirements, o.quality_risk_level,
                    o.quality_testing_requirements, o.quality_certifications,
                    o.quality_review_comments,
                    -- ⭐ NEW COLOR FIELDS
                    o.number_of_colors,
                    o.color_types,
                    o.color_options,
                    o.color_specifications
             FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             WHERE o.id = $1`,
            [orderId]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orderResult.rows[0];
        
        // Get department reviews with requirements
        const deptResult = await pool.query(
            `SELECT department, status, required_info, department_input, 
                    input_provided_at, reviewer_id
             FROM department_reviews
             WHERE order_id = $1
             ORDER BY department`,
            [orderId]
        );
        
        res.json({
            order_number: order.order_number,
            order_review_number: order.order_review_number,
            customer_name: order.customer_name,
            specifications: {
                required_machines: order.required_machines,
                required_materials: order.required_materials,
                required_manpower: order.required_manpower,
                estimated_processing_days: order.estimated_processing_days,
                special_requirements: order.special_requirements,
                quality_standards: order.quality_standards,
                technical_specifications: order.technical_specifications
            },
            finance_review: {
                payment_terms: order.finance_payment_terms,
                customer_credit: order.finance_customer_credit,
                budget_allocation: order.finance_budget_allocation,
                risk_level: order.finance_risk_level,
                profitability: order.finance_profitability,
                clearance_status: order.finance_clearance_status,
                comments: order.finance_review_comments
            },
            quality_review: {
                spec_compliance: order.quality_spec_compliance,
                requirements: order.quality_requirements,
                printing_requirements: order.quality_printing_requirements,
                risk_level: order.quality_risk_level,
                testing_requirements: order.quality_testing_requirements,
                certifications: order.quality_certifications,
                comments: order.quality_review_comments
            },
            color_requirements: {
                number_of_colors: order.number_of_colors,
                color_types: order.color_types,
                color_options: order.color_options,
                color_specifications: order.color_specifications
            },
            departments: deptResult.rows
        });
        
    } catch (error) {
        console.error('Error fetching department requirements:', error);
        res.status(500).json({ error: 'Failed to fetch requirements' });
    }
});

// ============================================
// FINAL APPROVAL WITH SIGNATURE
// ============================================
router.post('/:orderId/final-approve', authMiddleware, async (req: AuthRequest, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { orderId } = req.params;
        const { comments, action } = req.body;
        const user = req.user;

        console.log('📝 Final Approval Request:');
        console.log('  Order ID:', orderId);
        console.log('  User:', user?.name, '(' + user?.department + ')');
        console.log('  Action:', action || 'approved');
        console.log('  Comments:', comments || 'None');

        if (!user) {
            await client.query('ROLLBACK');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (user.department !== 'Management' && user.role !== 'Administrator') {
            await client.query('ROLLBACK');
            return res.status(403).json({ 
                error: 'Only Management can perform final approval',
                user_department: user.department,
                required: 'Management'
            });
        }

        const orderCheck = await client.query(
            `SELECT o.*, c.customer_name 
             FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             WHERE o.id = $1`,
            [orderId]
        );
        
        if (orderCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderCheck.rows[0];

        const deptReviews = await client.query(
            `SELECT department, status, reviewer_id, reviewed_at 
             FROM department_reviews 
             WHERE order_id = $1`,
            [orderId]
        );

        const pending = deptReviews.rows.filter(r => r.status === 'pending');
        const rejected = deptReviews.rows.filter(r => r.status === 'rejected');
        const approved = deptReviews.rows.filter(r => r.status === 'approved');

        if (rejected.length > 0 && action !== 'rejected') {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Cannot approve - some departments have rejected this order',
                rejected_departments: rejected.map(r => r.department)
            });
        }

        if (pending.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Cannot approve - some departments have not reviewed',
                pending_departments: pending.map(r => r.department),
                pending_count: pending.length
            });
        }

        let finalStatus;
        if (action === 'approved' || !action) {
            if (approved.length === 5) {
                finalStatus = 'approved';
            } else {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Cannot approve - not all departments have approved',
                    approved_count: approved.length,
                    required: 5
                });
            }
        } else if (action === 'rejected') {
            finalStatus = 'rejected';
        } else {
            finalStatus = action;
        }

        const signatureData = `${order.order_number}-${user.id}-${Date.now()}-${finalStatus}`;
        const signatureHash = crypto
            .createHash('sha256')
            .update(signatureData)
            .digest('hex');

        const signatureBlock = `
╔═══════════════════════════════════════════════════════════════╗
║                    FINAL APPROVAL SIGNATURE                    ║
╠═══════════════════════════════════════════════════════════════╣
║ Order:        ${order.order_number.padEnd(40)}║
║ Review:       ${order.order_review_number.padEnd(40)}║
║ Status:       ${finalStatus.toUpperCase().padEnd(40)}║
║ Approved By:  ${user.name.padEnd(40)}║
║ Department:   ${user.department.padEnd(40)}║
║ Date:         ${new Date().toLocaleString().padEnd(40)}║
║ Comments:     ${(comments || 'None').padEnd(40)}║
║ Signature:    ${signatureHash.substring(0, 16)}...${signatureHash.substring(48)} ║
╚═══════════════════════════════════════════════════════════════╝`;

        await client.query(
            `UPDATE orders 
             SET status = $1, 
                 final_signature = $2, 
                 final_signed_at = $3,
                 final_approved_by = $4,
                 final_comments = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [finalStatus, signatureHash, new Date(), user.id, comments || null, orderId]
        );

        await client.query(
            `INSERT INTO signatures (
                order_id, 
                user_id, 
                department, 
                action, 
                signature_hash, 
                comments,
                signed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                orderId, 
                user.id, 
                'Management', 
                'final_approved', 
                signatureHash, 
                comments || 'Final approval by Management',
                new Date()
            ]
        );

        await client.query(
            `INSERT INTO audit_logs (
                user_id, 
                action, 
                table_name, 
                record_id, 
                old_value, 
                new_value,
                timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                user.id,
                'FINAL_APPROVE',
                'orders',
                orderId,
                JSON.stringify({ status: order.status }),
                JSON.stringify({ status: finalStatus, approved_by: user.name }),
                new Date()
            ]
        );

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Order ${finalStatus} successfully`,
            status: finalStatus,
            signature: signatureBlock,
            order: {
                id: order.id,
                order_number: order.order_number,
                order_review_number: order.order_review_number,
                status: finalStatus
            }
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error in final approval:', error);
        res.status(500).json({ error: 'Failed to approve order', details: error.message });
    } finally {
        client.release();
    }
});

// ============================================
// GET SIGNATURES FOR AN ORDER
// ============================================
router.get('/:orderId/signatures', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;

        const deptSignatures = await pool.query(`
            SELECT 
                dr.department,
                dr.status as action,
                dr.comments,
                dr.signature,
                dr.signed_at,
                u.name as signed_by,
                u.department as user_department
            FROM department_reviews dr
            LEFT JOIN users u ON dr.reviewer_id = u.id
            WHERE dr.order_id = $1 
            AND dr.signature IS NOT NULL
            ORDER BY dr.signed_at DESC
        `, [orderId]);

        const sigSignatures = await pool.query(`
            SELECT 
                s.department,
                s.action,
                s.comments,
                s.signature_hash as signature,
                s.signed_at,
                u.name as signed_by,
                u.department as user_department
            FROM signatures s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.order_id = $1
            ORDER BY s.signed_at DESC
        `, [orderId]);

        const finalSignature = await pool.query(`
            SELECT 
                'Management' as department,
                o.status as action,
                o.final_comments as comments,
                o.final_signature as signature,
                o.final_signed_at as signed_at,
                u.name as signed_by,
                u.department as user_department
            FROM orders o
            LEFT JOIN users u ON o.final_approved_by = u.id
            WHERE o.id = $1 
            AND o.final_signature IS NOT NULL
        `, [orderId]);

        const signatures = [...deptSignatures.rows, ...sigSignatures.rows, ...finalSignature.rows];

        res.json({ 
            signatures: signatures,
            count: signatures.length 
        });
    } catch (error) {
        console.error('Error fetching signatures:', error);
        res.status(500).json({ error: 'Failed to fetch signatures' });
    }
});

// ============================================
// ⭐ GET ORDER WITH REVIEW STATUS (INCLUDES ALL FIELDS + COLOR)
// ============================================
router.get('/:orderId/status', async (req: AuthRequest, res) => {
    try {
        // Check for token in query parameter first
        let token = req.query.token as string;
        
        // If not in query, check headers
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        
        if (!token) {
            console.log('❌ No token found in status request');
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: number };
        } catch (jwtError) {
            console.log('❌ Invalid token:', jwtError);
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Check if user exists
        const userResult = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND status = $2',
            [decoded.userId, 'active']
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found');
            return res.status(401).json({ error: 'User not found' });
        }

        const { orderId } = req.params;

        // ⭐ Get order details INCLUDING ALL fields
        const orderResult = await pool.query(`
            SELECT 
                o.*, 
                c.customer_name,
                -- SPECIFICATION FIELDS
                o.required_machines,
                o.required_materials,
                o.required_manpower,
                o.estimated_processing_days,
                o.special_requirements,
                o.quality_standards,
                o.technical_specifications,
                -- FINANCE FIELDS
                o.finance_payment_terms,
                o.finance_customer_credit,
                o.finance_budget_allocation,
                o.finance_risk_level,
                o.finance_profitability,
                o.finance_clearance_status,
                o.finance_review_comments,
                o.finance_review_status,
                -- QUALITY FIELDS
                o.quality_spec_compliance,
                o.quality_requirements,
                o.quality_printing_requirements,
                o.quality_risk_level,
                o.quality_testing_requirements,
                o.quality_certifications,
                o.quality_review_comments,
                o.quality_review_status,
                -- ⭐ NEW COLOR FIELDS
                o.number_of_colors,
                o.color_types,
                o.color_options,
                o.color_specifications
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.id = $1
        `, [orderId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        // Get department reviews
        const reviewsResult = await pool.query(`
            SELECT 
                dr.department,
                dr.status,
                dr.reviewed_at,
                dr.required_info,
                dr.department_input,
                u.name as reviewer_name
            FROM department_reviews dr
            LEFT JOIN users u ON dr.reviewer_id = u.id
            WHERE dr.order_id = $1
            ORDER BY 
                CASE 
                    WHEN dr.status = 'pending' THEN 1
                    WHEN dr.status = 'approved' THEN 2
                    WHEN dr.status = 'rejected' THEN 3
                    WHEN dr.status = 'returned' THEN 4
                    ELSE 5
                END
        `, [orderId]);

        // Find which department(s) are pending
        const pendingDepartments = reviewsResult.rows
            .filter(r => r.status === 'pending')
            .map(r => r.department);

        const approvedDepartments = reviewsResult.rows
            .filter(r => r.status === 'approved')
            .map(r => r.department);

        const rejectedDepartments = reviewsResult.rows
            .filter(r => r.status === 'rejected')
            .map(r => r.department);

        let waitingMessage;
        if (pendingDepartments.length > 0) {
            waitingMessage = `⏳ Waiting for: ${pendingDepartments.join(', ')}`;
        } else if (order.status === 'approved') {
            waitingMessage = '✅ Order fully approved!';
        } else if (order.status === 'rejected') {
            waitingMessage = '❌ Order rejected';
        } else if (order.status === 'pending_final_approval') {
            waitingMessage = '⏳ Pending final approval from Management';
        } else {
            waitingMessage = '⏳ Processing...';
        }

        res.json({
            order: {
                id: order.id,
                order_number: order.order_number,
                order_review_number: order.order_review_number,
                customer_name: order.customer_name,
                quantity: order.quantity,
                status: order.status,
                expected_delivery_date: order.expected_delivery_date,
                created_at: order.created_at,
                // SPECIFICATION FIELDS
                required_machines: order.required_machines,
                required_materials: order.required_materials,
                required_manpower: order.required_manpower,
                estimated_processing_days: order.estimated_processing_days,
                special_requirements: order.special_requirements,
                quality_standards: order.quality_standards,
                technical_specifications: order.technical_specifications,
                // FINANCE FIELDS
                finance_payment_terms: order.finance_payment_terms,
                finance_customer_credit: order.finance_customer_credit,
                finance_budget_allocation: order.finance_budget_allocation,
                finance_risk_level: order.finance_risk_level,
                finance_profitability: order.finance_profitability,
                finance_clearance_status: order.finance_clearance_status,
                finance_review_comments: order.finance_review_comments,
                finance_review_status: order.finance_review_status,
                // QUALITY FIELDS
                quality_spec_compliance: order.quality_spec_compliance,
                quality_requirements: order.quality_requirements,
                quality_printing_requirements: order.quality_printing_requirements,
                quality_risk_level: order.quality_risk_level,
                quality_testing_requirements: order.quality_testing_requirements,
                quality_certifications: order.quality_certifications,
                quality_review_comments: order.quality_review_comments,
                quality_review_status: order.quality_review_status,
                // ⭐ NEW COLOR FIELDS
                number_of_colors: order.number_of_colors,
                color_types: order.color_types,
                color_options: order.color_options,
                color_specifications: order.color_specifications
            },
            reviews: reviewsResult.rows,
            summary: {
                total: reviewsResult.rows.length,
                pending: pendingDepartments.length,
                approved: approvedDepartments.length,
                rejected: rejectedDepartments.length,
                pending_departments: pendingDepartments,
                approved_departments: approvedDepartments,
                rejected_departments: rejectedDepartments,
                waiting_for: waitingMessage
            }
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Failed to fetch order status' });
    }
});

// ============================================
// GET SINGLE ORDER BY ID
// ============================================
router.get('/:orderId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;

        const result = await pool.query(`
            SELECT o.*, c.customer_name, c.contact_person, c.phone, c.email as customer_email
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.id = $1
        `, [orderId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

export default router;