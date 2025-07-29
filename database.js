const fs = require('fs');
const path = require('path');

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

  // Promotions methods
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

module.exports = Database;