const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

// Allow overriding the catalog URL via env var for local development.
// In Docker the service name is `catalog` so default to that.
const CATALOG_URL = process.env.CATALOG_URL || "http://catalog:3000";

// The catalog service expects requests to /api/books/*
router.use('/', createProxyMiddleware({
    target: CATALOG_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/catalog': '/api/books'  // /catalog -> /api/books
    }
}));

module.exports = router;