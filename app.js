const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Production settings
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.onrender.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('.'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Database class
class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'database.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading database:', error);
      return {
        products: [],
        orders: [],
        customers: [],
        settings: {},
        categories: []
      };
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving database:', error);
      return false;
    }
  }

  // Products methods
  getProducts() {
    return this.data.products || [];
  }

  getProduct(id) {
    return this.data.products.find(p => p.id == id);
  }

  addProduct(product) {
    if (!this.data.products) this.data.products = [];
    
    // Generate ID if not provided
    if (!product.id) {
      const maxId = Math.max(...this.data.products.map(p => parseInt(p.id) || 0), 0);
      product.id = maxId + 1;
    }
    
    product.created_at = new Date().toISOString();
    this.data.products.push(product);
    this.save();
    return product;
  }

  updateProduct(id, updates) {
    const index = this.data.products.findIndex(p => p.id == id);
    if (index !== -1) {
      this.data.products[index] = { ...this.data.products[index], ...updates };
      this.save();
      return this.data.products[index];
    }
    return null;
  }

  deleteProduct(id) {
    const index = this.data.products.findIndex(p => p.id == id);
    if (index !== -1) {
      const deleted = this.data.products.splice(index, 1)[0];
      this.save();
      return deleted;
    }
    return null;
  }

  getProductsByPromotion(promotion) {
    return this.data.products.filter(product => product.promotion === promotion);
  }

  // Orders methods
  getOrders() {
    return this.data.orders || [];
  }

  getOrder(id) {
    return this.data.orders.find(o => o.id == id);
  }

  addOrder(order) {
    if (!this.data.orders) this.data.orders = [];
    
    // Generate ID and queue code
    const maxId = Math.max(...this.data.orders.map(o => parseInt(o.id) || 0), 0);
    order.id = maxId + 1;
    order.queueCode = this.generateQueueCode();
    order.created_at = new Date().toISOString();
    order.status = order.status || 'pending';
    
    this.data.orders.push(order);
    this.save();
    return order;
  }

  updateOrderStatus(id, status) {
    const index = this.data.orders.findIndex(o => o.id == id);
    if (index !== -1) {
      this.data.orders[index].status = status;
      this.data.orders[index].updated_at = new Date().toISOString();
      this.save();
      return this.data.orders[index];
    }
    return null;
  }

  generateQueueCode() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const orderCount = this.data.orders.filter(o => 
      o.created_at && o.created_at.startsWith(today.toISOString().slice(0, 10))
    ).length + 1;
    return `${dateStr}-${orderCount.toString().padStart(3, '0')}`;
  }

  // Customers methods
  getCustomers() {
    return this.data.customers || [];
  }

  addCustomer(customer) {
    if (!this.data.customers) this.data.customers = [];
    
    // Check if customer exists
    const existing = this.data.customers.find(c => 
      c.phone === customer.phone || c.email === customer.email
    );
    
    if (existing) {
      return existing;
    }
    
    const maxId = Math.max(...this.data.customers.map(c => parseInt(c.id) || 0), 0);
    customer.id = maxId + 1;
    customer.created_at = new Date().toISOString();
    
    this.data.customers.push(customer);
    this.save();
    return customer;
  }

  // Settings methods
  getSettings() {
    return this.data.settings || {};
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
    return this.data.settings;
  }

  // Categories/Promotions methods
  getPromotions() {
    return this.data.categories || [];
  }

  addPromotion(promotion) {
    if (!this.data.categories) this.data.categories = [];
    
    const existingIndex = this.data.categories.findIndex(c => c.id === promotion.id);
    if (existingIndex >= 0) {
      this.data.categories[existingIndex] = promotion;
    } else {
      this.data.categories.push(promotion);
    }
    
    this.save();
    return promotion;
  }

  // Search methods
  searchProducts(query) {
    const products = this.getProducts();
    return products.filter(product => 
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(query.toLowerCase())) ||
      (product.category && product.category.toLowerCase().includes(query.toLowerCase()))
    );
  }

  // Stock management
  updateStock(productId, newStock) {
    const product = this.getProduct(productId);
    if (product) {
      product.stock = newStock;
      this.save();
      return product;
    }
    return null;
  }

  decreaseStock(productId, quantity = 1) {
    const product = this.getProduct(productId);
    if (product && product.stock >= quantity) {
      product.stock -= quantity;
      this.save();
      return product;
    }
    return null;
  }
}

const db = new Database();

// API Routes

// Products API
app.get('/api/products', (req, res) => {
  try {
    const products = db.getProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.getProduct(req.params.id);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const product = db.addProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const product = db.updateProduct(req.params.id, req.body);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const product = db.deleteProduct(req.params.id);
    if (product) {
      res.json({ message: 'Product deleted successfully' });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Orders API
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.getOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.getOrder(req.params.id);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    // Validate stock before creating order
    const { items } = req.body;
    for (const item of items) {
      const product = db.getProduct(item.product_id);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.product_id} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
    }

    // Create order
    const order = db.addOrder(req.body);
    
    // Update stock
    for (const item of items) {
      db.decreaseStock(item.product_id, item.quantity);
    }
    
    // Add customer if provided
    if (req.body.customer) {
      db.addCustomer(req.body.customer);
    }
    
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const order = db.updateOrderStatus(req.params.id, req.body.status);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customers API
app.get('/api/customers', (req, res) => {
  try {
    const customers = db.getCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const customer = db.addCustomer(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings API
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const settings = db.updateSettings(req.body);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Promotions API
app.get('/api/promotions', (req, res) => {
  try {
    const promotions = db.getPromotions();
    res.json(promotions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/promotion/:promotion', (req, res) => {
  try {
    const products = db.getProductsByPromotion(req.params.promotion);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/promotions', (req, res) => {
  try {
    const promotion = db.addPromotion(req.body);
    res.status(201).json(promotion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search API
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Query parameter required' });
    }
    const results = db.searchProducts(q);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stock management API
app.patch('/api/products/:id/stock', (req, res) => {
  try {
    const { stock } = req.body;
    const product = db.updateStock(req.params.id, stock);
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File upload API
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files
app.use('/uploads', express.static('uploads'));

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/s1', (req, res) => {
  res.sendFile(path.join(__dirname, 's1.html'));
});

app.get('/s2', (req, res) => {
  res.sendFile(path.join(__dirname, 's2.html'));
});

app.get('/s3', (req, res) => {
  res.sendFile(path.join(__dirname, 's3.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

app.get('/payment', (req, res) => {
  res.sendFile(path.join(__dirname, 'payment.html'));
});

app.get('/confirm', (req, res) => {
  res.sendFile(path.join(__dirname, 'confirm.html'));
});

app.get('/review', (req, res) => {
  res.sendFile(path.join(__dirname, 'review.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database loaded with ${db.getProducts().length} products`);
  console.log(`📦 Orders: ${db.getOrders().length}`);
  console.log(`👥 Customers: ${db.getCustomers().length}`);
});

module.exports = app;
