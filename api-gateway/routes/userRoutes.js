const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

// Allow overriding the user service URL via env var for local development.
// In Docker the service name is `user-service` so default to that.
const USER_URL = process.env.USER_SERVICE_URL || "http://user-service:6000";

router.use('/', createProxyMiddleware({
    target: USER_URL,
    changeOrigin: true
}));

module.exports = router;
