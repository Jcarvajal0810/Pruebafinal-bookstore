const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

// Allow overriding the inventory URL via env var for local development.
// In Docker the service name is `inventory` so default to that.
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || "http://inventory:8000";

router.use('/', createProxyMiddleware({
    target: INVENTORY_URL,
    changeOrigin: true
}));

module.exports = router;
