import express from 'express';
import { pool } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createSignatureObject } from '../services/signatureService';
import crypto from 'crypto';

const router = express.Router();

// ============================================
// GET PENDING REVIEWS
// ============================================
router.get('/pending', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const userDept = req.user?.department;
        
        let query = `
            SELECT 
                o.id as order_id,
                o.order_number, 
                o.order_review_number, 
                o.customer_id, 
                o.quantity, 
                o.expected_delivery_date,
                o.required_machines,
                o.required_materials,
                o.required_manpower,
                o.estimated_processing_days,
                o.quality_standards,
                o.technical_specifications,
                c.customer_name,
                dr.id as review_id, 
                dr.department, 
                dr.status,
                dr.required_info,
                dr.review_required
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            JOIN department_reviews dr ON o.id = dr.order_id
            WHERE dr.status = 'pending'
        `;
        
        const params: any[] = [];
        
        if (req.user?.role !== 'Administrator') {
            query += ` AND dr.department = $1`;
            params.push(userDept);
        }
        
        query += ` ORDER BY o.created_at DESC`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pending reviews:', error);
        res.status(500).json({ error: 'Failed to fetch pending reviews' });
    }
});

// ============================================
// ⭐ GET REVIEW DETAILS WITH REQUIREMENTS
// ============================================
router.get('/:reviewId/details', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { reviewId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                dr.id as review_id,
                dr.order_id,
                dr.department,
                dr.status,
                dr.required_info,
                dr.review_required,
                dr.department_input,
                o.order_number,
                o.order_review_number,
                o.customer_id,
                o.quantity,
                o.expected_delivery_date,
                o.required_machines,
                o.required_materials,
                o.required_manpower,
                o.estimated_processing_days,
                o.special_requirements,
                o.quality_standards,
                o.technical_specifications,
                c.customer_name
            FROM department_reviews dr
            JOIN orders o ON dr.order_id = o.id
            JOIN customers c ON o.customer_id = c.id
            WHERE dr.id = $1
        `, [reviewId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching review details:', error);
        res.status(500).json({ error: 'Failed to fetch review details' });
    }
});

// ============================================
// ⭐ SUBMIT REVIEW WITH SIGNATURE (FIXED)
// ============================================
router.post('/:reviewId/:department', authMiddleware, async (req: AuthRequest, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { reviewId, department } = req.params;
        const { status, comments, rejectionReason, correctionReason, departmentInput } = req.body;
        const user = req.user;
        
        console.log('📝 Review Submission:');
        console.log('  Review ID:', reviewId);
        console.log('  Department:', department);
        console.log('  User Department:', user?.department);
        console.log('  User Role:', user?.role);
        console.log('  Status:', status);
        console.log('  Department Input:', departmentInput || 'None');
        
        // Check authorization
        if (!user) {
            await client.query('ROLLBACK');
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        if (user.role !== 'Administrator' && user.department !== department) {
            console.log('❌ Authorization failed!');
            await client.query('ROLLBACK');
            return res.status(403).json({ 
                error: 'Not authorized for this department',
                user_department: user.department,
                required_department: department
            });
        }
        
        // Get the review to find the order_id
        const reviewCheck = await client.query(
            `SELECT id, order_id, status, department FROM department_reviews 
             WHERE id = $1 AND department = $2`,
            [reviewId, department]
        );
        
        if (reviewCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Review not found or department mismatch' });
        }
        
        const review = reviewCheck.rows[0];
        const orderId = review.order_id;
        
        // Don't allow re-reviewing completed reviews
        if (review.status !== 'pending') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'This review has already been completed' });
        }
        
        // Get order details
        const orderCheck = await client.query(
            'SELECT id, order_review_number, status, order_number FROM orders WHERE id = $1',
            [orderId]
        );
        
        if (orderCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const order = orderCheck.rows[0];

        // ============================================
        // GENERATE SHA-256 ELECTRONIC SIGNATURE
        // ============================================
        const signatureData = `${order.order_number}-${user.id}-${Date.now()}-${status}`;
        const signatureHash = crypto
            .createHash('sha256')
            .update(signatureData)
            .digest('hex');

        // Format signature block
        const signatureBlock = `
╔═══════════════════════════════════════════════════════════════╗
║                    DEPARTMENT REVIEW SIGNATURE                 ║
╠═══════════════════════════════════════════════════════════════╣
║ Order:        ${order.order_number.padEnd(40)}║
║ Department:   ${department.padEnd(40)}║
║ Status:       ${status.toUpperCase().padEnd(40)}║
║ Reviewed By:  ${user.name.padEnd(40)}║
║ Date:         ${new Date().toLocaleString().padEnd(40)}║
║ Comments:     ${(comments || 'None').padEnd(40)}║
║ Signature:    ${signatureHash.substring(0, 16)}...${signatureHash.substring(48)} ║
╚═══════════════════════════════════════════════════════════════╝`;

        console.log('📝 Signature Block:');
        console.log(signatureBlock);

        // ============================================
        // ⭐ UPDATE REVIEW WITH SIGNATURE (FIXED COLUMN NAMES)
        // ============================================
        await client.query(
            `UPDATE department_reviews 
             SET status = $1, 
                 comments = $2, 
                 rejection_reason = $3, 
                 correction_reason = $4,
                 signature = $5,
                 reviewer_id = $6,
                 department_input = $7,
                 reviewed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [
                status, 
                comments || null, 
                rejectionReason || null, 
                correctionReason || null,
                signatureHash,
                user.id,
                departmentInput || null,
                reviewId
            ]
        );

        // ============================================
        // ⭐ RECORD IN SIGNATURES TABLE
        // ============================================
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
                department,
                status,
                signatureHash,
                comments || `Review by ${department}`,
                new Date()
            ]
        );

        // ============================================
        // ⭐ AUDIT LOG
        // ============================================
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
                'DEPARTMENT_REVIEW',
                'department_reviews',
                reviewId,
                JSON.stringify({ status: 'pending', department: department }),
                JSON.stringify({ status: status, department: department, reviewer: user.name }),
                new Date()
            ]
        );

        // ============================================
        // ⭐ UPDATE ORDER STATUS
        // ============================================
        let newOrderStatus = order.status;
        
        if (status === 'rejected') {
            newOrderStatus = 'rejected';
        } else if (status === 'returned') {
            newOrderStatus = 'returned';
        } else if (status === 'approved') {
            // Check if all departments have reviewed
            const allReviews = await client.query(
                `SELECT status FROM department_reviews 
                 WHERE order_id = $1`,
                [orderId]
            );
            
            const pendingCount = allReviews.rows.filter(r => r.status === 'pending').length;
            const rejectedCount = allReviews.rows.filter(r => r.status === 'rejected').length;
            
            // If all departments have reviewed
            if (pendingCount === 0) {
                if (rejectedCount > 0) {
                    // If any rejected, mark order as rejected
                    newOrderStatus = 'rejected';
                    console.log('❌ Order rejected due to department rejection');
                } else {
                    // All approved - pending final approval
                    newOrderStatus = 'pending_final_approval';
                    console.log('✅ All departments approved - pending final approval');

                    // ⭐ Notify Management
                    const managementUsers = await client.query(
                        `SELECT id, email, name FROM users WHERE department = 'Management' AND status = 'active'`
                    );

                    const orderDetails = await client.query(
                        `SELECT order_number, customer_id FROM orders WHERE id = $1`,
                        [orderId]
                    );
                    
                    const customerDetails = await client.query(
                        `SELECT customer_name FROM customers WHERE id = $1`,
                        [orderDetails.rows[0].customer_id]
                    );

                    for (const mgr of managementUsers.rows) {
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
                                mgr.id,
                                orderId,
                                '✅ All Departments Approved - Final Approval Required',
                                `All departments have approved order ${orderDetails.rows[0].order_number} for ${customerDetails.rows[0].customer_name}. Please give final approval.`,
                                'final_approval_required',
                                `/orders/${orderId}/final-approve`
                            ]
                        );
                    }
                    console.log('📧 Management notified for final approval');
                }
            } else {
                newOrderStatus = 'in_review';
            }
        }
        
        // Update order status
        await client.query(
            'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newOrderStatus, orderId]
        );
        
        await client.query('COMMIT');
        
        // ============================================
        // ⭐ RETURN SUCCESS WITH SIGNATURE
        // ============================================
        res.json({
            success: true,
            message: `Review submitted successfully`,
            orderStatus: newOrderStatus,
            signature: signatureBlock,
            signature_hash: signatureHash
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error submitting review:', error);
        console.error('❌ Error details:', error.detail || 'No detail');
        res.status(500).json({ 
            error: 'Failed to submit review', 
            details: error.message 
        });
    } finally {
        client.release();
    }
});

