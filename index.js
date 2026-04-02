const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable Cross-Origin Resource Sharing for all routes
app.use(cors());

/**
 * Health Check & Keep-Alive Endpoint
 * Utilized by uptime monitoring services to ensure the instance remains active.
 */
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Operational",
        service: "MapleProxy Edge Node",
        message: "The streaming proxy infrastructure is currently active and processing requests optimally."
    });
});

/**
 * Primary Streaming Proxy Endpoint
 * Facilitates media streaming by bypassing CORS restrictions and mitigating hotlink protection via header spoofing.
 * 
 * Expected Query Parameters:
 * @param {string} url - The target HLS/M3U8 media URL.
 * @param {string} referer - The origin referer to bypass hotlink restrictions (optional).
 */
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const targetReferer = req.query.referer || '';

    if (!targetUrl) {
        return res.status(400).json({ 
            error: "Bad Request", 
            message: "A valid 'url' query parameter is strictly required for this operation." 
        });
    }

    try {
        // Construct required HTTP headers to emulate a standard browser request
        const requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        };

        // Inject Referer and Origin headers if a referer is provided
        if (targetReferer) {
            requestHeaders['Referer'] = targetReferer;
            try {
                requestHeaders['Origin'] = new URL(targetReferer).origin;
            } catch (validationError) {
                console.warn(`[Proxy Warning] Malformed referer encountered and bypassed: ${targetReferer}`);
            }
        }

        // Initiate a stream request to the upstream media server
        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'stream',
            headers: requestHeaders
        });

        // Reconstruct and forward essential response headers
        res.set({
            'Content-Type': response.headers['content-type'] || 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        });

        // Pipe the upstream media stream directly to the client
        response.data.pipe(res);

        // Handle upstream stream errors to prevent memory leaks or server crashes
        response.data.on('error', (streamError) => {
            console.error(`[Proxy Stream Error] Interruption during media transmission: ${streamError.message}`);
            if (!res.headersSent) {
                res.status(502).json({ 
                    error: "Bad Gateway", 
                    message: "Upstream media stream encountered an unexpected termination." 
                });
            }
        });

    } catch (error) {
        const statusCode = error.response ? error.response.status : 500;
        console.error(`[Proxy Gateway Error] Upstream request failed with status ${statusCode}: ${error.message}`);
        
        if (!res.headersSent) {
            res.status(statusCode).json({ 
                error: "Gateway Exception", 
                message: "Unable to establish a reliable connection to the upstream media server. It may be blocking the request or currently unavailable." 
            });
        }
    }
});

// Initialize the Express server
app.listen(PORT, () => {
    console.info(`[MapleProxy Service] Engine initialized successfully. Listening for inbound traffic on port ${PORT}.`);
});
