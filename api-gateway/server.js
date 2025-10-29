const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas de microservicios
app.use('/users', require('./routes/userRoutes'));
app.use('/catalog', require('./routes/catalogRoutes'));
app.use('/cart', require('./routes/cartRoutes'));
app.use('/order', require('./routes/orderRoutes'));
app.use('/payment', require('./routes/paymentRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));

// Helpful root endpoint so GET / doesn't return Cannot GET /
app.get('/', (req, res) => {
  res.json({
    status: 'API Gateway running',
    routes: [
      '/users/* -> user-service',
      '/catalog/* -> catalog service',
      '/cart/* -> cart service',
      '/order/* -> order service',
      '/payment/* -> payment service',
      '/api/inventory/* -> inventory service'
    ]
  });
});

// Alias: allow calls to /api/auth/* to reach the user service directly
// (some clients call /api/auth/status without the /users prefix).
app.use('/api/auth', require('./routes/userRoutes'));

const PORT = 4500;
app.listen(PORT, () => {
  console.log(`✅ API Gateway corriendo en http://localhost:${PORT}`);
});
