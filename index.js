const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

/**
 * Health Check & Keep-Alive Endpoint
 * Used by monitoring services (e.g., UptimeRobot) to prevent the server from sleeping.
 */
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Online",
        service: "MapleProxy",
        message: "The proxy server is actively running and ready to process video streams."
    });
});

/**
 * Main Streaming Proxy Endpoint
 * Bypasses CORS and Hotlinking protections by spoofing headers.
 * * Expected Query Parameters:
 * @param {string} url
 * @param {string} referer
 */
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const targetReferer = req.query.referer || '';

    if (!targetUrl) {
        return res.status(400).json({ 
            error: "Bad Request", 
            message: "The 'url' query parameter is missing or invalid." 
        });
    }

    try {
        const requestHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        };

        if (targetReferer) {
            requestHeaders['Referer'] = targetReferer;
            try {
                requestHeaders['Origin'] = new URL(targetReferer).origin;
            } catch (e) {
                console.warn(`[Proxy Warning] Invalid referer format provided: ${targetReferer}`);
            }
        }

        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'stream',
            headers: requestHeaders
        });

        res.set({
            'Content-Type': response.headers['content-type'] || 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        });
ut
        response.data.pipe(res);

    } catch (error) {
        console.error(`[Proxy Error] Streaming failure: ${error.message}`);
        res.status(500).json({ 
            error: "Internal Server Error", 
            message: "Failed to proxy the requested video stream. The upstream server might be blocking the request or is currently unavailable." 
        });
    }
});

app.listen(PORT, () => {
    console.log(`[MapleProxy] Engine is successfully initialized and listening on port ${PORT}`);
});