const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

// Allow overriding the order URL via env var for local development.
// In Docker the service name is `order` so default to that.
const ORDER_URL = process.env.ORDER_SERVICE_URL || "http://order:4000";

// The order service expects requests to /api/orders/*
router.use('/', createProxyMiddleware({
    target: ORDER_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/order': '/api/orders'  // /order -> /api/orders
    }
}));

module.exports = router;
