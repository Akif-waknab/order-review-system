// ============================================
// UNLIMITED PACKAGING PLC.
// ORDER REVIEW SYSTEM - MAIN APPLICATION
// ============================================

const API_URL = 'http://localhost:5000/api';
let authToken = localStorage.getItem('token') || null;
let currentUser = null;
let orders = [];
let currentStep = 1;
const TOTAL_STEPS = 7;

// ============================================
// DOM REFERENCES
// ============================================
const loginPage = document.getElementById('loginPage');
const appPage = document.getElementById('appPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        verifyToken();
    }
});

// ============================================
// AUTHENTICATION
// ============================================

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        loginError.textContent = 'Please enter username and password';
        return;
    }

    loginError.textContent = '';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            loginError.textContent = data.error || 'Login failed';
            return;
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', authToken);
        showApp();

    } catch (error) {
        loginError.textContent = 'Network error. Is the backend running?';
        console.error('Login error:', error);
    }
});

// Logout
window.logout = function() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    showLogin();
};

// Verify Token
async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            currentUser = await response.json();
            showApp();
        } else {
            localStorage.removeItem('token');
            authToken = null;
            showLogin();
        }
    } catch (error) {
        localStorage.removeItem('token');
        authToken = null;
        showLogin();
    }
}

// ============================================
// UI NAVIGATION
// ============================================

function showLogin() {
    loginPage.style.display = 'flex';
    appPage.style.display = 'none';
}

function showApp() {
    loginPage.style.display = 'none';
    appPage.style.display = 'block';
    updateUserInfo();
    loadStats();
    loadOrders();
    loadAdvancedStats();
    showPage('dashboard');
    
    // ⭐ Log for debugging
    console.log('✅ App loaded successfully');
    console.log('👤 Current User:', currentUser);
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userRole').textContent = currentUser.role;
        document.getElementById('dashboardUserName').textContent = currentUser.name;
        document.getElementById('welcomeMessage').innerHTML =
            `You are logged in as <strong>${currentUser.name}</strong> from <strong>${currentUser.department}</strong>`;
        document.getElementById('roleMessage').innerHTML =
            `Role: <span class="role-badge">${currentUser.role}</span>`;
    }
}

window.showPage = function(page) {
    // Hide all pages
    document.querySelectorAll('.main-content > div[id^="page-"]').forEach(el => {
        el.style.display = 'none';
    });

    // Show selected page
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });

    // Load data for specific pages
    if (page === 'dashboard') {
        loadStats();
        loadAdvancedStats();
    }
    if (page === 'orders') loadOrders();
    if (page === 'reviews') loadReviews();
    if (page === 'audit') loadAudit();
};

// Sidebar navigation
document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showPage(link.dataset.page);
    });
});

// Toggle sidebar (mobile)
window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
};

// ============================================
// DASHBOARD - CLICKABLE STAT CARDS
// ============================================

// Store all orders data for filtering
let allOrdersData = [];

// ⭐ Show filtered orders modal
function showFilteredOrders(title, statusFilter) {
    const modal = document.getElementById('filteredOrdersModal');
    const body = document.getElementById('filteredOrdersBody');
    
    if (!modal || !body) {
        console.error('❌ Filtered orders modal not found in DOM');
        alert('Modal not found. Please refresh the page.');
        return;
    }
    
    console.log('🔍 Filtering orders:', { title, statusFilter, totalOrders: allOrdersData.length });
    
    // Filter orders by status
    let filteredOrders = allOrdersData;
    if (statusFilter !== 'all') {
        filteredOrders = allOrdersData.filter(order => order.status === statusFilter);
    }
    
    console.log(`📋 Found ${filteredOrders.length} orders for status: ${statusFilter}`);
    
    // Build HTML
    let html = '';
    
    if (!filteredOrders || filteredOrders.length === 0) {
        html = `<div class="no-orders">
            <i class="fas fa-inbox" style="font-size:48px;color:#cbd5e0;margin-bottom:12px;"></i>
            <p>No orders found with status: ${title}</p>
            <p style="font-size:13px;color:#a0aec0;margin-top:8px;">Total orders in system: ${allOrdersData.length}</p>
        </div>`;
    } else {
        html = `<table>
            <thead>
                <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Qty</th>
                    <th>Delivery Date</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>`;
        
        filteredOrders.forEach(order => {
            const statusClass = (order.status || 'draft').replace(/_/g, '_');
            const statusLabel = (order.status || 'Draft').replace(/_/g, ' ');
            
            html += `
                <tr>
                    <td><strong>${order.order_number || '-'}</strong></td>
                    <td>${order.customer_name || 'N/A'}</td>
                    <td>${order.quantity?.toLocaleString() || 0}</td>
                    <td>${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : '-'}</td>
                    <td><span class="status-badge-sm ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="closeFilteredModal(); showOrderStatus(${order.id});" style="font-size:10px; padding:2px 8px;">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        html += `<div style="margin-top:12px;font-size:13px;color:#718096;">
            Showing ${filteredOrders.length} order(s) out of ${allOrdersData.length} total
        </div>`;
    }
    
    document.getElementById('filteredModalTitle').textContent = title;
    body.innerHTML = html;
    modal.classList.add('active');
}

// ⭐ Close filtered orders modal
function closeFilteredModal() {
    const modal = document.getElementById('filteredOrdersModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ⭐ Close modal on click outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('filteredOrdersModal');
    if (event.target === modal) {
        modal.classList.remove('active');
    }
});

// ⭐ Load Stats with orders data (FIXED)
async function loadStats() {
    try {
        console.log('📊 Fetching dashboard stats...');
        
        const response = await fetch(`${API_URL}/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('📊 Stats data received:', data);
            
            // Update the stat cards
            document.getElementById('totalOrders').textContent = data.totalOrders || 0;
            document.getElementById('pendingOrders').textContent = data.pendingReviews || 0;
            document.getElementById('approvedOrders').textContent = data.approvedOrders || 0;
            document.getElementById('rejectedOrders').textContent = data.rejectedOrders || 0;
            
            // ⭐ Store orders data for filtering
            if (data.orders && Array.isArray(data.orders)) {
                allOrdersData = data.orders;
                console.log('📋 Orders stored for filtering:', allOrdersData.length);
            } else {
                // If orders not in stats, fetch them separately
                console.log('⚠️ No orders in stats response, fetching separately...');
                await loadOrdersForFiltering();
            }
        } else {
            console.error('❌ Failed to fetch stats:', response.status);
            const error = await response.json();
            console.error('❌ Error details:', error);
        }
    } catch (error) {
        console.error('❌ Error loading stats:', error);
    }
}

// ⭐ Load orders for filtering (Fallback)
async function loadOrdersForFiltering() {
    try {
        console.log('📋 Fetching orders for filtering...');
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            allOrdersData = data.data || [];
            console.log('📋 Orders loaded for filtering:', allOrdersData.length);
        } else {
            console.error('❌ Failed to fetch orders for filtering');
        }
    } catch (error) {
        console.error('❌ Error loading orders for filtering:', error);
    }
}

