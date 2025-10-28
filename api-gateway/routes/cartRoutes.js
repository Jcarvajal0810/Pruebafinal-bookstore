const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

router.use('/', createProxyMiddleware({
    target: 'http://cart-service:5000',
    changeOrigin: true
}));

module.exports = router;
