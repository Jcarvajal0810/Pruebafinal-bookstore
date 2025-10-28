import { useState, useEffect } from 'react';

export default function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState({ items: [] });

  // Autenticación local (simple): token + user guardados en localStorage
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [showCart, setShowCart] = useState(false);

  const API_GATEWAY_URL = 'http://localhost:4500';

  useEffect(() => {
    fetchBooks();
  }, []);

  // Cuando cambia el usuario (login), obtenemos el carrito
  useEffect(() => {
    if (user && user.id) fetchCart();
  }, [user]);

  const login = async (username, password) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(`${API_GATEWAY_URL}/users/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setLoginError(data.error || 'Login failed');
        return null;
      }
      const token = data.token;
      const usr = data.user;
      // Guardar en localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(usr));
      setToken(token);
      setUser(usr);
      setShowLogin(false);
      return usr;
    } catch (err) {
      setLoginError(err.message || 'Login error');
      console.error('Login error', err);
      return null;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setCart({ items: [] });
  };

  const fetchCart = async () => {
    if (!user || !user.id) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_GATEWAY_URL}/cart/${user.id}`, { headers });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setCart(data);
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  };

  const addToCart = async (book) => {
    if (!user || !user.id) {
      setShowLogin(true);
      return;
    }
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${API_GATEWAY_URL}/cart/add`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: user.id,
          book_id: book._id,
          title: book.name,
          price: book.price,
          quantity: 1,
        }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Error adding to cart: ${response.status} ${txt}`);
      }

      const updatedCart = await response.json();
      setCart(updatedCart);
    } catch (err) {
      console.error('Error adding to cart:', err);
      alert('No se pudo agregar al carrito: ' + (err.message || err));
    }
  };

  const fetchBooks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_GATEWAY_URL}/catalog/api/books`);
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setBooks(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching books:', err);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar cantidad de un item en el carrito
  const updateCartItem = async (book_id, quantity) => {
    if (!user || !user.id) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch(`${API_GATEWAY_URL}/cart/update`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ user_id: user.id, book_id, quantity }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const updated = await res.json();
      setCart(updated);
    } catch (err) {
      console.error('Error updating cart item:', err);
    }
  };

  const removeFromCart = async (book_id) => {
    if (!user || !user.id) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_GATEWAY_URL}/cart/remove/${book_id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const updated = await res.json();
      setCart(updated);
    } catch (err) {
      console.error('Error removing item from cart:', err);
    }
  };

  const clearUserCart = async () => {
    if (!user || !user.id) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_GATEWAY_URL}/cart/clear/${user.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const updated = await res.json();
      setCart(updated);
    } catch (err) {
      console.error('Error clearing cart:', err);
    }
  };

  // Checkout simple: crea una orden por cada item y luego limpia el carrito
  const checkout = async () => {
    if (!user || !user.id) {
      setShowLogin(true);
      return;
    }
    if (!cart.items || cart.items.length === 0) {
      alert('El carrito está vacío');
      return;
    }
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      // Crear una orden por cada item (el Order Service actual maneja item único)
      for (const it of cart.items) {
        const body = {
          userId: user.id,
          book_id: it.book_id || it.book_id,
          quantity: it.quantity,
          price: it.price,
        };
        const res = await fetch(`${API_GATEWAY_URL}/order/api/orders`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Order error ${res.status}: ${txt}`);
        }
        // podríamos procesar pago aquí llamando a /payment
      }
      // Si todo OK, limpiar carrito
      await clearUserCart();
      alert('Checkout completado (órdenes creadas).');
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Error en checkout: ' + (err.message || err));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="p-6 text-white bg-indigo-600 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-4xl font-bold">📚 Libreria Telematica</h1>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => setShowLogin(false)}
                  className="px-4 py-2 text-white bg-indigo-700 rounded-lg hover:bg-indigo-800"
                >
                  Hola, {user.username}
                </button>
                <button
                  onClick={logout}
                  className="px-3 py-2 text-indigo-700 bg-white rounded-lg hover:bg-indigo-100"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-2 text-indigo-700 bg-white rounded-lg hover:bg-indigo-100"
              >
                Login
              </button>
            )}

            <button
              onClick={() => setShowCart(true)}
              className="flex items-center px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              🛒 Carrito ({cart.items?.length || 0})
            </button>
          </div>
        </div>
      </header>

      <main className="container p-8 mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Catálogo de Libros</h2>
          <div className="flex gap-3">
            <button
              onClick={fetchBooks}
              className="px-4 py-2 text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              🔄 Recargar
            </button>
          </div>
        </div>

        {loading && (
          <div className="py-12 text-center">
            <div className="inline-block w-12 h-12 border-b-2 border-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Cargando libros...</p>
          </div>
        )}

        {error && (
          <div className="px-6 py-4 text-red-800 border border-red-200 rounded-lg bg-red-50">
            <h3 className="mb-2 font-bold">Error al cargar los libros</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && books.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {books.map((book) => (
              <div
                key={book._id}
                className="p-6 transition-shadow duration-300 bg-white rounded-lg shadow-md hover:shadow-xl"
              >
                {book.image && (
                  <img src={book.image} alt={book.name} className="object-cover w-full h-48 mb-4 rounded-md" />
                )}
                <h3 className="mb-2 text-xl font-bold text-gray-900">{book.name}</h3>
                <p className="mb-2 text-gray-600">por {book.author}</p>
                <p className="mb-3 text-sm text-gray-500">{book.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-indigo-600">${book.price.toLocaleString()}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">Stock: {book.countInStock}</span>
                    <button
                      onClick={() => addToCart(book)}
                      disabled={book.countInStock === 0}
                      className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Agregar al carrito
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && books.length === 0 && (
          <div className="py-12 text-center bg-white rounded-lg shadow">
            <p className="text-lg text-gray-600">No hay libros en el catálogo</p>
          </div>
        )}
      </main>

      <footer className="p-4 mt-12 text-center text-white bg-gray-800">
        <p>© 2025 BookStore. Todos los derechos reservados.</p>
      </footer>

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-md p-6 bg-white rounded-lg">
            <h3 className="mb-4 text-xl font-bold">Iniciar sesión</h3>
            {loginError && <p className="mb-2 text-sm text-red-600">{loginError}</p>}
            <LoginForm onSubmit={login} loading={loginLoading} onCancel={() => setShowLogin(false)} />
          </div>
        </div>
      )}

      {/* Cart modal */}
      {typeof showCart !== 'undefined' && showCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-2xl p-6 bg-white rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Tu carrito</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCart(false)} className="px-3 py-1 text-sm bg-gray-200 rounded">Cerrar</button>
                <button onClick={clearUserCart} className="px-3 py-1 text-sm bg-red-500 text-white rounded">Vaciar</button>
              </div>
            </div>
            <div className="space-y-4">
              {cart.items && cart.items.length > 0 ? (
                cart.items.map((it) => (
                  <div key={it.book_id || it.bookId || it.title} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-semibold">{it.title}</div>
                      <div className="text-sm text-gray-600">${(it.price || 0).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        value={it.quantity}
                        onChange={(e) => updateCartItem(it.book_id || it.bookId, Number(e.target.value))}
                        className="w-20 p-1 border rounded"
                      />
                      <button onClick={() => removeFromCart(it.book_id || it.bookId)} className="px-3 py-1 text-white bg-red-600 rounded">Eliminar</button>
                    </div>
                  </div>
                ))
              ) : (
                <p>El carrito está vacío.</p>
              )}
            </div>
            <div className="flex items-center justify-between mt-6">
              <div className="text-lg font-bold">Total: ${((cart.items || []).reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)).toLocaleString()}</div>
              <div className="flex gap-3">
                <button onClick={clearUserCart} className="px-4 py-2 bg-gray-200 rounded">Vaciar</button>
                <button onClick={checkout} className="px-4 py-2 text-white bg-indigo-600 rounded">Pagar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Componentes auxiliares simples ---
function LoginForm({ onSubmit, loading, onCancel }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(username, password);
      }}
    >
      <label className="block mb-2 text-sm">Usuario</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-2 mb-3 border rounded" />
      <label className="block mb-2 text-sm">Contraseña</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 mb-4 border rounded" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
        <button type="submit" disabled={loading} className="px-4 py-2 text-white bg-indigo-600 rounded">{loading ? 'Entrando...' : 'Entrar'}</button>
      </div>
    </form>
  );
}