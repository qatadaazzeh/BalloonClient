import express from 'express';
import cors from 'cors';
import https from 'https';
import PrintingService from './printingService.js';

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const app = express();
const PORT = process.env.PORT || 3001;


const printingService = new PrintingService();

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3000'],
    credentials: true
}));


app.use(express.json());


app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.post('/api/contest-proxy', (req, res) => {
    const { apiUrl, username, password } = req.body;

    if (!apiUrl || !username || !password) {
        return res.status(400).json({
            error: 'Missing required parameters: apiUrl, username, password'
        });
    }

    console.log('📊 Proxying fetch request to:', apiUrl);

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    let baseUrl;
    try {
        baseUrl = new URL(apiUrl);
        if (!baseUrl.pathname.endsWith('/contest/')) {
            if (baseUrl.pathname.endsWith('/contest')) {
                baseUrl.pathname += '/';
            } else if (!baseUrl.pathname.includes('/contest/')) {
                baseUrl.pathname = baseUrl.pathname.replace(/\/$/, '') + '/contest/';
            }
        }
    } catch (urlError) {
        console.error('❌ Invalid API URL:', apiUrl, urlError);
        return res.status(400).json({ error: 'Invalid API URL provided' });
    }

    const endpoints = [
        'problems',
        'teams',
        'runs',
        'submissions',
        'judgements',
        '',
    ];

    const fetchEndpoint = (endpoint) => {
        return new Promise((resolve, reject) => {
            const endpointUrl = new URL(baseUrl);
            endpointUrl.pathname += endpoint;

            const options = {
                hostname: endpointUrl.hostname,
                port: endpointUrl.port || (endpointUrl.protocol === 'https:' ? 443 : 80),
                path: `${endpointUrl.pathname}${endpointUrl.search}`,
                method: 'GET',
                headers: {
                    'Authorization': authHeader,
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; Contest-Proxy/1.0)',
                },
                rejectUnauthorized: false,
                timeout: 10000
            };

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';

                if (proxyRes.statusCode !== 200) {
                    console.warn(`⚠️ ${endpoint} returned ${proxyRes.statusCode}`);
                    resolve({ endpoint, error: `HTTP ${proxyRes.statusCode}`, data: null });
                    return;
                }

                proxyRes.on('data', (chunk) => {
                    data += chunk;
                });

                proxyRes.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({ endpoint, data: jsonData, error: null });
                    } catch (parseError) {
                        console.error(`❌ Failed to parse ${endpoint}:`, parseError);
                        resolve({ endpoint, error: 'Parse error', data: null });
                    }
                });
            });

            proxyReq.on('error', (error) => {
                console.error(`❌ Error fetching ${endpoint}:`, error.message);
                resolve({ endpoint, error: error.message, data: null });
            });

            proxyReq.on('timeout', () => {
                console.error(`⏱️ Timeout fetching ${endpoint}`);
                proxyReq.destroy();
                resolve({ endpoint, error: 'Timeout', data: null });
            });

            proxyReq.end();
        });
    };


    Promise.all(endpoints.map(fetchEndpoint))
        .then(results => {
            const response = {
                baseUrl: baseUrl.toString(),
                timestamp: new Date().toISOString(),
                data: {},
                errors: {}
            };

            results.forEach(result => {
                const endPoint = result.endpoint === "" ? "info" : result.endpoint
                if (result.error) {

                    response.errors[endPoint] = result.error;
                } else {
                    response.data[endPoint] = result.data;
                }
            });

            console.log(`✅ Fetched ${Object.keys(response.data).length} endpoints successfully`);
            res.json(response);
        })
        .catch(error => {
            console.error('❌ Unexpected error:', error);
            res.status(500).json({
                error: 'Unexpected error',
                message: error.message
            });
        });
});


app.get('/api/printers', async (req, res) => {
    try {
        const printers = printingService.getPrinters();
        res.json(printers);
    } catch (error) {
        console.error('❌ Error fetching printers:', error);
        res.status(500).json({ error: 'Failed to fetch printers', message: error.message });
    }
});

app.post('/api/printers/refresh', async (req, res) => {
    try {
        const printers = await printingService.refreshPrintersFromAPI();
        res.json(printers);
    } catch (error) {
        console.error('❌ Error refreshing printers:', error);
        res.status(500).json({ error: 'Failed to refresh printers', message: error.message });
    }
});

app.post('/api/print/balloon', async (req, res) => {
    try {
        const { deliveryData, printConfig } = req.body;

        if (!deliveryData) {
            return res.status(400).json({ error: 'Missing delivery data' });
        }

        console.log('🖨️ Print request received for:', deliveryData.team, '- Problem', deliveryData.problemLetter);

        const result = await printingService.printBalloonDelivery(deliveryData, printConfig);

        console.log('✅ Print job completed successfully');
        res.json({
            success: true,
            message: 'Balloon delivery printed successfully',
            ...result
        });
    } catch (error) {
        console.error('❌ Print error:', error);
        res.status(500).json({
            error: 'Failed to print balloon delivery',
            message: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Contest Proxy Server running on port ${PORT}`);
    console.log(`📡 Proxy endpoint: http://localhost:${PORT}/api/contest-proxy`);
    console.log(`🖨️ Print endpoint: http://localhost:${PORT}/api/print/balloon`);
    console.log(`🖨️ Printers endpoint: http://localhost:${PORT}/api/printers`);
    console.log(`🔒 SSL certificate verification: DISABLED (allows self-signed certificates)`);
});

export default app;
