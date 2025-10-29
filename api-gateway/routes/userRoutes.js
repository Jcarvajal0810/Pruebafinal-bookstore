const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');
const router = express.Router();

// Allow overriding the user service URL via env var for local development.
// In Docker the service name is `user-service` so default to that.
const USER_URL = process.env.USER_SERVICE_URL || "http://user-service:6000";

// The user service expects requests to /api/auth/* and /api/users/*
router.use('/', createProxyMiddleware({
    target: USER_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/users': '/api/users',  // /users/xyz -> /api/users/xyz
        '^/api/auth': '/api/auth' // /api/auth/xyz -> /api/auth/xyz (preserve)
    }
}));

module.exports = router;