// ============================================
// ⭐ GET REVIEW HISTORY FOR AN ORDER
// ============================================
router.get('/history/:orderId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                dr.id,
                dr.department,
                dr.status,
                dr.comments,
                dr.signature,
                dr.reviewed_at,
                dr.department_input,
                u.name as reviewer_name,
                u.department as reviewer_department
            FROM department_reviews dr
            LEFT JOIN users u ON dr.reviewer_id = u.id
            WHERE dr.order_id = $1
            ORDER BY dr.reviewed_at DESC
        `, [orderId]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching review history:', error);
        res.status(500).json({ error: 'Failed to fetch review history' });
    }
});

// ============================================
// ⭐ GET DEPARTMENT REVIEW STATUS FOR AN ORDER
// ============================================
router.get('/status/:orderId', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                department,
                status,
                required_info,
                department_input,
                reviewed_at,
                u.name as reviewer_name
            FROM department_reviews dr
            LEFT JOIN users u ON dr.reviewer_id = u.id
            WHERE dr.order_id = $1
            ORDER BY 
                CASE 
                    WHEN status = 'pending' THEN 1
                    WHEN status = 'approved' THEN 2
                    WHEN status = 'rejected' THEN 3
                    WHEN status = 'returned' THEN 4
                    ELSE 5
                END
        `, [orderId]);
        
        // Calculate summary
        const total = result.rows.length;
        const pending = result.rows.filter(r => r.status === 'pending').length;
        const approved = result.rows.filter(r => r.status === 'approved').length;
        const rejected = result.rows.filter(r => r.status === 'rejected').length;
        const returned = result.rows.filter(r => r.status === 'returned').length;
        
        res.json({
            reviews: result.rows,
            summary: {
                total,
                pending,
                approved,
                rejected,
                returned,
                all_reviewed: pending === 0,
                all_approved: approved === total && total > 0,
                has_rejections: rejected > 0,
                has_returns: returned > 0
            }
        });
    } catch (error) {
        console.error('Error fetching review status:', error);
        res.status(500).json({ error: 'Failed to fetch review status' });
    }
});

export default router;