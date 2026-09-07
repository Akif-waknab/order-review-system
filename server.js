// ============================================
// UNLIMITED PACKAGING PLC.
// AUTO-START SERVER LAUNCHER - ULTRA CLEAN
// ============================================

const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');

const app = express();
const PORT = 8080;

// Check if a port is in use
function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer()
            .once('error', function() { resolve(true); })
            .once('listening', function() {
                server.close();
                resolve(false);
            })
            .listen(port);
    });
}

// Start backend server
async function startBackend() {
    const isRunning = await isPortInUse(5000);
    if (isRunning) {
        console.log('✅ Backend already running on port 5000');
        return true;
    }
    
    console.log('🚀 Starting Backend Server...');
    const backendPath = path.join(__dirname, 'backend');
    
    if (!fs.existsSync(backendPath)) {
        console.log('❌ Backend folder not found:', backendPath);
        return false;
    }
    
    try {
        const backend = spawn('cmd', ['/c', 'npm run dev'], {
            cwd: backendPath,
            detached: true,
            stdio: 'ignore',
            shell: true
        });
        backend.unref();
        console.log('✅ Backend started on port 5000');
        return true;
    } catch (error) {
        console.error('❌ Failed to start backend:', error.message);
        return false;
    }
}

// Start frontend server
async function startFrontend() {
    const isRunning = await isPortInUse(3000);
    if (isRunning) {
        console.log('✅ Frontend already running on port 3000');
        return true;
    }
    
    console.log('🚀 Starting Frontend Server...');
    const frontendPath = path.join(__dirname, 'frontend');
    
    if (!fs.existsSync(frontendPath)) {
        console.log('❌ Frontend folder not found:', frontendPath);
        return false;
    }
    
    const indexPath = path.join(frontendPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.log('❌ index.html not found in frontend folder');
        return false;
    }
    
    const methods = [
        { cmd: 'python -m http.server 3000', name: 'python' },
        { cmd: 'python3 -m http.server 3000', name: 'python3' },
        { cmd: 'npx serve -p 3000', name: 'serve' },
        { cmd: 'http-server -p 3000', name: 'http-server' }
    ];
    
    for (const method of methods) {
        try {
            console.log(`   Trying: ${method.name}...`);
            const frontend = spawn('cmd', ['/c', method.cmd], {
                cwd: frontendPath,
                detached: true,
                stdio: 'ignore',
                shell: true
            });
            
            await new Promise(function(resolve) { setTimeout(resolve, 2000); });
            
            const running = await isPortInUse(3000);
            if (running) {
                console.log(`✅ Frontend started on port 3000 using ${method.name}`);
                frontend.unref();
                return true;
            } else {
                frontend.kill();
                console.log(`   ⚠️ ${method.name} didn't start, trying next...`);
            }
        } catch (error) {
            console.log(`   ❌ ${method.name} failed:`, error.message);
        }
    }
    
    console.log('❌ All frontend start methods failed');
    console.log('💡 Please start frontend manually:');
    console.log('   cd frontend && python -m http.server 3000');
    return false;
}

// Start everything
async function startAll() {
    console.log('🚀 Starting Order Review System...');
    console.log('📌 Working directory:', __dirname);
    
    const backendStarted = await startBackend();
    await new Promise(function(resolve) { setTimeout(resolve, 3000); });
    const frontendStarted = await startFrontend();
    
    if (backendStarted && frontendStarted) {
        console.log('✅ System started successfully!');
        console.log('📌 Backend:  http://localhost:5000');
        console.log('📌 Frontend: http://localhost:3000');
        console.log('🌐 Opening browser...');
        setTimeout(function() {
            exec('start http://localhost:3000');
        }, 2000);
        return true;
    } else if (backendStarted && !frontendStarted) {
        console.log('⚠️ Backend started but Frontend failed');
        console.log('💡 Open frontend manually:');
        console.log('   cd frontend && python -m http.server 3000');
        return false;
    } else {
        console.log('⚠️ Failed to start system');
        return false;
    }
}

// ⭐ ULTRA CLEAN HTML - Only buttons, no status
app.get('/', function(req, res) {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Review System</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #2c5282 100%);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    background: white;
                    padding: 50px 40px;
                    border-radius: 16px;
                    text-align: center;
                    max-width: 420px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .logo { font-size: 72px; margin-bottom: 10px; }
                h1 { color: #1a365d; font-size: 22px; margin-bottom: 4px; }
                .subtitle { color: #718096; font-size: 13px; margin-bottom: 30px; }
                .btn {
                    width: 100%;
                    padding: 14px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    margin-bottom: 10px;
                }
                .btn:hover { transform: translateY(-2px); }
                .btn-success { background: #38a169; color: white; }
                .btn-success:hover { background: #2f855a; box-shadow: 0 4px 12px rgba(56, 161, 105, 0.3); }
                .btn-primary { background: #2b6cb0; color: white; }
                .btn-primary:hover { background: #1a365d; box-shadow: 0 4px 12px rgba(43, 108, 176, 0.3); }
                .btn-group { display: flex; gap: 10px; }
                .btn-group .btn { flex: 1; margin-bottom: 0; }
                .version { margin-top: 20px; font-size: 11px; color: #a0aec0; }
            </style>
            <script>
                function openApp() {
                    window.open('http://localhost:3000', '_blank');
                }
                
                function openAPI() {
                    window.open('http://localhost:5000', '_blank');
                }
            </script>
        </head>
        <body>
            <div class="container">
                <div class="logo">📦</div>
                <h1>Unlimited Packaging Plc.</h1>
                <p class="subtitle">Order Review System</p>
                
                <button class="btn btn-success" onclick="openApp()">
                    🌐 Open Application
                </button>
                
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="openAPI()">
                        🔧 API
                    </button>
                </div>
                
                <div class="version">v2.0.0</div>
            </div>
        </body>
        </html>
    `);
});

// API endpoint to start the system
app.post('/start', function(req, res) {
    console.log('🚀 Start request received');
    startAll().then(function(success) {
        res.json({ 
            success: success, 
            message: success ? 'System started successfully' : 'Some services failed to start'
        });
    }).catch(function(error) {
        console.error('❌ Start error:', error);
        res.json({ success: false, message: error.message });
    });
});

// API endpoint to stop the system
app.post('/stop', function(req, res) {
    console.log('🛑 Stop request received');
    exec('for /f "tokens=5" %a in (\'netstat -aon ^| find ":5000" ^| find "LISTENING"\') do taskkill /F /PID %a', function(error) {});
    exec('for /f "tokens=5" %a in (\'netstat -aon ^| find ":3000" ^| find "LISTENING"\') do taskkill /F /PID %a', function(error) {});
    res.json({ success: true, message: 'Stop command sent' });
});

// Start the launcher server
app.listen(PORT, function() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║   📦 UNLIMITED PACKAGING PLC.                               ║');
    console.log('║   ORDER REVIEW SYSTEM LAUNCHER                              ║');
    console.log('║                                                              ║');
    console.log('║   🚀 Launcher running at: http://localhost:8080             ║');
    console.log('║                                                              ║');
    console.log('║   📌 Open your application:                                 ║');
    console.log('║      • Frontend: http://localhost:3000                      ║');
    console.log('║      • Backend:  http://localhost:5000                      ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
});

// Open browser automatically after 2 seconds
setTimeout(function() {
    console.log('🌐 Opening browser...');
    exec('start http://localhost:8080');
}, 2000);