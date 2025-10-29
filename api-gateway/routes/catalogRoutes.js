const express = require('express');
const axios = require('axios');
const router = express.Router();

// Allow overriding the catalog URL via env var for local development.
// In Docker the service name is `catalog` so default to that.
const CATALOG_URL = process.env.CATALOG_URL || "http://catalog:3000";

// Obtener todos los libros
router.get('/', async (req, res) => {
  try {
    const response = await axios.get(`${CATALOG_URL}/api/books`); // Agrega /api
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Error consultando catálogo" });
  }
});

// Detalle de libro por ID
router.get('/:id', async (req, res) => {
  try {
    const response = await axios.get(`${CATALOG_URL}/api/books/${req.params.id}`); // Agrega /api
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Error consultando libro" });
  }
});

module.exports = router;