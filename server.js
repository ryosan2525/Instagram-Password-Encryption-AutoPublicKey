const http = require('http');
const url = require('url');
const { encryptPassword } = require('./instagram_enc');

const PORT = process.env.PORT || 3000;

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
        const keyId = queryObject.keyId;
        const publicKey = queryObject.publicKey;
        const version = queryObject.version || '10';

        if (!password) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing password parameter' }));
            return;
        }

        if (!keyId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing keyId parameter' }));
            return;
        }

        if (!publicKey) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing publicKey parameter' }));
            return;
        }

        encryptPassword(password, version, keyId, publicKey)
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
        res.end(JSON.stringify({
            error: 'Not Found. Use /encrypt?password=YOUR_PASSWORD&keyId=YOUR_KEY_ID&publicKey=YOUR_PUBLIC_KEY&version=10'
        }));
    }
};

const server = http.createServer(requestHandler);

server.listen(PORT, (err) => {
    if (err) {
        return console.log('something bad happened', err);
    }
    console.log(`Server is listening on port ${PORT}`);
});