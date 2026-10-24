import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewSale from './pages/NewSale';
import SalesHistory from './pages/SalesHistory';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import TeamSettings from './pages/TeamSettings';

const PAGE_TITLES = {
  '/':            'Dashboard',
  '/new-sale':    'New Sale',
  '/sales':       'Sales History',
  '/inventory':   'Inventory',
  '/expenses':    'Expenses',
  '/analytics':   'Analytics',
  '/reports':     'Reports',
  '/settings':    'Team & Settings',
};

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Mission Sunday';

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/new-sale"  element={<NewSale />} />
              <Route path="/sales"     element={<SalesHistory />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/expenses"  element={<Expenses />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/reports"   element={<Reports />} />
              <Route path="/settings"  element={<ProtectedRoute adminOnly><TeamSettings /></ProtectedRoute>} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </NotificationProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
