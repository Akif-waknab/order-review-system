-- ============================================
-- UNLIMITED PACKAGING PLC.
-- CUSTOMER ORDER REVIEW SYSTEM
-- COMPLETE DATABASE SCHEMA
-- ============================================

-- ============================================
-- DROP TABLES IN CORRECT ORDER (CASCADE)
-- ============================================
DROP TABLE IF EXISTS signatures CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS production_reviews CASCADE;
DROP TABLE IF EXISTS technical_reviews CASCADE;
DROP TABLE IF EXISTS department_reviews CASCADE;
DROP TABLE IF EXISTS order_materials CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DEFAULT USERS (Password: Admin@123)
-- ============================================
INSERT INTO users (name, username, email, password_hash, department, role) VALUES
('System Administrator', 'admin', 'admin@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Administration', 'Administrator'),
('Marketing Manager', 'marketing', 'marketing@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Marketing', 'Marketing'),
('Material Manager', 'material', 'material@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Material Management', 'Material'),
('Finance Manager', 'finance', 'finance@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Finance', 'Finance'),
('Quality Manager', 'quality', 'quality@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'PDQM', 'PDQM'),
('Technical Manager', 'technical', 'technical@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Technical', 'Technical'),
('Production Manager', 'production', 'production@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Production', 'Production'),
('Management', 'management', 'management@unlimitedpackaging.com', 
 '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZxqB', 'Management', 'Management');

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO customers (customer_name, contact_person, phone, email) VALUES
('ABC Manufacturing', 'John Smith', '+251-911-123456', 'john@abcmanufacturing.com'),
('XYZ Industries', 'Sarah Johnson', '+251-922-654321', 'sarah@xyzindustries.com'),
('Ethiopian Packaging Co.', 'Michael Tesfaye', '+251-933-789012', 'michael@ethiopackaging.com');

-- ============================================
-- MATERIALS TABLE
-- ============================================
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    material_type VARCHAR(50) NOT NULL,
    gsm INTEGER NOT NULL,
    stock_balance DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'kg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(material_type, gsm)
);

INSERT INTO materials (material_type, gsm, stock_balance) VALUES
('KRAFT LINER', 125, 5000.00),
('KRAFT LINER', 130, 6000.00),
('KRAFT LINER', 150, 3000.00),
('TEST LINER', 125, 3000.00),
('TEST LINER', 135, 4000.00),
('FLUTE LINER', 130, 3500.00),
('WHITE KRAFT', 140, 2000.00),
('WHITE KRAFT', 150, 2500.00);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    order_review_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    previous_order_number VARCHAR(50),
    quantity INTEGER,
    board_size VARCHAR(100),
    material_combination VARCHAR(100),
    reel_size VARCHAR(50),
    expected_delivery_date DATE,
    order_date DATE DEFAULT CURRENT_DATE,
    customer_contact VARCHAR(100),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(100),
    salesperson VARCHAR(100),
    remarks TEXT,
    status VARCHAR(30) DEFAULT 'draft',
    current_step VARCHAR(30) DEFAULT 'specification',
    created_by INTEGER REFERENCES users(id),
    -- Final approval fields
    final_signature TEXT,
    final_signed_at TIMESTAMP,
    final_approved_by INTEGER REFERENCES users(id),
    final_comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ORDER MATERIALS TABLE
