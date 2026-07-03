/**
 * media.112 - Simple HTTP Server
 * Run: node server.js
 * Access: http://localhost:8080 or http://[your-ip]:8080
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Sanitize URL — strip query string and prevent path traversal
    const urlPath = req.url.split('?')[0].split('#')[0];
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(ROOT, safePath === '/' ? 'index.html' : safePath);

    // Ensure resolved path stays within ROOT (path traversal guard)
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(path.join(ROOT, 'index.html'), (e, c) => {
                    res.writeHead(200, {
                        'Content-Type': 'text/html',
                        'X-Content-Type-Options': 'nosniff',
                        'X-Frame-Options': 'DENY'
                    });
                    res.end(c);
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, {
                'Content-Type': contentType,
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            });
            res.end(content);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let ip = 'localhost';

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ip = iface.address;
                break;
            }
        }
    }

    console.log('\n========================================');
    console.log('  media.112 Server');
    console.log('========================================');
    console.log(`\n  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${ip}:${PORT}`);
    console.log('\n  Akses dari HP (WiFi sama):');
    console.log(`  → http://${ip}:${PORT}`);
    console.log('\n  Tekan Ctrl+C untuk stop server');
    console.log('========================================\n');
});
