import api from './api';

export const authService = {
  login:  (credentials) => api.post('/auth/login', credentials),
  logout: ()            => api.post('/auth/logout'),
  getMe:  ()            => api.get('/auth/me'),
};

export const productsService = {
  getAll:            (params) => api.get('/products', { params }),
  create:            (data)   => api.post('/products', data),
  update:            (id, data) => api.patch(`/products/${id}`, data),
  updateBatchPrices: (prices) => api.put('/products/batch-prices', { prices }),
  toggleStatus:      (id)     => api.patch(`/products/${id}/status`),
};

export const salesService = {
  create:       (data)   => api.post('/sales', data),
  getAll:       (params) => api.get('/sales', { params }),
  getById:      (id)     => api.get(`/sales/${id}`),
  createRefund: (id, data) => api.post(`/sales/${id}/refunds`, data),
  exportCSV:    (params) => api.get('/sales/export', { params, responseType: 'blob' }),
};

export const inventoryService = {
  getAll:         (params) => api.get('/inventory', { params }),
  getMovements:   (params) => api.get('/inventory/movements', { params }),
  createMovement: (data)   => api.post('/inventory/movements', data),
  createPurchase: (data)   => api.post('/inventory/purchases', data),
};

export const expensesService = {
  getAll:  (params) => api.get('/expenses', { params }),
  create:  (data)   => api.post('/expenses', data),
  update:  (id, data) => api.patch(`/expenses/${id}`, data),
};

export const dashboardService = {
  getSummary: (params) => api.get('/dashboard/summary', { params }),
  reset:      ()       => api.post('/dashboard/reset'),
};

export const analyticsService = {
  getSalesTrend:    (params) => api.get('/analytics/sales', { params }),
  getCategories:    (params) => api.get('/analytics/categories', { params }),
  getProducts:      (params) => api.get('/analytics/products', { params }),
  getHourly:        (params) => api.get('/analytics/hourly', { params }),
  getVolunteers:    (params) => api.get('/analytics/volunteers', { params }),
};

export const reportsService = {
  getSalesReport:          (params) => api.get('/reports/sales', { params }),
  getProfitLossReport:     (params) => api.get('/reports/profit-loss', { params }),
  getReconciliationReport: (params) => api.get('/reports/reconciliation', { params }),
  getInventoryReport:      (params) => api.get('/reports/inventory', { params }),
  downloadCSV:             (type, params) => api.get(`/reports/${type}/download`, { params, responseType: 'blob' }),
};

export const usersService = {
  getAll:  ()        => api.get('/users'),
  create:  (data)    => api.post('/users', data),
  update:  (id, data) => api.patch(`/users/${id}`, data),
};

export const settingsService = {
  get:    ()     => api.get('/settings'),
  update: (data) => api.patch('/settings', data),
};
