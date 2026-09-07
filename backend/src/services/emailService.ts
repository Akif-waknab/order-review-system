import nodemailer from 'nodemailer';

// ============================================
// EMAIL TRANSPORTER
// ============================================
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ============================================
// SEND ORDER CREATED EMAIL
// ============================================
export const sendOrderCreatedEmail = async (order: any, customer: any, user: any) => {
    const subject = `✅ Order ${order.order_review_number} Created`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">📦 Unlimited Packaging Plc.</h1>
            <p style="margin: 5px 0 0;">Order Created</p>
        </div>
        <div style="padding: 20px; background: #f7fafc;">
            <h2>Hello ${customer.customer_name},</h2>
            <p>Your order <strong>${order.order_review_number}</strong> has been created successfully.</p>
            <hr>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Review Number:</strong> ${order.order_review_number}</p>
            <p><strong>Quantity:</strong> ${order.quantity?.toLocaleString()}</p>
            <p><strong>Board Size:</strong> ${order.board_size || 'N/A'}</p>
            <p><strong>Expected Delivery:</strong> ${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
            <hr>
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>Your order is being reviewed by our departments</li>
                <li>You will receive notifications as it progresses</li>
            </ul>
            <p style="text-align: center; margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL}/orders" style="background: #2b6cb0; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px;">View Order</a>
            </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #718096; font-size: 12px;">
            <p>&copy; 2026 Unlimited Packaging Plc. All rights reserved.</p>
            <p>Document: OF/MSD/024 | Issue: 01</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: customer.email || process.env.SMTP_USER,
            subject: subject,
            html: html
        });
        console.log(`📧 Email sent to ${customer.email || 'admin'}`);
    } catch (error) {
        console.error('❌ Email error:', error);
    }
};

// ============================================
// SEND REVIEW NOTIFICATION EMAIL
// ============================================
export const sendReviewNotificationEmail = async (order: any, customer: any, department: string, status: string, comments: string = '') => {
    const statusText = status === 'approved' ? '✅ Approved' :
                       status === 'rejected' ? '❌ Rejected' :
                       status === 'returned' ? '🔄 Returned for Correction' : '⚠️ Needs Review';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">📦 Unlimited Packaging Plc.</h1>
            <p style="margin: 5px 0 0;">Order Review Update</p>
        </div>
        <div style="padding: 20px; background: #f7fafc;">
            <h2>Hello ${customer.customer_name},</h2>
            <p>Your order <strong>${order.order_review_number}</strong> has been reviewed by <strong>${department}</strong>.</p>
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #48bb78; margin: 15px 0;">
                <h3 style="margin: 0;">${statusText}</h3>
            </div>
            ${comments ? `<div style="background: #f0f4f8; padding: 15px; border-radius: 6px; margin: 10px 0;"><strong>Comments:</strong> ${comments}</div>` : ''}
            <hr>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Review Number:</strong> ${order.order_review_number}</p>
            <p style="text-align: center; margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL}/orders" style="background: #2b6cb0; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px;">View Order</a>
            </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #718096; font-size: 12px;">
            <p>&copy; 2026 Unlimited Packaging Plc. All rights reserved.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: customer.email || process.env.SMTP_USER,
            subject: `📋 Order ${order.order_review_number} - ${department} Review ${status}`,
            html: html
        });
        console.log(`📧 Review email sent for ${order.order_review_number}`);
    } catch (error) {
        console.error('❌ Email error:', error);
    }
};

// ============================================
// SEND FINAL APPROVAL EMAIL
// ============================================
export const sendFinalApprovalEmail = async (order: any, customer: any, status: string, comments: string = '') => {
    const icon = status === 'approved' ? '✅' : '❌';
    const title = status === 'approved' ? 'Order Approved!' : 'Order Rejected';
    const color = status === 'approved' ? '#48bb78' : '#fc8181';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background: ${color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">📦 Unlimited Packaging Plc.</h1>
            <p style="margin: 5px 0 0;">${title}</p>
        </div>
        <div style="padding: 20px; background: #f7fafc;">
            <h2 style="text-align: center;">${icon} ${title}</h2>
            <p style="text-align: center;">Order <strong>${order.order_review_number}</strong> has been ${status}.</p>
            ${comments ? `<div style="background: #f0f4f8; padding: 15px; border-radius: 6px; margin: 10px 0;"><strong>Final Comments:</strong> ${comments}</div>` : ''}
            <hr>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Review Number:</strong> ${order.order_review_number}</p>
            <p style="text-align: center; margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL}/orders" style="background: #2b6cb0; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px;">View Order</a>
            </p>
        </div>
        <div style="text-align: center; padding: 20px; color: #718096; font-size: 12px;">
            <p>&copy; 2026 Unlimited Packaging Plc. All rights reserved.</p>
        </div>
    </div>
    `;

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: customer.email || process.env.SMTP_USER,
            subject: `${icon} Order ${order.order_review_number} - ${title}`,
            html: html
        });
        console.log(`📧 Final approval email sent for ${order.order_review_number}`);
    } catch (error) {
        console.error('❌ Email error:', error);
    }
};