-- ============================================
CREATE TABLE order_materials (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    material_id INTEGER REFERENCES materials(id),
    required_quantity DECIMAL(10,2),
    available_quantity DECIMAL(10,2),
    shortage_quantity DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DEPARTMENT REVIEWS TABLE
-- ============================================
CREATE TABLE department_reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    department VARCHAR(50) NOT NULL,
    reviewer_id INTEGER REFERENCES users(id),
    status VARCHAR(30) NOT NULL,
    comments TEXT,
    rejection_reason TEXT,
    correction_reason TEXT,
    signature TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TECHNICAL REVIEWS TABLE
-- ============================================
CREATE TABLE technical_reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    machine_availability VARCHAR(30),
    steam_generation VARCHAR(30),
    glue_preparation VARCHAR(30),
    board_production VARCHAR(30),
    box_converting VARCHAR(30),
    machine_name VARCHAR(100),
    maintenance_status TEXT,
    expected_availability_date DATE,
    technical_limitations TEXT,
    technical_comments TEXT,
    reviewer_id INTEGER REFERENCES users(id),
    status VARCHAR(30),
    signature TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRODUCTION REVIEWS TABLE
-- ============================================
CREATE TABLE production_reviews (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    corrugator_capacity VARCHAR(30),
    printing_capacity VARCHAR(30),
    die_cutting_capacity VARCHAR(30),
    folder_gluer_capacity VARCHAR(30),
    other_process VARCHAR(100),
    required_manpower INTEGER,
    available_manpower INTEGER,
    manpower_sufficient BOOLEAN,
    customer_required_date DATE,
    estimated_start_date DATE,
    estimated_completion_date DATE,
    lead_time_sufficient BOOLEAN,
    comments TEXT,
    reviewer_id INTEGER REFERENCES users(id),
    status VARCHAR(30),
    signature TEXT,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ⭐ SIGNATURES TABLE (NEW - For all electronic signatures)
-- ============================================
CREATE TABLE signatures (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    department VARCHAR(100),
    action VARCHAR(50),
    signature_hash TEXT,
    comments TEXT,
    signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for faster lookups
CREATE INDEX idx_signatures_order_id ON signatures(order_id);
CREATE INDEX idx_signatures_user_id ON signatures(user_id);
CREATE INDEX idx_signatures_department ON signatures(department);
CREATE INDEX idx_signatures_signed_at ON signatures(signed_at);

-- Add comment for documentation
COMMENT ON TABLE signatures IS 'Stores all electronic signatures (SHA-256 hashed) for orders';
COMMENT ON COLUMN signatures.signature_hash IS 'SHA-256 hash of the signature data';

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    order_id INTEGER REFERENCES orders(id),
    title VARCHAR(200),
    message TEXT,
    type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SYSTEM SETTINGS TABLE
-- ============================================
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('gsm_values', '125,130,135,140,150', 'Available GSM values'),
    ('material_types', 'KRAFT LINER,TEST LINER,FLUTE LINER,WHITE KRAFT', 'Material types'),
    ('company_name', 'Unlimited Packaging Plc.', 'Company name');

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_order_review_number ON orders(order_review_number);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_expected_delivery ON orders(expected_delivery_date);

CREATE INDEX idx_department_reviews_order ON department_reviews(order_id);
CREATE INDEX idx_department_reviews_department ON department_reviews(department);
CREATE INDEX idx_department_reviews_status ON department_reviews(status);
CREATE INDEX idx_department_reviews_reviewer ON department_reviews(reviewer_id);

CREATE INDEX idx_order_materials_order ON order_materials(order_id);
CREATE INDEX idx_order_materials_material ON order_materials(material_id);

CREATE INDEX idx_audit_logs_order ON audit_logs(order_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Order Summary with Department Review Status
CREATE OR REPLACE VIEW vw_order_review_summary AS
SELECT 
    o.id,
    o.order_number,
    o.order_review_number,
    o.customer_id,
    c.customer_name,
    o.quantity,
    o.status,
    o.created_at,
    o.created_by,
    u.name as created_by_name,
    COUNT(dr.id) as total_reviews,
    COUNT(CASE WHEN dr.status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN dr.status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN dr.status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN dr.status = 'returned' THEN 1 END) as returned_count,
    o.final_signature IS NOT NULL as has_final_signature,
    o.final_signed_at as final_approved_at
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN users u ON o.created_by = u.id
LEFT JOIN department_reviews dr ON o.id = dr.order_id
GROUP BY o.id, o.order_number, o.order_review_number, o.customer_id, 
         c.customer_name, o.quantity, o.status, o.created_at, 
         o.created_by, u.name, o.final_signature, o.final_signed_at;

-- View: Pending Reviews by Department
CREATE OR REPLACE VIEW vw_pending_reviews AS
SELECT 
    dr.id as review_id,
    dr.order_id,
    o.order_number,
    o.order_review_number,
    c.customer_name,
    dr.department,
    dr.status,
    dr.created_at,
    u.name as reviewer_name,
    u.id as reviewer_id
FROM department_reviews dr
JOIN orders o ON dr.order_id = o.id
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN users u ON dr.reviewer_id = u.id
WHERE dr.status = 'pending'
ORDER BY dr.created_at ASC;

-- View: Orders Pending Final Approval
CREATE OR REPLACE VIEW vw_pending_final_approval AS
SELECT 
    o.id,
    o.order_number,
    o.order_review_number,
    c.customer_name,
    o.quantity,
    o.created_at,
    COUNT(dr.id) as total_reviews,
    COUNT(CASE WHEN dr.status = 'approved' THEN 1 END) as approved_count,
    STRING_AGG(CASE WHEN dr.status = 'pending' THEN dr.department END, ', ') as pending_departments
FROM orders o
JOIN customers c ON o.customer_id = c.id
LEFT JOIN department_reviews dr ON o.id = dr.order_id
WHERE o.status IN ('in_review', 'pending_final_approval')
  AND o.final_signature IS NULL
GROUP BY o.id, o.order_number, o.order_review_number, c.customer_name, 
         o.quantity, o.created_at
HAVING COUNT(CASE WHEN dr.status = 'pending' THEN 1 END) = 0
   AND COUNT(CASE WHEN dr.status = 'approved' THEN 1 END) >= 5
ORDER BY o.created_at ASC;

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Update timestamp on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_materials_updated_at BEFORE UPDATE ON order_materials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_department_reviews_updated_at BEFORE UPDATE ON department_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_technical_reviews_updated_at BEFORE UPDATE ON technical_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_production_reviews_updated_at BEFORE UPDATE ON production_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update order status when all reviews are done
CREATE OR REPLACE FUNCTION check_order_review_completion()
RETURNS TRIGGER AS $$
DECLARE
    pending_count INTEGER;
    rejected_count INTEGER;
    order_status VARCHAR(30);
BEGIN
    -- Get counts for this order
    SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END),
        COUNT(CASE WHEN status = 'rejected' THEN 1 END)
    INTO pending_count, rejected_count
    FROM department_reviews
    WHERE order_id = NEW.order_id;
    
    -- Get current order status
    SELECT status INTO order_status FROM orders WHERE id = NEW.order_id;
    
    -- If any rejected, mark as rejected
    IF rejected_count > 0 AND order_status != 'rejected' THEN
        UPDATE orders SET status = 'rejected' WHERE id = NEW.order_id;
    -- If no pending and no rejected, mark as pending final approval
    ELSIF pending_count = 0 AND rejected_count = 0 AND order_status IN ('in_review', 'draft') THEN
        UPDATE orders SET status = 'pending_final_approval' WHERE id = NEW.order_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER after_review_update
AFTER UPDATE ON department_reviews
FOR EACH ROW
EXECUTE FUNCTION check_order_review_completion();

-- ============================================
-- GRANT PERMISSIONS (Optional - adjust as needed)
-- ============================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_username;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON DATABASE order_review_db IS 'Unlimited Packaging PLC - Customer Order Review System';
COMMENT ON TABLE users IS 'System users with role-based access control';
COMMENT ON TABLE orders IS 'Customer orders with review workflow';
COMMENT ON TABLE department_reviews IS 'Departmental review status for each order';
COMMENT ON TABLE signatures IS 'SHA-256 hashed electronic signatures';
COMMENT ON TABLE audit_logs IS 'Audit trail for all system actions';

-- ============================================
-- SCHEMA COMPLETE
-- ============================================