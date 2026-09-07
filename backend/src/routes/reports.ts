import express from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ============================================
// GENERATE PDF REPORT FOR AN ORDER
// ============================================
router.get('/order/:orderId/pdf', async (req: AuthRequest, res) => {
    try {
        // Get token from query parameter
        const token = req.query.token as string;
        
        console.log('========================================');
        console.log('📄 PDF GENERATION REQUEST');
        console.log('📝 Order ID (from URL):', req.params.orderId);
        console.log('📝 Full URL:', req.originalUrl);
        console.log('📝 Query params:', req.query);
        console.log('📝 Token from query:', token ? token.substring(0, 30) + '...' : 'NO TOKEN');
        console.log('========================================');
        
        if (!token) {
            console.log('❌ No token found in query');
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log('✅ Token found in query');

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: number };
        } catch (jwtError) {
            console.log('❌ Invalid token:', jwtError);
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        console.log('✅ Decoded token:', decoded);

        // Check if user exists
        const userResult = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND status = $2',
            [decoded.userId, 'active']
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found');
            return res.status(401).json({ error: 'User not found' });
        }

        console.log('✅ User authenticated');

        const { orderId } = req.params;

        // FIRST: Check if order exists with a simple query
        console.log('🔍 Checking if order exists...');
        const checkOrder = await pool.query(
            'SELECT id, order_number, order_review_number FROM orders WHERE id = $1',
            [orderId]
        );
        
        console.log('📊 Order check result:', checkOrder.rows.length > 0 ? 'Found' : 'Not Found');
        if (checkOrder.rows.length > 0) {
            console.log('  Order ID:', checkOrder.rows[0].id);
            console.log('  Order Number:', checkOrder.rows[0].order_number);
            console.log('  Review Number:', checkOrder.rows[0].order_review_number);
        }

        if (checkOrder.rows.length === 0) {
            console.log('❌ Order not found with ID:', orderId);
            // Try to find if there are any orders at all
            const allOrders = await pool.query('SELECT id, order_number FROM orders LIMIT 5');
            console.log('📋 Available orders:', allOrders.rows);
            return res.status(404).json({ 
                error: 'Order not found',
                message: `Order with ID ${orderId} does not exist`,
                availableOrders: allOrders.rows.map(o => ({ id: o.id, order_number: o.order_number }))
            });
        }

        // Fetch full order details
        const orderResult = await pool.query(`
            SELECT o.*, c.customer_name, c.contact_person, c.phone, c.email as customer_email,
                   u.name as created_by_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users u ON o.created_by = u.id
            WHERE o.id = $1
        `, [orderId]);

        const order = orderResult.rows[0];
        console.log('✅ Order found:', order.order_review_number);

        // Fetch department reviews
        const reviewsResult = await pool.query(`
            SELECT dr.*, u.name as reviewer_name
            FROM department_reviews dr
            LEFT JOIN users u ON dr.reviewer_id = u.id
            WHERE dr.order_id = $1
            ORDER BY dr.created_at
        `, [orderId]);

        // Fetch materials
        const materialsResult = await pool.query(`
            SELECT om.*, m.material_type, m.gsm, m.unit
            FROM order_materials om
            JOIN materials m ON om.material_id = m.id
            WHERE om.order_id = $1
        `, [orderId]);

        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=order-${order.order_review_number}.pdf`);
        doc.pipe(res);

        // ========== HEADER ==========
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a365d')
           .text('Unlimited Packaging Plc.', { align: 'center' });
        doc.fontSize(12).font('Helvetica').fillColor('#4a5568')
           .text('Customer Order Review', { align: 'center' });
        doc.fontSize(10).fillColor('#718096')
           .text(`Document: OF/MSD/024 | Issue: 01 | Date: June 2022`, { align: 'center' });
        doc.moveDown(2);

        // ========== ORDER INFORMATION ==========
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1a365d')
           .text('ORDER INFORMATION', { underline: true });
        doc.moveDown(0.5);

        const orderInfo = [
            ['Order Number:', order.order_number || '-'],
            ['Review Number:', order.order_review_number || '-'],
            ['Customer:', order.customer_name || '-'],
            ['Contact Person:', order.contact_person || '-'],
            ['Phone:', order.phone || '-'],
            ['Email:', order.customer_email || '-'],
            ['Salesperson:', order.salesperson || '-'],
            ['Quantity:', order.quantity ? String(order.quantity) : '-'],
            ['Board Size:', order.board_size || '-'],
            ['Material Combination:', order.material_combination || '-'],
            ['Expected Delivery:', order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : '-'],
            ['Status:', order.status || 'Draft'],
            ['Created By:', order.created_by_name || '-'],
            ['Created At:', order.created_at ? new Date(order.created_at).toLocaleString() : '-']
        ];

        doc.fontSize(10).font('Helvetica');
        orderInfo.forEach(([label, value]) => {
            doc.text(`${label} ${value}`, { continued: false });
        });
        doc.moveDown(1);

        // ========== MATERIALS ==========
        if (materialsResult.rows.length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
               .text('MATERIALS', { underline: true });
            doc.moveDown(0.5);

            doc.fontSize(9).font('Helvetica-Bold');
            const tableTop = doc.y;
            let y = tableTop;

            const col1 = 50, col2 = 150, col3 = 250, col4 = 350, col5 = 450;
            doc.text('Type', col1, y);
            doc.text('GSM', col2, y);
            doc.text('Required', col3, y);
            doc.text('Available', col4, y);
            doc.text('Status', col5, y);

            doc.moveDown(0.3);
            doc.font('Helvetica');
            y = doc.y;

            materialsResult.rows.forEach((mat) => {
                doc.text(mat.material_type || '-', col1, y);
                doc.text(mat.gsm ? String(mat.gsm) : '-', col2, y);
                doc.text(mat.required_quantity ? String(mat.required_quantity) : '-', col3, y);
                doc.text(mat.available_quantity ? String(mat.available_quantity) : '-', col4, y);
                doc.text(mat.status || 'Pending', col5, y);
                y += 20;
            });
            doc.moveDown(1);
        }

        // ========== DEPARTMENT REVIEWS ==========
        if (reviewsResult.rows.length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d')
               .text('DEPARTMENT REVIEWS', { underline: true });
            doc.moveDown(0.5);

            doc.fontSize(9).font('Helvetica-Bold');
            const tableTop2 = doc.y;
            let y2 = tableTop2;

            const col1_2 = 50, col2_2 = 200, col3_2 = 300, col4_2 = 400;
            doc.text('Department', col1_2, y2);
            doc.text('Status', col2_2, y2);
            doc.text('Reviewer', col3_2, y2);
            doc.text('Date', col4_2, y2);

            doc.moveDown(0.3);
            doc.font('Helvetica');
            y2 = doc.y;

            reviewsResult.rows.forEach((review) => {
                doc.text(review.department || '-', col1_2, y2);
                doc.text(review.status || 'Pending', col2_2, y2);
                doc.text(review.reviewer_name || '-', col3_2, y2);
                doc.text(review.reviewed_at ? new Date(review.reviewed_at).toLocaleDateString() : '-', col4_2, y2);
                y2 += 20;
            });
            doc.moveDown(1);
        }

        // ========== FOOTER ==========
        doc.fontSize(8).fillColor('#a0aec0')
           .text('Generated on: ' + new Date().toLocaleString(), 50, doc.page.height - 50, { align: 'center' });
        doc.text('Unlimited Packaging Plc. - Order Review System', 50, doc.page.height - 35, { align: 'center' });

        doc.end();
        console.log('✅ PDF generated successfully for order:', order.order_review_number);
        console.log('========================================');

    } catch (error) {
        console.error('❌ PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// ============================================
// EXPORT ALL ORDERS TO EXCEL
// ============================================
router.get('/orders/excel', async (req: AuthRequest, res) => {
    try {
        // Get token from query parameter
        const token = req.query.token as string;
        
        console.log('========================================');
        console.log('📊 EXCEL EXPORT REQUEST');
        console.log('📝 Full URL:', req.originalUrl);
        console.log('📝 Query params:', req.query);
        console.log('📝 Token from query:', token ? token.substring(0, 30) + '...' : 'NO TOKEN');
        console.log('========================================');
        
        if (!token) {
            console.log('❌ No token found in query for Excel');
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log('✅ Token found in query for Excel');

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: number };
        } catch (jwtError) {
            console.log('❌ Invalid token:', jwtError);
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        console.log('✅ Decoded token for Excel:', decoded);

        // Check if user exists
        const userResult = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND status = $2',
            [decoded.userId, 'active']
        );

        if (userResult.rows.length === 0) {
            console.log('❌ User not found for Excel');
            return res.status(401).json({ error: 'User not found' });
        }

        console.log('✅ User authenticated for Excel');

        // Fetch all orders with details
        const result = await pool.query(`
            SELECT 
                o.order_number,
                o.order_review_number,
                c.customer_name,
                o.quantity,
                o.board_size,
                o.material_combination,
                o.expected_delivery_date,
                o.status,
                o.created_at,
                u.name as created_by
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            LEFT JOIN users u ON o.created_by = u.id
            ORDER BY o.created_at DESC
        `);

        console.log('📊 Found', result.rows.length, 'orders to export');

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orders');

        // ========== HEADER ROW ==========
        const headers = [
            'Order Number',
            'Review Number',
            'Customer',
            'Quantity',
            'Board Size',
            'Material Combination',
            'Expected Delivery',
            'Status',
            'Created By',
            'Created At'
        ];

        // Style header row
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a365d' } };
        headerRow.alignment = { horizontal: 'center' };

        // ========== DATA ROWS ==========
        result.rows.forEach((order) => {
            worksheet.addRow([
                order.order_number || '-',
                order.order_review_number || '-',
                order.customer_name || '-',
                order.quantity || 0,
                order.board_size || '-',
                order.material_combination || '-',
                order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : '-',
                order.status || 'Draft',
                order.created_by || '-',
                order.created_at ? new Date(order.created_at).toLocaleString() : '-'
            ]);
        });

        // ========== AUTO WIDTH ==========
        worksheet.columns.forEach((col) => {
            col.width = 20;
        });

        // ========== RESPONSE ==========
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=orders-export.xlsx');

        await workbook.xlsx.write(res);
        res.end();
        console.log('📊 Excel exported successfully!');
        console.log('========================================');

    } catch (error) {
        console.error('❌ Excel Export Error:', error);
        res.status(500).json({ error: 'Failed to export Excel' });
    }
});

export default router;