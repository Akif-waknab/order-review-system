import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        console.log('========================================');
        console.log('🔐 LOGIN ATTEMPT');
        console.log('Username:', username);
        console.log('========================================');

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const result = await pool.query(
            'SELECT id, name, username, email, department, role, password_hash FROM users WHERE username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            console.log('❌ User NOT found:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        console.log('✅ User found:', user.username);

        const isValid = await bcrypt.compare(password, user.password_hash);
        console.log('✅ Password valid?', isValid);

        if (!isValid) {
            console.log('❌ Invalid password for user:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        delete user.password_hash;

        console.log('✅ Login SUCCESSFUL for:', username);
        console.log('========================================');
        res.json({ user, token });
    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: number };
        const result = await pool.query(
            `SELECT id, name, username, email, department, role 
             FROM users 
             WHERE id = $1 AND status = 'active'`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;