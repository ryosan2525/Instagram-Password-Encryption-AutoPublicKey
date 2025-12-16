const http = require('http');
const https = require('https');
const url = require('url');
const { encryptPassword } = require('./instagram_enc');

const PORT = process.env.PORT || 3000;

// Fallback keys (Update these if they change and dynamic fetch fails)
// Last Updated: 2025-12-16
const FALLBACK_KEYS = {
    keyId: '170',
    publicKey: '76588afa109d44bd3a90d0e9e679b4f6b1658034a8e431482331bcec5aefca4d',
    version: '10'
};

function fetchInstagramKeys() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.instagram.com',
            path: '/accounts/login/',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                // Mimic browser Accept
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        };

        const req = https.request(options, (res) => {
            const keyIdHeader = res.headers['ig-set-password-encryption-web-key-id'];
            const pubKeyHeader = res.headers['ig-set-password-encryption-web-pub-key'];
            const versionHeader = res.headers['ig-set-password-encryption-web-key-version'];

            if (keyIdHeader && pubKeyHeader) {
                resolve({
                    keyId: keyIdHeader,
                    publicKey: pubKeyHeader,
                    version: versionHeader || '10'
                });
                req.fullData = '';
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const keyIDMatch = data.match(/"key_id":"(\d+)"/);
                const publicKeyMatch = data.match(/"public_key":"([a-f0-9]+)"/);
                const versionMatch = data.match(/"version":"(\d+)"/);

                if (keyIDMatch && publicKeyMatch) {
                    resolve({
                        keyId: keyIDMatch[1],
                        publicKey: publicKeyMatch[1],
                        version: versionMatch ? versionMatch[1] : '10'
                    });
                } else {
                    const configMatch = data.match(/encryption":\{"key_id":"(\d+)","public_key":"([a-f0-9]+)"/);
                    if (configMatch) {
                        resolve({
                            keyId: configMatch[1],
                            publicKey: configMatch[2],
                            version: '10'
                        });
                    } else {
                        // Log the error but resolve with fallback
                        console.error(`[Warning] Dynamic fetch failed (Status: ${res.statusCode}). Using fallback keys.`);
                        resolve(FALLBACK_KEYS);
                    }
                }
            });
        });

        req.on('error', (e) => {
            console.error(`[Warning] Network error during fetch: ${e.message}. Using fallback keys.`);
            resolve(FALLBACK_KEYS);
        });
        req.end();
    });
}

const requestHandler = (req, res) => {
    const queryObject = url.parse(req.url, true).query;
    const pathname = url.parse(req.url, true).pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathname === '/encrypt' && req.method === 'GET') {
        const password = queryObject.password;

        if (!password) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing password parameter' }));
            return;
        }

        fetchInstagramKeys()
            .then(keys => {
                return encryptPassword(password, keys.version, keys.keyId, keys.publicKey);
            })
            .then(encryptedPassword => {
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    encrypted_password: encryptedPassword
                }));
            })
            .catch(err => {
                console.error('Encryption Error:', err);
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: err.message
                }));
            });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found. Use /encrypt?password=YOUR_PASSWORD' }));
    }
};

const server = http.createServer(requestHandler);

server.listen(PORT, (err) => {
    if (err) {
        return console.log('something bad happened', err);
    }
    console.log(`Server is listening on port ${PORT}`);
});