// ============================================
// ADVANCED DASHBOARD - CHARTS
// ============================================

let statusChart = null;
let monthlyChart = null;

async function loadAdvancedStats() {
    try {
        const response = await fetch(`${API_URL}/dashboard/advanced`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('📊 Advanced Stats:', data);
            updateCharts(data);
            updateKPIs(data);
            updateDepartmentStats(data.departmentStats);
        }
    } catch (error) {
        console.error('Error loading advanced stats:', error);
    }
}

function updateCharts(data) {
    // Status Distribution Chart (Doughnut)
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        if (statusChart) statusChart.destroy();
        
        if (typeof Chart !== 'undefined') {
            statusChart = new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Draft', 'In Review', 'Pending Final', 'Approved', 'Rejected'],
                    datasets: [{
                        data: [
                            parseInt(data.draft) || 0,
                            parseInt(data.in_review) || 0,
                            parseInt(data.pending_final) || 0,
                            parseInt(data.approved) || 0,
                            parseInt(data.rejected) || 0
                        ],
                        backgroundColor: ['#718096', '#F59E0B', '#3B82F6', '#10B981', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { padding: 12, usePointStyle: true }
                        }
                    },
                    cutout: '65%'
                }
            });
        } else {
            console.warn('Chart.js not loaded');
        }
    }

    // Monthly Trend Chart (Bar)
    const monthlyCtx = document.getElementById('monthlyChart');
    if (monthlyCtx) {
        if (monthlyChart) monthlyChart.destroy();
        
        if (typeof Chart !== 'undefined') {
            monthlyChart = new Chart(monthlyCtx, {
                type: 'bar',
                data: {
                    labels: data.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Orders',
                        data: data.monthlyData || [0, 0, 0, 0, 0, 0],
                        backgroundColor: '#2B6CB0',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: { stepSize: 1 }
                        }
                    }
                }
            });
        }
    }
}

function updateKPIs(data) {
    const revenueEl = document.getElementById('totalRevenue');
    if (revenueEl) {
        revenueEl.textContent = data.totalRevenue ? `$${data.totalRevenue.toLocaleString()}` : '$0';
    }
    
    const timeEl = document.getElementById('avgProcessingTime');
    if (timeEl) {
        timeEl.textContent = data.avgProcessingTime ? `${data.avgProcessingTime} days` : '0 days';
    }
}

