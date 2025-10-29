const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

// Allow overriding the cart URL via env var for local development.
// In Docker the service name is `cart` so default to that.
const CART_URL = process.env.CART_SERVICE_URL || "http://cart:5000";

router.use('/', createProxyMiddleware({
    target: CART_URL,
    changeOrigin: true
}));
module.exports = router;
