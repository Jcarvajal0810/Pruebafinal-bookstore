const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

// Allow overriding the payment URL via env var for local development.
// In Docker the service name is `payment` so default to that.
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL || "http://payment:7000";

// The payment service expects requests to /api/payments/*
router.use('/', createProxyMiddleware({
    target: PAYMENT_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/payment': '/api/payments'  // /payment -> /api/payments
    }
}));

module.exports = router;