function updateDepartmentStats(deptData) {
    const container = document.getElementById('departmentStats');
    if (!container) return;

    if (!deptData || deptData.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#718096;">No department data available</div>';
        return;
    }

    let html = `
        <table class="department-stats">
            <thead>
                <tr>
                    <th>Department</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Rejected</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
    `;

    deptData.forEach(dept => {
        const total = (parseInt(dept.approved) || 0) + (parseInt(dept.pending) || 0) + (parseInt(dept.rejected) || 0);
        html += `
            <tr>
                <td><strong>${dept.department}</strong></td>
                <td><span class="status-badge" style="background:#C6F6D5;color:#22543D;">${dept.approved || 0}</span></td>
                <td><span class="status-badge" style="background:#FEFCBF;color:#975A16;">${dept.pending || 0}</span></td>
                <td><span class="status-badge" style="background:#FED7D7;color:#9B2C2C;">${dept.rejected || 0}</span></td>
                <td><strong>${total}</strong></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================
// ORDERS
// ============================================

window.loadOrders = async function() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '<div class="loading">Loading orders</div>';

    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            orders = data.data || [];
            renderOrders(orders);
        } else {
            ordersList.innerHTML = '<p class="loading">Failed to load orders</p>';
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersList.innerHTML = '<p class="loading">Network error loading orders</p>';
    }
};

// ============================================
// RENDER ORDERS WITH CLICKABLE ORDER NUMBER
// ============================================
function renderOrders(orderData) {
    const ordersList = document.getElementById('ordersList');

    if (!orderData || orderData.length === 0) {
        ordersList.innerHTML = `
            <div class="table-container">
                <div style="padding:40px;text-align:center;color:#718096;">
                    <p>No orders found.</p>
                    <button class="btn btn-primary" style="margin-top:12px;" onclick="showPage('new-order')">
                        <i class="fas fa-plus"></i> Create your first order
                    </button>
                </div>
            </div>
        `;
        return;
    }

    let html = `<div class="table-container"><table><thead><tr>
        <th>Order #</th>
        <th>Review #</th>
        <th>Customer</th>
        <th>Qty</th>
        <th>Delivery Date</th>
        <th>Status</th>
        <th>Waiting For</th>
        <th>Actions</th>
    </tr></thead><tbody>`;

    orderData.forEach(order => {
        const statusClass = `status-${order.status?.replace(/_/g, '_') || 'draft'}`;
        const statusLabel = order.status?.replace(/_/g, ' ') || 'Draft';
        
        html += `
            <tr>
                <td>
                    <a href="#" onclick="showOrderStatus(${order.id}); return false;" 
                       style="color: #2b6cb0; text-decoration: underline; cursor: pointer; font-weight: bold;">
                        ${order.order_number || '-'}
                    </a>
                </td>
                <td>${order.order_review_number || '-'}</td>
                <td>${order.customer_name || 'N/A'}</td>
                <td>${order.quantity?.toLocaleString() || 0}</td>
                <td>${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : '-'}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="showOrderStatus(${order.id})" title="Check Status">
                        <i class="fas fa-info-circle"></i> Check
                    </button>
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="viewOrder(${order.id})" title="View PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="viewSignatures(${order.id})" title="View Signatures">
                        <i class="fas fa-file-signature"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    ordersList.innerHTML = html;
}

window.filterOrders = function() {
    const search = document.getElementById('orderSearch').value.toLowerCase();
    const status = document.getElementById('statusFilter').value;

    let filtered = orders;

    if (search) {
        filtered = filtered.filter(o =>
            (o.order_number || '').toLowerCase().includes(search) ||
            (o.order_review_number || '').toLowerCase().includes(search) ||
            (o.customer_name || '').toLowerCase().includes(search)
        );
    }

    if (status !== 'all') {
        filtered = filtered.filter(o => o.status === status);
    }

    renderOrders(filtered);
};

// ============================================
// VIEW ORDER - UPDATED WITH TOKEN
// ============================================
window.viewOrder = function(id) {
    console.log('🔍 View Order ID:', id);
    const token = localStorage.getItem('token');
    console.log('🔑 Token from localStorage:', token);
    
    if (!token) {
        alert('Please login again');
        window.location.href = '/login';
        return;
    }

    window.open(`http://localhost:5000/api/reports/order/${id}/pdf?token=${token}`, '_blank');
};

// ============================================
// ⭐ SHOW ORDER STATUS WITH REQUIREMENTS, FINANCE, QUALITY & COLOR
// ============================================
window.showOrderStatus = async function(orderId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please login again');
        return;
    }

    try {
        console.log('🔍 Fetching order status for ID:', orderId);
        
        const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('📊 Order data received:', data);
            
            // Build department status as HTML
            let departmentHTML = '';
            
            if (data.reviews && data.reviews.length > 0) {
                data.reviews.forEach(review => {
                    let statusIcon = '⏳';
                    let statusColor = '#F59E0B';
                    let statusText = review.status || 'pending';
                    
                    if (review.status === 'approved') {
                        statusIcon = '✅';
                        statusColor = '#10B981';
                        statusText = 'Approved';
                    } else if (review.status === 'rejected') {
                        statusIcon = '❌';
                        statusColor = '#EF4444';
                        statusText = 'Rejected';
                    } else if (review.status === 'returned') {
                        statusIcon = '🔄';
                        statusColor = '#F59E0B';
                        statusText = 'Returned';
                    } else if (review.status === 'pending') {
                        statusIcon = '⏳';
                        statusColor = '#F59E0B';
                        statusText = 'Pending';
                    }
                    
                    let reviewerInfo = review.reviewer_name ? ` (by ${review.reviewer_name})` : '';
                    let dateInfo = review.reviewed_at ? ` on ${new Date(review.reviewed_at).toLocaleDateString()}` : '';
                    
                    departmentHTML += `
                        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #e2e8f0;">
                            <span><strong>${review.department}</strong></span>
                            <span style="color:${statusColor};">
                                ${statusIcon} ${statusText}${reviewerInfo}${dateInfo}
                            </span>
                        </div>
                    `;
                });
            } else {
                departmentHTML = '<p style="color:#718096;">No department reviews yet.</p>';
            }

            const order = data.order;
            const statusEmoji = order.status === 'approved' ? '✅' :
                              order.status === 'rejected' ? '❌' :
                              order.status === 'returned' ? '🔄' : '⏳';

            // ⭐ BUILD REQUIREMENTS SECTION
            let requirementsHTML = '';
            const hasRequirements = order.required_machines || order.required_materials || order.required_manpower || 
                                   order.estimated_processing_days || order.special_requirements || 
                                   order.quality_standards || order.technical_specifications;
            
            if (hasRequirements) {
                requirementsHTML = `
                    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                    <h3 style="color: #1a365d; margin: 0 0 10px 0;">📋 ORDER REQUIREMENTS & SPECIFICATIONS</h3>
                    <div style="font-size: 14px; line-height: 1.8; background: #f7fafc; padding: 12px; border-radius: 6px;">
                        ${order.required_machines ? `<div><strong>🔧 Required Machines:</strong> ${order.required_machines}</div>` : ''}
                        ${order.required_materials ? `<div><strong>📦 Required Materials:</strong> ${order.required_materials}</div>` : ''}
                        ${order.required_manpower ? `<div><strong>👷 Required Manpower:</strong> ${order.required_manpower}</div>` : ''}
                        ${order.estimated_processing_days ? `<div><strong>⏱️ Estimated Processing Days:</strong> ${order.estimated_processing_days} days</div>` : ''}
                        ${order.special_requirements ? `<div><strong>📌 Special Requirements:</strong> ${order.special_requirements}</div>` : ''}
                        ${order.quality_standards ? `<div><strong>✅ Quality Standards:</strong> ${order.quality_standards}</div>` : ''}
                        ${order.technical_specifications ? `<div><strong>⚙️ Technical Specifications:</strong> ${order.technical_specifications}</div>` : ''}
                    </div>
                `;
            } else {
                requirementsHTML = `
                    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                    <h3 style="color: #1a365d; margin: 0 0 10px 0;">📋 ORDER REQUIREMENTS & SPECIFICATIONS</h3>
                    <div style="font-size: 14px; line-height: 1.8; background: #f7fafc; padding: 12px; border-radius: 6px;">
                        <p style="color:#718096; font-style:italic;">No specifications provided for this order.</p>
                    </div>
                `;
            }

            // ⭐ BUILD FINANCE REVIEW SECTION
            let financeHTML = '';
            const hasFinance = order.finance_payment_terms || order.finance_customer_credit || 
                              order.finance_budget_allocation || order.finance_risk_level ||
                              order.finance_profitability || order.finance_clearance_status ||
                              order.finance_review_comments;
            
            if (hasFinance) {
                financeHTML = `
                    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                    <h3 style="color: #1a365d; margin: 0 0 10px 0;">💰 FINANCE REVIEW</h3>
                    <div style="font-size: 14px; line-height: 1.8; background: #f7fafc; padding: 12px; border-radius: 6px;">
                        ${order.finance_payment_terms ? `<div><strong>💳 Payment Terms:</strong> ${order.finance_payment_terms.replace(/_/g, ' ')}</div>` : ''}
                        ${order.finance_customer_credit ? `<div><strong>🏦 Customer Credit:</strong> ${order.finance_customer_credit.replace(/_/g, ' ')}</div>` : ''}
                        ${order.finance_budget_allocation ? `<div><strong>📊 Budget Allocation:</strong> ${order.finance_budget_allocation.replace(/_/g, ' ')}</div>` : ''}
                        ${order.finance_risk_level ? `<div><strong>⚠️ Risk Level:</strong> ${order.finance_risk_level}</div>` : ''}
                        ${order.finance_profitability ? `<div><strong>📈 Profitability:</strong> ${order.finance_profitability}</div>` : ''}
                        ${order.finance_clearance_status ? `<div><strong>✅ Clearance Status:</strong> ${order.finance_clearance_status.replace(/_/g, ' ')}</div>` : ''}
                        ${order.finance_review_comments ? `<div><strong>💬 Comments:</strong> ${order.finance_review_comments}</div>` : ''}
                        ${order.finance_review_status ? `<div><strong>📌 Review Status:</strong> ${order.finance_review_status}</div>` : ''}
                    </div>
                `;
            }

            // ⭐ BUILD QUALITY REVIEW SECTION
            let qualityHTML = '';
            const hasQuality = order.quality_spec_compliance || order.quality_requirements || 
                              order.quality_printing_requirements || order.quality_risk_level ||
                              order.quality_testing_requirements || order.quality_certifications ||
                              order.quality_review_comments;
            
            if (hasQuality) {
                qualityHTML = `
                    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                    <h3 style="color: #1a365d; margin: 0 0 10px 0;">✅ QUALITY REVIEW</h3>
                    <div style="font-size: 14px; line-height: 1.8; background: #f7fafc; padding: 12px; border-radius: 6px;">
                        ${order.quality_spec_compliance ? `<div><strong>📋 Specification Compliance:</strong> ${order.quality_spec_compliance.replace(/_/g, ' ')}</div>` : ''}
                        ${order.quality_requirements ? `<div><strong>🔍 Quality Requirements:</strong> ${order.quality_requirements.replace(/_/g, ' ')}</div>` : ''}
                        ${order.quality_printing_requirements ? `<div><strong>🖨️ Printing Requirements:</strong> ${order.quality_printing_requirements.replace(/_/g, ' ')}</div>` : ''}
                        ${order.quality_risk_level ? `<div><strong>⚠️ Risk Level:</strong> ${order.quality_risk_level}</div>` : ''}
                        ${order.quality_testing_requirements ? `<div><strong>🧪 Testing Requirements:</strong> ${order.quality_testing_requirements.replace(/_/g, ' ')}</div>` : ''}
                        ${order.quality_certifications ? `<div><strong>📜 Certifications:</strong> ${order.quality_certifications.replace(/_/g, ' ')}</div>` : ''}
                        ${order.quality_review_comments ? `<div><strong>💬 Comments:</strong> ${order.quality_review_comments}</div>` : ''}
                        ${order.quality_review_status ? `<div><strong>📌 Review Status:</strong> ${order.quality_review_status}</div>` : ''}
                    </div>
                `;
            }

            // ⭐ BUILD COLOR REQUIREMENTS SECTION
            let colorHTML = '';
            const hasColors = order.number_of_colors || order.color_types || order.color_options || order.color_specifications;
            
            if (hasColors) {
                colorHTML = `
                    <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                    <h3 style="color: #1a365d; margin: 0 0 10px 0;">🎨 COLOR REQUIREMENTS</h3>
                    <div style="font-size: 14px; line-height: 1.8; background: #f7fafc; padding: 12px; border-radius: 6px;">
                        ${order.number_of_colors ? `<div><strong>🔢 Number of Colors:</strong> ${order.number_of_colors}</div>` : ''}
                        ${order.color_types ? `<div><strong>🎨 Color Type:</strong> ${order.color_types.replace(/_/g, ' ')}</div>` : ''}
                        ${order.color_options ? `<div><strong>🟣 Colors Selected:</strong> ${order.color_options}</div>` : ''}
                        ${order.color_specifications ? `<div><strong>📋 Specifications:</strong> ${order.color_specifications}</div>` : ''}
                    </div>
                `;
            }

            // Build full HTML for the modal
            const html = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 5px; max-height: 80vh; overflow-y: auto;">
                    <div style="background: #1a365d; color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px;">
                        <h2 style="margin: 0; font-size: 20px;">📋 ORDER STATUS</h2>
                    </div>
                    <div style="padding: 0 5px;">
                        <p style="margin: 6px 0;"><strong>Order:</strong> ${order.order_number || 'N/A'}</p>
                        <p style="margin: 6px 0;"><strong>Review:</strong> ${order.order_review_number || 'N/A'}</p>
                        <p style="margin: 6px 0;"><strong>Customer:</strong> ${order.customer_name || 'N/A'}</p>
                        <p style="margin: 6px 0;"><strong>Quantity:</strong> ${order.quantity?.toLocaleString() || 0}</p>
                        <p style="margin: 6px 0;"><strong>Delivery Date:</strong> ${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
                        <p style="margin: 6px 0;"><strong>Status:</strong> ${statusEmoji} ${order.status || 'Unknown'}</p>
                        <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                        <h3 style="color: #1a365d; margin: 0 0 10px 0;">📊 Department Reviews</h3>
                        ${departmentHTML}
                        ${requirementsHTML}
                        ${financeHTML}
                        ${qualityHTML}
                        ${colorHTML}
                        <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 15px 0;">
                        <p style="font-weight: bold; color: #2b6cb0; margin: 5px 0;">📌 ${data.summary?.waiting_for || 'Processing...'}</p>
                    </div>
                </div>
            `;

            // Display in the signature modal
            document.getElementById('signatureModalContent').innerHTML = html;
            document.getElementById('signatureModal').style.display = 'flex';
            
        } else {
            const error = await response.json();
            alert('❌ ' + (error.error || 'Failed to fetch order status'));
        }
    } catch (error) {
        console.error('❌ Status error:', error);
        alert('❌ Network error: ' + error.message);
    }
};

// ============================================
// VIEW SIGNATURES
// ============================================
window.viewSignatures = async function(orderId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please login again');
            return;
        }
        
        const response = await fetch(`${API_URL}/orders/${orderId}/signatures`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            let html = '<div class="signature-history">';
            
            if (data.signatures && data.signatures.length > 0) {
                data.signatures.forEach(sig => {
                    const statusClass = sig.action === 'approved' ? 'approved' : 
                                       sig.action === 'rejected' ? 'rejected' : 
                                       sig.action === 'returned' ? 'returned' : '';
                    html += `
                        <div class="signature-block">
                            <div class="signature-header">
                                <strong>${sig.signed_by}</strong>
                                <span class="badge">${sig.department}</span>
                                <span class="badge ${statusClass}">${sig.action}</span>
                            </div>
                            <div class="signature-body">
                                <p>${sig.comments || 'No comments'}</p>
                                <small>Signed at: ${new Date(sig.signed_at).toLocaleString()}</small>
                                <br>
                                <small class="signature-hash">Signature: ${sig.signature ? sig.signature.substring(0, 24) + '...' : 'N/A'}</small>
                            </div>
                        </div>
                    `;
                });
            } else {
                html += '<p>No signatures found for this order.</p>';
            }
            
            html += '</div>';
            document.getElementById('signatureModalContent').innerHTML = html;
            document.getElementById('signatureModal').style.display = 'flex';
        } else {
            alert('Failed to load signatures');
        }
    } catch (error) {
        alert('Network error loading signatures');
        console.error('Signature view error:', error);
    }
};

// ============================================
// CLOSE SIGNATURE MODAL
// ============================================
window.closeSignatureModal = function() {
    document.getElementById('signatureModal').style.display = 'none';
};

// Close modal on click outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('signatureModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

// ============================================
// SIGN AND SUBMIT REVIEW (FIXED)
// ============================================
window.signReview = async function(reviewId, department) {
    console.log('📝 Signing review for Review ID:', reviewId);
    console.log('📝 Department:', department);
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please login again');
        return;
    }
    
    // Get current user info
    try {
        const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await userResponse.json();
        console.log('👤 Current User:', user);
        console.log('👤 User Department:', user.department);
        console.log('📋 Review Department:', department);
        
        if (user.department !== department && user.role !== 'Administrator') {
            alert(`❌ You are not authorized for ${department}. Your department is ${user.department}`);
            return;
        }
    } catch (error) {
        console.error('Error getting user info:', error);
    }
    
    const decision = prompt(
        `📋 Review for ${department}\n\n` +
        `Enter your decision (approved/rejected/returned):`,
        'approved'
    );
    
    if (!decision) return;
    
    const validDecisions = ['approved', 'rejected', 'returned'];
    if (!validDecisions.includes(decision.toLowerCase())) {
        alert('❌ Invalid decision. Please enter: approved, rejected, or returned');
        return;
    }
    
    const comments = prompt('📝 Enter your comments (optional):', '');
    
    try {
        // Use reviewId directly - it's the department_reviews.id
        const response = await fetch(`${API_URL}/reviews/${reviewId}/${department}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                status: decision.toLowerCase(), 
                comments: comments || '' 
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`✅ Review submitted successfully!\n\n${result.signature}`);
            loadReviews();
        } else {
            alert(`❌ Error: ${result.error || 'Failed to submit review'}`);
        }
    } catch (error) {
        alert('❌ Network error. Please make sure the backend is running.');
        console.error('Review error:', error);
    }
};

