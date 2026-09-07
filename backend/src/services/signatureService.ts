import crypto from 'crypto';

// ============================================
// GENERATE ELECTRONIC SIGNATURE
// ============================================
export const generateSignature = (
    userId: number,
    userName: string,
    department: string,
    action: string,
    orderId: number,
    comments: string = ''
): string => {
    // Create a unique signature string
    const timestamp = new Date().toISOString();
    const data = `${userId}|${userName}|${department}|${action}|${orderId}|${timestamp}|${comments}`;
    
    // Generate SHA-256 hash as signature
    const signature = crypto.createHash('sha256').update(data).digest('hex');
    
    return signature;
};

// ============================================
// VERIFY SIGNATURE
// ============================================
export const verifySignature = (
    signature: string,
    userId: number,
    userName: string,
    department: string,
    action: string,
    orderId: number,
    comments: string = ''
): boolean => {
    const expectedSignature = generateSignature(userId, userName, department, action, orderId, comments);
    return signature === expectedSignature;
};

// ============================================
// CREATE SIGNATURE OBJECT
// ============================================
export const createSignatureObject = (
    user: any,
    orderId: number,
    action: string,
    comments: string = '',
    ipAddress: string = ''
) => {
    const timestamp = new Date().toISOString();
    const signature = generateSignature(
        user.id,
        user.name,
        user.department,
        action,
        orderId,
        comments
    );

    return {
        signature: signature,
        signed_by: user.name,
        signed_by_id: user.id,
        department: user.department,
        action: action,
        timestamp: timestamp,
        ip_address: ipAddress || '127.0.0.1',
        comments: comments,
        // Human-readable signature block
        signature_block: `
========================================
ELECTRONIC SIGNATURE
========================================
Signed By: ${user.name}
Department: ${user.department}
Action: ${action}
Order ID: ${orderId}
Date/Time: ${new Date(timestamp).toLocaleString()}
Signature: ${signature.substring(0, 16)}...
IP Address: ${ipAddress || '127.0.0.1'}
Comments: ${comments || 'N/A'}
========================================
        `.trim()
    };
};