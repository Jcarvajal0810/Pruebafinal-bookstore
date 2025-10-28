require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

// ====== CONFIGURACIÓN DE VARIABLES Y VERIFICACIÓN ======
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(' ERROR: Falta la variable MONGO_URI en el entorno.');
  process.exit(1);
}

// ====== CONEXIÓN A MONGODB ATLAS ======
mongoose
  .connect(MONGO_URI)
  .then(() => console.log(' Conectado a MongoDB Atlas - Order Service'))
  .catch((err) => {
    console.error(' Error conectando a MongoDB Atlas:', err.message);
    process.exit(1);
  });

// ====== CONSTANTES Y MODELO DE ORDEN ======

// ====== ESTADOS PERMITIDOS ======
const VALID_STATUSES = ['CREATED', 'PAID', 'SHIPPED', 'DELIVERED', 'FAILED'];

// ====== MODELO DE ORDEN ======
const orderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    // support either single-item orders (legacy) or multi-item
    book_id: { type: String },
    items: [
      {
        book_id: String,
        quantity: Number,
        price: Number,
      },
    ],
    quantity: { type: Number },
    price: { type: Number },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: VALID_STATUSES,
      default: 'CREATED',
    },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'orders' }
);

const Order = mongoose.model('Order', orderSchema);

// ====== ENDPOINTS DE LA API (RUTAS) ======

// Obtener todas las órdenes
app.get('/api/orders', async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// Obtener una orden por ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });
    res.json(order);
  } catch {
    res.status(400).json({ message: 'ID inválido' });
  }
});

// Obtener órdenes por usuario
app.get('/api/orders/user/:userId', async (req, res) => {
  const orders = await Order.find({ userId: req.params.userId });
  res.json(orders);
});

// Crear nueva orden
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, book_id, quantity, price } = req.body;

    // Validación básica
    if (!userId || !book_id || !quantity || !price) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    const total = quantity * price;
    const newOrder = new Order({ userId, book_id, quantity, price, total });

    const savedOrder = await newOrder.save();
    res.status(201).json(savedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Checkout orquestado (reservas -> pago -> limpieza)
app.post('/api/orders/checkout', async (req, res) => {
  /* Expected body:
    {
      userId: string,
      items: [{ book_id, quantity, price }],
      buyerEmail: string,
      paymentCard: { cardNumber, cardHolder } // minimal for payment simulation
    }
  */
  const axios = require('axios');
  const { userId, items, buyerEmail, paymentCard } = req.body;
  if (!userId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Faltan userId o items' });
  }

  // 1) Reservar stock en Inventory Service
  const reserved = [];
  try {
    for (const it of items) {
      const resp = await axios.post('http://inventory:8000/api/inventory/reserve', {
        book_id: it.book_id,
        quantity: it.quantity,
      }, { timeout: 5000 });

      if (!resp.data || resp.data.success !== true) {
        // rollback previous
        for (const r of reserved) {
          try {
            await axios.post('http://inventory:8000/api/inventory/release', { book_id: r.book_id, quantity: r.quantity });
          } catch (e) {
            console.error('Error releasing stock during rollback', e.message || e);
          }
        }
        return res.status(409).json({ message: `No hay stock para el libro ${it.book_id}` });
      }
      reserved.push({ book_id: it.book_id, quantity: it.quantity });
    }

    // 2) Crear orden en DB
    const total = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
    const newOrder = new Order({ userId, items, total });
    const savedOrder = await newOrder.save();

    // 3) Crear pago en Payment Service
    const paymentResp = await axios.post('http://payment:7000/api/payments/create', {
      UserID: userId,
      OrderID: savedOrder._id.toString(),
      Amount: total,
      BuyerEmail: buyerEmail || 'unknown@example.com',
      Description: `Pago orden ${savedOrder._id}`,
    }, { timeout: 5000 });

    const payment = paymentResp.data;
    if (!payment || !payment.Reference) {
      throw new Error('Error creando pago');
    }

    // 4) Procesar pago (simulación síncrona) - requiere datos de tarjeta
    if (!paymentCard || !paymentCard.cardNumber || !paymentCard.cardHolder) {
      // Release reservations and mark order failed
      for (const r of reserved) {
        try { await axios.post('http://inventory:8000/api/inventory/release', { book_id: r.book_id, quantity: r.quantity }); } catch(e){}
      }
      await Order.findByIdAndUpdate(savedOrder._id, { status: 'FAILED' });
      return res.status(400).json({ message: 'Faltan datos de tarjeta para procesar el pago' });
    }

    const procResp = await axios.post(`http://payment:7000/api/payments/${payment.Reference}/process`, paymentCard, { timeout: 15000 });
    const proc = procResp.data;
    if (!proc || proc.Status !== 'APPROVED' && proc.status !== 'APPROVED' && proc.Status !== 'APPROVED') {
      // Pago fallido: liberar reservas
      for (const r of reserved) {
        try { await axios.post('http://inventory:8000/api/inventory/release', { book_id: r.book_id, quantity: r.quantity }); } catch(e){}
      }
      await Order.findByIdAndUpdate(savedOrder._id, { status: 'FAILED' });
      return res.status(402).json({ message: 'Pago rechazado', payment: proc });
    }

    // 5) Pago OK: actualizar orden a PAID
    const updatedOrder = await Order.findByIdAndUpdate(savedOrder._id, { status: 'PAID' }, { new: true });

    // 6) Limpiar carrito del usuario (intentar, pero no bloquear si falla)
    try {
      await axios.delete(`http://cart:5000/api/cart/clear/${userId}`);
    } catch (e) {
      console.error('Error clearing cart after payment:', e.message || e);
    }

    // 7) Responder con orden y pago
    return res.json({ order: updatedOrder, payment: proc });
  } catch (err) {
    console.error('Checkout error:', err.message || err);
    return res.status(500).json({ message: 'Error en checkout', error: err.message || err });
  }
});

// Actualizar estado de orden
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    // Validar que el estado sea permitido
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Estado inválido. Los estados válidos son: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const updated = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Orden no encontrada' });
    res.json(updated);
  } catch {
    res.status(400).json({ message: 'ID inválido o error de actualización' });
  }
});

// Eliminar una orden
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const deleted = await Order.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Orden no encontrada' });
    res.json({ message: 'Orden eliminada con éxito' });
  } catch {
    res.status(400).json({ message: 'ID inválido' });
  }
});

// ====== INICIAR SERVIDOR ======
app.listen(PORT, () => {
  console.log(` Order service corriendo en el puerto ${PORT}`);
});