// ============================================
// ⭐ LOAD REVIEWS - HIDE REQUIREMENTS, SHOW ON VIEW DETAILS
// ============================================
async function loadReviews() {
    const container = document.getElementById('reviewsList');
    container.innerHTML = '<div class="loading">Loading reviews...</div>';

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<p class="loading">Please login again</p>';
            return;
        }

        // Get current user
        const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!userResponse.ok) {
            container.innerHTML = '<p class="loading">Failed to authenticate</p>';
            return;
        }
        
        const user = await userResponse.json();
        console.log('👤 Current User:', user);
        console.log('🏢 Department:', user.department);

        // 👇 If user is MANAGEMENT, fetch orders pending final approval
        if (user.department === 'Management') {
            console.log('🔍 Management user - fetching orders pending final approval');
            
            const ordersResponse = await fetch(`${API_URL}/orders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!ordersResponse.ok) {
                container.innerHTML = '<p class="loading">Failed to load orders</p>';
                return;
            }
            
            const ordersData = await ordersResponse.json();
            console.log('📋 All orders:', ordersData.data);
            
            const pendingFinalOrders = ordersData.data.filter(order => 
                order.status === 'pending_final_approval' || 
                order.status === 'in_review'
            );
            
            console.log('📋 Pending final approval orders:', pendingFinalOrders);
            
            if (pendingFinalOrders.length === 0) {
                container.innerHTML = `
                    <div class="table-container">
                        <div style="padding:40px;text-align:center;color:#718096;">
                            <i class="fas fa-check-circle" style="font-size:48px;color:#38a169;"></i>
                            <p style="margin-top:12px;">No orders pending final approval.</p>
                            <p style="font-size:14px;color:#a0aec0;">All departments must approve before you can finalize.</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            let html = `<div class="table-container"><table><thead><tr>
                <th>Order #</th>
                <th>Review #</th>
                <th>Customer</th>
                <th>Qty</th>
                <th>Department Status</th>
                <th>Action</th>
            </tr></thead><tbody>`;
            
            for (const order of pendingFinalOrders) {
                const statusResponse = await fetch(`${API_URL}/orders/${order.id}/status`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (statusResponse.ok) {
                    const statusData = await statusResponse.json();
                    const reviews = statusData.reviews || [];
                    
                    const departments = ['Material Management', 'Finance', 'PDQM', 'Technical', 'Production'];
                    let allApproved = true;
                    let deptStatusHTML = '';
                    
                    departments.forEach(dept => {
                        const review = reviews.find(r => r.department === dept);
                        const status = review ? review.status : 'pending';
                        const icon = status === 'approved' ? '✅' : 
                                    status === 'rejected' ? '❌' : 
                                    status === 'returned' ? '🔄' : '⏳';
                        const color = status === 'approved' ? '#10B981' : 
                                     status === 'rejected' ? '#EF4444' : 
                                     status === 'returned' ? '#F59E0B' : '#718096';
                        
                        if (status !== 'approved') allApproved = false;
                        
                        deptStatusHTML += `
                            <span style="color:${color}; margin-right:8px; font-size:12px;">
                                ${icon} ${dept.split(' ')[0]}
                            </span>
                        `;
                    });
                    
                    if (allApproved) {
                        html += `
                            <tr>
                                <td>
                                    <a href="#" onclick="showOrderStatus(${order.id}); return false;" 
                                       style="color: #2b6cb0; text-decoration: underline; cursor: pointer; font-weight: bold;">
                                        ${order.order_number}
                                    </a>
                                </td>
                                <td>${order.order_review_number || '-'}</td>
                                <td>${order.customer_name || 'N/A'}</td>
                                <td>${order.quantity?.toLocaleString() || 0}</td>
                                <td style="font-size:12px;">${deptStatusHTML}</td>
                                <td>
                                    <button class="btn btn-success btn-sm" onclick="finalApproveOrder(${order.id})" title="Final Approve">
                                        <i class="fas fa-check-circle"></i> Final Approve
                                    </button>
                                    <button class="btn btn-info btn-sm" onclick="showOrderStatus(${order.id})" title="View Details">
                                        <i class="fas fa-eye"></i> View Details
                                    </button>
                                </td>
                            </tr>
                        `;
                    }
                }
            }
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
            return;
        }

        // 👇 For all other departments: fetch pending reviews
        console.log('🔍 Regular user - fetching pending reviews');
        const response = await fetch(`${API_URL}/reviews/pending`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            container.innerHTML = '<p class="loading">Failed to load reviews</p>';
            return;
        }

        const data = await response.json();
        console.log('📋 Pending reviews data:', data);

        if (data.length === 0) {
            container.innerHTML = `
                <div class="table-container">
                    <div style="padding:40px;text-align:center;color:#718096;">
                        <i class="fas fa-check-circle" style="font-size:48px;color:#38a169;"></i>
                        <p style="margin-top:12px;">No pending reviews for your department.</p>
                    </div>
                </div>
            `;
        } else {
            let html = `<div class="table-container"><table><thead><tr>
                <th>Order #</th>
                <th>Review #</th>
                <th>Customer</th>
                <th>Department</th>
                <th>Status</th>
                <th>Action</th>
            </tr></thead><tbody>`;
            
            data.forEach(review => {
                html += `
                    <tr>
                        <td>
                            <a href="#" onclick="showOrderStatus(${review.order_id}); return false;" 
                               style="color: #2b6cb0; text-decoration: underline; cursor: pointer; font-weight: bold;">
                                ${review.order_number || '-'}
                            </a>
                        </td>
                        <td>${review.order_review_number || '-'}</td>
                        <td>${review.customer_name || 'N/A'}</td>
                        <td>${review.department}</td>
                        <td><span class="status-badge status-in_review">Pending</span></td>
                        <td>
                            <button class="btn btn-primary btn-sm" onclick="signReview(${review.review_id}, '${review.department}')">
                                <i class="fas fa-pen"></i> Sign & Review
                            </button>
                            <button class="btn btn-info btn-sm" onclick="showOrderStatus(${review.order_id})" title="View Details">
                                <i class="fas fa-eye"></i> View Details
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        }
        
    } catch (error) {
        console.error('Error loading reviews:', error);
        container.innerHTML = '<p class="loading">Network error loading reviews: ' + error.message + '</p>';
    }
}

// ============================================
// ⭐ FINAL APPROVE ORDER (Management)
// ============================================
window.finalApproveOrder = async function(orderId) {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please login again');
        return;
    }

    // Get current user info
    try {
        const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await userResponse.json();
        
        if (user.department !== 'Management') {
            alert('❌ Only Management can do final approval!');
            return;
        }
    } catch (error) {
        alert('❌ Authentication error');
        return;
    }

    // Confirm final approval
    const confirm = window.confirm(
        '✅ FINAL APPROVAL\n\n' +
        'Are you sure you want to give FINAL APPROVAL for this order?\n' +
        'This will mark the order as COMPLETELY APPROVED.\n\n' +
        '⚠️ This action cannot be undone!'
    );
    
    if (!confirm) return;

    const comments = prompt('📝 Enter final comments (optional):', '');

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}/final-approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                comments: comments || '',
                action: 'approved'
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`✅ ORDER FINALLY APPROVED!\n\n` +
                  `Order: ${result.order.order_number}\n` +
                  `Status: ${result.order.status}\n\n` +
                  `${result.signature || 'Management approval recorded.'}`);
            loadReviews();
            loadOrders();
            loadStats();
        } else {
            alert(`❌ Error: ${result.error || 'Failed to final approve order'}`);
        }
    } catch (error) {
        alert('❌ Network error. Please make sure the backend is running.');
        console.error('Final approval error:', error);
    }
};

// ============================================
// CREATE ORDER - MULTI-STEP FORM
// ============================================

window.nextStep = function() {
    if (currentStep < TOTAL_STEPS) {
        if (currentStep === 1 && !validateStep1()) return;

        document.querySelector(`.form-step[data-step="${currentStep}"]`).style.display = 'none';
        currentStep++;
        document.querySelector(`.form-step[data-step="${currentStep}"]`).style.display = 'block';
        updateSteps();
        document.querySelector('.step-indicator').textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;

        if (currentStep === TOTAL_STEPS) {
            generateSummary();
        }
    }
};

window.prevStep = function() {
    if (currentStep > 1) {
        document.querySelector(`.form-step[data-step="${currentStep}"]`).style.display = 'none';
        currentStep--;
        document.querySelector(`.form-step[data-step="${currentStep}"]`).style.display = 'block';
        updateSteps();
        document.querySelector('.step-indicator').textContent = `Step ${currentStep} of ${TOTAL_STEPS}`;
    }
};

function updateSteps() {
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) step.classList.add('active');
        else if (stepNum < currentStep) step.classList.add('completed');
    });
}

function validateStep1() {
    const required = ['orderNumber', 'customerName', 'quantity', 'expectedDeliveryDate'];
    let valid = true;
    required.forEach(id => {
        const el = document.getElementById(id);
        if (!el.value.trim()) {
            el.style.borderColor = '#e53e3e';
            valid = false;
        } else {
            el.style.borderColor = '';
        }
    });
    if (!valid) {
        alert('Please fill in all required fields (*)');
    }
    return valid;
}

// Add material
let materialCount = 1;
window.addMaterial = function() {
    const container = document.getElementById('materialList');
    const row = document.createElement('div');
    row.className = 'material-row';
    row.innerHTML = `
        <select class="material-type">
            <option value="KRAFT LINER">KRAFT LINER</option>
            <option value="TEST LINER">TEST LINER</option>
            <option value="FLUTE LINER">FLUTE LINER</option>
            <option value="WHITE KRAFT">WHITE KRAFT</option>
        </select>
        <select class="material-gsm">
            <option value="125">125 GSM</option>
            <option value="127">127 GSM</option>
            <option value="130">130 GSM</option>
            <option value="135">135 GSM</option>
            <option value="140">140 GSM</option>
            <option value="150">150 GSM</option>
        </select>
        <input type="number" class="material-qty" placeholder="Qty (kg)" />
        <input type="text" class="material-remarks" placeholder="Remarks" />
        <button type="button" class="btn btn-danger btn-sm" onclick="removeMaterial(this)"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
    materialCount++;
};

window.removeMaterial = function(btn) {
    if (document.querySelectorAll('.material-row').length > 1) {
        btn.parentElement.remove();
    }
};

// ============================================
// ⭐ GENERATE SUMMARY - WITH FINANCE, QUALITY & COLOR FIELDS
// ============================================
function generateSummary() {
    const summary = document.getElementById('orderSummary');
    const fields = {
        'Order Number': document.getElementById('orderNumber').value,
        'Customer': document.getElementById('customerName').value,
        'Contact': document.getElementById('customerContact').value || '-',
        'Phone': document.getElementById('customerPhone').value || '-',
        'Email': document.getElementById('customerEmail').value || '-',
        'Salesperson': document.getElementById('salesperson').value || '-',
        'Quantity': document.getElementById('quantity').value,
        'Board Size': document.getElementById('boardSize').value || '-',
        'Material Combination': document.getElementById('materialCombination').value || '-',
        'Expected Delivery': document.getElementById('expectedDeliveryDate').value || '-',
        'Remarks': document.getElementById('remarks').value || '-',
        // Specification fields
        'Required Machines': document.getElementById('requiredMachines').value || '-',
        'Required Materials': document.getElementById('requiredMaterials').value || '-',
        'Required Manpower': document.getElementById('requiredManpower').value || '-',
        'Estimated Processing Days': document.getElementById('estimatedProcessingDays').value || '-',
        'Special Requirements': document.getElementById('specialRequirements').value || '-',
        'Quality Standards': document.getElementById('qualityStandards').value || '-',
        'Technical Specifications': document.getElementById('technicalSpecifications').value || '-',
        // ⭐ FINANCE FIELDS
        'Payment Terms': document.getElementById('financePaymentTerms').value || '-',
        'Customer Credit': document.getElementById('financeCustomerCredit').value || '-',
        'Budget Allocation': document.getElementById('financeBudgetAllocation').value || '-',
        'Risk Level': document.getElementById('financeRiskLevel').value || '-',
        'Profitability': document.getElementById('financeProfitability').value || '-',
        'Clearance Status': document.getElementById('financeClearanceStatus').value || '-',
        'Finance Comments': document.getElementById('financeReviewComments').value || '-',
        // ⭐ QUALITY FIELDS
        'Specification Compliance': document.getElementById('qualitySpecCompliance').value || '-',
        'Quality Requirements': document.getElementById('qualityRequirements').value || '-',
        'Printing Requirements': document.getElementById('qualityPrintingRequirements').value || '-',
        'Quality Risk Level': document.getElementById('qualityRiskLevel').value || '-',
        'Testing Requirements': document.getElementById('qualityTestingRequirements').value || '-',
        'Quality Certifications': document.getElementById('qualityCertifications').value || '-',
        'Quality Comments': document.getElementById('qualityReviewComments').value || '-',
        // ⭐ NEW COLOR FIELDS
        'Number of Colors': document.getElementById('numberOfColors').value || '-',
        'Color Type': document.getElementById('colorTypes').value || '-',
        'Colors Selected': (() => {
            const checked = document.querySelectorAll('.color-option:checked');
            return Array.from(checked).map(cb => cb.value).join(', ') || '-';
        })(),
        'Color Specifications': document.getElementById('colorSpecifications').value || '-'
    };

    let html = '';
    for (const [key, value] of Object.entries(fields)) {
        html += `<div class="summary-item"><strong>${key}:</strong> <span>${value}</span></div>`;
    }
    summary.innerHTML = html;
}

// ============================================
// REAL-TIME ORDER NUMBER CHECK (DUPLICATE DETECTION)
// ============================================
document.getElementById('orderNumber')?.addEventListener('blur', async function() {
    const orderNumber = this.value.trim();
    
    // Find or create warning element
    let warning = document.getElementById('orderNumberWarning');
    if (!warning) {
        warning = document.createElement('div');
        warning.id = 'orderNumberWarning';
        warning.className = 'order-number-warning';
        this.parentNode.appendChild(warning);
    }
    
    if (!orderNumber) {
        warning.style.display = 'none';
        warning.textContent = '';
        this.style.borderColor = '';
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        warning.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/orders/check/${encodeURIComponent(orderNumber)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.exists) {
                warning.innerHTML = `
                    ⚠️ <strong>Duplicate Order Number</strong><br>
                    Previously used on: <strong>${data.order.created_on}</strong><br>
                    Previous Review: ${data.order.review_number}<br>
                    Customer: ${data.order.customer}
                    <br><span style="color:#d69e2e;font-size:11px;">(You can still use this number, it will be flagged)</span>
                `;
                warning.style.color = '#975a16';
                warning.style.background = '#fffbeb';
                warning.style.padding = '8px 12px';
                warning.style.borderRadius = '6px';
                warning.style.border = '1px solid #f6ad55';
                warning.style.display = 'block';
                this.style.borderColor = '#d69e2e';
            } else {
                warning.innerHTML = '✅ Order number is available';
                warning.style.color = '#22543d';
                warning.style.background = '#f0fff4';
                warning.style.padding = '4px 8px';
                warning.style.borderRadius = '4px';
                warning.style.border = '1px solid #68d391';
                warning.style.display = 'block';
                this.style.borderColor = '#38a169';
            }
        }
    } catch (error) {
        console.error('Error checking order number:', error);
        warning.style.display = 'none';
    }
});

// Also check on input change (clear warning when user types)
document.getElementById('orderNumber')?.addEventListener('input', function() {
    const warning = document.getElementById('orderNumberWarning');
    if (warning) {
        warning.style.display = 'none';
        warning.textContent = '';
    }
    this.style.borderColor = '';
});

// ============================================
// ⭐ SUBMIT ORDER - UPDATED WITH FINANCE, QUALITY & COLOR FIELDS
// ============================================
document.getElementById('newOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get all field values
    const orderData = {
        // Basic Order Information
        orderNumber: document.getElementById('orderNumber').value.trim(),
        customerName: document.getElementById('customerName').value.trim(),
        customerContact: document.getElementById('customerContact').value.trim(),
        customerPhone: document.getElementById('customerPhone').value.trim(),
        customerEmail: document.getElementById('customerEmail').value.trim(),
        salesperson: document.getElementById('salesperson').value.trim(),
        quantity: parseInt(document.getElementById('quantity').value),
        boardSize: document.getElementById('boardSize').value.trim(),
        materialCombination: document.getElementById('materialCombination').value.trim(),
        expectedDeliveryDate: document.getElementById('expectedDeliveryDate').value,
        previousOrderNumber: document.getElementById('previousOrderNumber').value.trim(),
        reelSize: document.getElementById('reelSize').value.trim(),
        remarks: document.getElementById('remarks').value.trim(),
        
        // Specification Fields
        requiredMachines: document.getElementById('requiredMachines').value.trim(),
        requiredMaterials: document.getElementById('requiredMaterials').value.trim(),
        requiredManpower: document.getElementById('requiredManpower').value.trim(),
        estimatedProcessingDays: parseInt(document.getElementById('estimatedProcessingDays').value) || null,
        specialRequirements: document.getElementById('specialRequirements').value.trim(),
        qualityStandards: document.getElementById('qualityStandards').value.trim(),
        technicalSpecifications: document.getElementById('technicalSpecifications').value.trim(),
        
        // ⭐ FINANCE REVIEW FIELDS
        financePaymentTerms: document.getElementById('financePaymentTerms').value,
        financeCustomerCredit: document.getElementById('financeCustomerCredit').value,
        financeBudgetAllocation: document.getElementById('financeBudgetAllocation').value,
        financeRiskLevel: document.getElementById('financeRiskLevel').value,
        financeProfitability: document.getElementById('financeProfitability').value,
        financeClearanceStatus: document.getElementById('financeClearanceStatus').value,
        financeReviewComments: document.getElementById('financeReviewComments').value.trim(),
        
        // ⭐ QUALITY REVIEW FIELDS
        qualitySpecCompliance: document.getElementById('qualitySpecCompliance').value,
        qualityRequirements: document.getElementById('qualityRequirements').value,
        qualityPrintingRequirements: document.getElementById('qualityPrintingRequirements').value,
        qualityRiskLevel: document.getElementById('qualityRiskLevel').value,
        qualityTestingRequirements: document.getElementById('qualityTestingRequirements').value,
        qualityCertifications: document.getElementById('qualityCertifications').value,
        qualityReviewComments: document.getElementById('qualityReviewComments').value.trim(),
        
        // ⭐ NEW COLOR FIELDS
        numberOfColors: parseInt(document.getElementById('numberOfColors').value) || null,
        colorTypes: document.getElementById('colorTypes').value,
        colorOptions: (() => {
            const checked = document.querySelectorAll('.color-option:checked');
            return Array.from(checked).map(cb => cb.value).join(', ');
        })(),
        colorSpecifications: document.getElementById('colorSpecifications').value.trim(),
        
        materials: [],
        finance: {
            status: document.getElementById('financeStatus').value,
            paymentCondition: document.getElementById('paymentCondition').value,
            clearance: document.getElementById('financialClearance').value,
            remarks: document.getElementById('financeRemarks').value
        },
        quality: {
            specCompliance: document.getElementById('specCompliance').value,
            qualityRequirements: document.getElementById('qualityRequirements').value,
            printingRequirements: document.getElementById('printingRequirements').value,
            qualityRisk: document.getElementById('qualityRisk').value
        },
        technical: {
            machineAvailability: document.getElementById('machineAvailability').value,
            steamGeneration: document.getElementById('steamGeneration').value,
            gluePreparation: document.getElementById('gluePreparation').value,
            boardProduction: document.getElementById('boardProduction').value,
            boxConverting: document.getElementById('boxConverting').value,
            comments: document.getElementById('technicalComments').value
        },
        production: {
            corrugatorCapacity: document.getElementById('corrugatorCapacity').value,
            printingCapacity: document.getElementById('printingCapacity').value,
            manpowerSufficient: document.getElementById('manpowerSufficient').value,
            leadTimeSufficient: document.getElementById('leadTimeSufficient').value
        }
    };

    document.querySelectorAll('.material-row').forEach(row => {
        const type = row.querySelector('.material-type').value;
        const gsm = parseInt(row.querySelector('.material-gsm').value);
        const qty = parseFloat(row.querySelector('.material-qty').value) || 0;
        const remarks = row.querySelector('.material-remarks').value || '';
        if (type && qty > 0) {
            orderData.materials.push({ materialType: type, gsm, requiredQty: qty, remarks });
        }
    });

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(orderData)
        });

        const result = await response.json();

        if (response.ok) {
            // Check if there was a duplicate warning
            if (result.warning && result.warning.exists) {
                const prev = result.warning.previous_order;
                const count = result.warning.count || 1;
                alert(
                    `✅ Order created successfully!\n\n` +
                    `⚠️ DUPLICATE ORDER NUMBER DETECTED\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `📋 Previous Order Information:\n` +
                    `  • Order Number: ${prev.order_number}\n` +
                    `  • Review Number: ${prev.review_number}\n` +
                    `  • Created On: ${prev.created_on}\n` +
                    `  • Customer: ${prev.customer}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `This order number has been used ${count} time(s).\n` +
                    `Your new order has been created successfully.`
                );
            } else {
                alert(
                    `✅ ORDER CREATED SUCCESSFULLY!\n\n` +
                    `📋 Order: ${result.orderReviewNumber || 'N/A'}\n` +
                    `👤 Created by: ${currentUser?.name || 'Marketing'}\n` +
                    `📧 All departments have been notified.\n\n` +
                    `🔄 Each department will now review the specifications.\n` +
                    `📌 Check "My Reviews" for pending approvals.`
                );
            }
            
            // Reset form
            document.getElementById('newOrderForm').reset();
            document.querySelectorAll('.material-row').forEach((row, index) => {
                if (index > 0) row.remove();
            });
            currentStep = 1;
            document.querySelectorAll('.form-step').forEach((step, index) => {
                step.style.display = index === 0 ? 'block' : 'none';
            });
            updateSteps();
            document.querySelector('.step-indicator').textContent = 'Step 1 of 7';
            loadOrders();
            showPage('orders');
        } else {
            if (result.details) {
                alert(`❌ ${result.error}\n\n${result.message}`);
            } else {
                alert(`❌ Error: ${result.error || 'Failed to create order'}`);
            }
        }
    } catch (error) {
        alert('❌ Network error. Please make sure the backend is running.');
        console.error('Create order error:', error);
    }
});

