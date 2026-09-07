import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

export interface AuthRequest extends Request {
    user?: {
        id: number;
        name: string;
        username: string;
        email: string;
        department: string;
        role: string;
    };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        console.log('🔐 Auth Middleware - Headers:', req.headers);
        console.log('🔐 Auth Middleware - Authorization:', req.headers.authorization);
        
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            console.log('❌ No token found');
            return res.status(401).json({ error: 'No token provided' });
        }

        console.log('✅ Token found:', token.substring(0, 20) + '...');

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: number };
        console.log('✅ Decoded token:', decoded);

        const result = await pool.query(
            `SELECT id, name, username, email, department, role 
             FROM users 
             WHERE id = $1 AND status = 'active'`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            console.log('❌ User not found in database');
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = result.rows[0];
        console.log('✅ User set in request:', req.user);
        next();
    } catch (error) {
        console.error('❌ Auth error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export const authorize = (...allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        next();
    };
};