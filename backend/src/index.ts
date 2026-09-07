import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import orderRoutes from './routes/orders';
import dashboardRoutes from './routes/dashboard';
import reviewRoutes from './routes/reviews';
import auditRoutes from './routes/audit';
import reportRoutes from './routes/reports';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
// authRoutes does NOT need authMiddleware (it's for login)
app.use('/api/auth', authRoutes);

// Protected routes that need authentication
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/reviews', authMiddleware, reviewRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);

// Reports route - NO authMiddleware! (uses token from query parameter)
app.use('/api/reports', reportRoutes);

// Health check - no authentication needed
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});