// ============================================
// REPORTS - PDF & EXCEL (IMPROVED)
// ============================================

// ============================================
// GENERATE PDF REPORT - BY ORDER NUMBER
// ============================================
window.generateReport = async function() {
    const orderNumber = prompt(
        '📄 Generate PDF Report\n\n' +
        'Enter Order Number (e.g., ORD-2026-001):'
    );
    
    if (!orderNumber) return;
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please login again');
        return;
    }
    
    try {
        // First, get all orders to find the ID
        console.log('🔍 Searching for order:', orderNumber);
        
        const ordersResponse = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!ordersResponse.ok) {
            alert('❌ Failed to fetch orders. Please try again.');
            return;
        }
        
        const ordersData = await ordersResponse.json();
        console.log('📋 All orders:', ordersData.data);
        
        // Find the order by order_number
        const order = ordersData.data.find(o => o.order_number === orderNumber);
        
        if (!order) {
            // Show available order numbers
            const available = ordersData.data.map(o => o.order_number).join('\n  • ');
            alert(
                `❌ Order "${orderNumber}" not found.\n\n` +
                `Available Order Numbers:\n  • ${available}`
            );
            return;
        }
        
        console.log('✅ Order found:', order);
        
        // Generate PDF with the found ID
        const pdfUrl = `http://localhost:5000/api/reports/order/${order.id}/pdf?token=${token}`;
        console.log('📄 Opening PDF:', pdfUrl);
        
        // Try to open in new window
        const newWindow = window.open(pdfUrl, '_blank');
        if (!newWindow) {
            // If popup blocked, use link
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
    } catch (error) {
        alert('❌ Network error. Please make sure the backend is running.');
        console.error('PDF generation error:', error);
    }
};

