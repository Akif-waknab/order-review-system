const bcrypt = require('bcryptjs');

async function generateHash() {
    const password = 'Admin@123';
    const saltRounds = 10;
    
    // Generate new hash
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log('========================================');
    console.log('🔐 NEW PASSWORD HASH GENERATED');
    console.log('========================================');
    console.log('Password: Admin@123');
    console.log('Hash:', hash);
    console.log('========================================');
    console.log('\n📝 Copy this SQL and run in PostgreSQL:');
    console.log(`UPDATE users SET password_hash = '${hash}';`);
    console.log('========================================');
}

generateHash();