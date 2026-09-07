import express from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get audit logs
router.get('/', async (req: AuthRequest, res) => {
    try {
        const result = await pool.query(`
            SELECT al.*, u.name as user_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.timestamp DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// Get audit logs for a specific order
router.get('/order/:orderId', async (req: AuthRequest, res) => {
    try {
        const { orderId } = req.params;
        const result = await pool.query(`
            SELECT al.*, u.name as user_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.order_id = $1
            ORDER BY al.timestamp DESC
        `, [orderId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching audit logs for order:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

export default router;