// Export all orders to Excel
window.exportExcel = function() {
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Please login again');
        return;
    }
    window.open(`http://localhost:5000/api/reports/orders/excel?token=${token}`, '_blank');
};

// ============================================
// AUDIT
// ============================================

async function loadAudit() {
    const container = document.getElementById('auditList');
    container.innerHTML = '<div class="loading">Loading audit trail</div>';

    try {
        const response = await fetch(`${API_URL}/audit`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.length === 0) {
                container.innerHTML = `
                    <div class="table-container">
                        <div style="padding:40px;text-align:center;color:#718096;">
                            <p>No audit records found.</p>
                        </div>
                    </div>
                `;
            } else {
                let html = `<div class="table-container"><table><thead><tr>
                    <th>Date/Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                </tr></thead><tbody>`;
                data.forEach(log => {
                    html += `
                        <tr>
                            <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}</td>
                            <td>${log.user_name || 'System'}</td>
                            <td>${log.action || '-'}</td>
                            <td>${log.new_value || '-'}</td>
                        </tr>
                    `;
                });
                html += '</tbody></table></div>';
                container.innerHTML = html;
            }
        } else {
            container.innerHTML = '<p class="loading">Failed to load audit trail</p>';
        }
    } catch (error) {
        console.error('Error loading audit:', error);
        container.innerHTML = '<p class="loading">Network error loading audit</p>';
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('sidebar').classList.contains('open')) {
        toggleSidebar();
    }
});

console.log('📦 Unlimited Packaging Order Review System');
console.log('🔑 Backend API:', API_URL);
console.log('💡 Login: admin / Admin@123');
console.log('📊 Advanced Dashboard loaded');