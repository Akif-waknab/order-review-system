import express from 'express';
import { pool } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

// ============================================
// ⭐ BASIC STATS WITH ORDERS LIST (FIXED)
// ============================================
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        // Get all orders with customer names
        const ordersResult = await pool.query(`
            SELECT 
                o.*, 
                c.customer_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            ORDER BY o.created_at DESC
        `);
        
        const allOrders = ordersResult.rows;
        console.log(`📋 Found ${allOrders.length} orders`);

        // Calculate stats from the orders
        const totalOrders = allOrders.length;
        const pendingReviews = allOrders.filter((o: any) => o.status === 'in_review' || o.status === 'pending_final_approval').length;
        const approvedOrders = allOrders.filter((o: any) => o.status === 'approved').length;
        const rejectedOrders = allOrders.filter((o: any) => o.status === 'rejected').length;
        const draftOrders = allOrders.filter((o: any) => o.status === 'draft').length;

        res.json({
            totalOrders,
            pendingReviews,
            approvedOrders,
            rejectedOrders,
            draftOrders,
            orders: allOrders // Send all orders for filtering
        });
    } catch (error) {
        console.error('❌ Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
});

// ============================================
// ⭐ ADVANCED DASHBOARD STATS
// ============================================
router.get('/advanced', authMiddleware, async (req: AuthRequest, res) => {
    try {
        console.log('📊 Fetching advanced dashboard stats...');

        // Status counts
        const statusResult = await pool.query(`
            SELECT 
                COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
                COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review,
                COUNT(CASE WHEN status = 'pending_final_approval' THEN 1 END) as pending_final,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
            FROM orders
        `);

        // Monthly data (last 6 months)
        const monthlyResult = await pool.query(`
            SELECT 
                TO_CHAR(created_at, 'Mon') as month,
                EXTRACT(MONTH FROM created_at) as month_num,
                COUNT(*) as count
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(MONTH FROM created_at)
            ORDER BY EXTRACT(MONTH FROM created_at)
        `);

        // Get all month names for the last 6 months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonth = new Date().getMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
            const monthIndex = (currentMonth - i + 12) % 12;
            last6Months.push(monthNames[monthIndex]);
        }

        const monthlyData = last6Months.map(m => {
            const found = monthlyResult.rows.find((r: any) => r.month === m);
            return found ? parseInt(found.count) : 0;
        });

        // Total revenue (quantity * 10 as estimate)
        const revenueResult = await pool.query(`
            SELECT COALESCE(SUM(quantity * 10), 0) as total_revenue FROM orders
        `);

        // Average processing time (in days)
        const timeResult = await pool.query(`
            SELECT AVG(EXTRACT(DAY FROM (updated_at - created_at))) as avg_days
            FROM orders
            WHERE status IN ('approved', 'rejected')
            AND updated_at IS NOT NULL
        `);

        // Department review status
        const deptResult = await pool.query(`
            SELECT 
                department,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
            FROM department_reviews
            GROUP BY department
            ORDER BY department
        `);

        // Department reviews with order counts
        const deptWithOrders = await pool.query(`
            SELECT 
                dr.department,
                COUNT(DISTINCT dr.order_id) as total_orders,
                COUNT(CASE WHEN dr.status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN dr.status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN dr.status = 'rejected' THEN 1 END) as rejected
            FROM department_reviews dr
            GROUP BY dr.department
            ORDER BY dr.department
        `);

        // Get recent orders for quick view (last 5)
        const recentOrders = await pool.query(`
            SELECT 
                o.id,
                o.order_number,
                o.order_review_number,
                o.status,
                o.quantity,
                o.expected_delivery_date,
                o.created_at,
                c.customer_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            ORDER BY o.created_at DESC
            LIMIT 5
        `);

        console.log('✅ Advanced stats fetched successfully');

        res.json({
            // Status counts
            draft: parseInt(statusResult.rows[0].draft) || 0,
            in_review: parseInt(statusResult.rows[0].in_review) || 0,
            pending_final: parseInt(statusResult.rows[0].pending_final) || 0,
            approved: parseInt(statusResult.rows[0].approved) || 0,
            rejected: parseInt(statusResult.rows[0].rejected) || 0,
            // Monthly data
            months: last6Months,
            monthlyData: monthlyData,
            // KPIs
            totalRevenue: parseFloat(revenueResult.rows[0].total_revenue) || 0,
            avgProcessingTime: Math.round(parseFloat(timeResult.rows[0].avg_days) || 0),
            // Department stats
            departmentStats: deptWithOrders.rows.length > 0 ? deptWithOrders.rows : deptResult.rows,
            // Recent orders
            recentOrders: recentOrders.rows
        });
    } catch (error) {
        console.error('❌ Error fetching advanced stats:', error);
        res.status(500).json({ error: 'Failed to fetch advanced stats', details: error.message });
    }
});

// ============================================
// ⭐ GET ORDERS BY STATUS (For filtered views)
// ============================================
router.get('/orders/:status', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { status } = req.params;
        console.log(`🔍 Fetching orders with status: ${status}`);
        
        let query = `
            SELECT 
                o.*, 
                c.customer_name,
                c.contact_person,
                c.phone,
                c.email as customer_email
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
        `;
        
        const params: any[] = [];
        
        if (status !== 'all') {
            query += ` WHERE o.status = $1`;
            params.push(status);
        }
        
        query += ` ORDER BY o.created_at DESC`;
        
        const result = await pool.query(query, params);
        console.log(`✅ Found ${result.rows.length} orders with status: ${status}`);
        
        res.json({ 
            status: status,
            count: result.rows.length,
            orders: result.rows 
        });
    } catch (error) {
        console.error('❌ Error fetching orders by status:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
});

// ============================================
// ⭐ GET DEPARTMENT REVIEW SUMMARY
// ============================================
router.get('/department-summary', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                department,
                COUNT(*) as total_reviews,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned
            FROM department_reviews
            GROUP BY department
            ORDER BY department
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching department summary:', error);
        res.status(500).json({ error: 'Failed to fetch department summary' });
    }
});

// ============================================
// ⭐ GET RECENT ACTIVITY
// ============================================
router.get('/recent-activity', authMiddleware, async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                al.id,
                al.action,
                al.timestamp,
                al.new_value,
                u.name as user_name,
                u.department as user_department,
                o.order_number
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN orders o ON al.order_id = o.id
            ORDER BY al.timestamp DESC
            LIMIT 20
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error fetching recent activity:', error);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

export default router;