import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Receipt, Package, DollarSign,
  BarChart3, FileText, Settings, LogOut, Menu, X, Leaf
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const NAV_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/new-sale',     icon: ShoppingCart,    label: 'New Sale' },
  { to: '/sales',        icon: Receipt,         label: 'Sales History' },
  { to: '/inventory',    icon: Package,         label: 'Inventory' },
  { to: '/expenses',     icon: DollarSign,      label: 'Expenses' },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics' },
  { to: '/reports',     icon: FileText,         label: 'Reports' },
];

const ADMIN_ITEMS = [
  { to: '/settings', icon: Settings, label: 'Team & Settings', adminOnly: true },
];

function NavItem({ to, icon: Icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end={to === '/'}
      className={({ isActive }) =>
        `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export function Sidebar({ mobileOpen, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const { success } = useNotification();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    success('Logged out successfully.');
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-forest-600/30">
        <div className="w-9 h-9 rounded-xl bg-sand-300/20 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-sand-200" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-wide">Mission Sunday</p>
          <p className="text-xs text-forest-300">Sales Management</p>
        </div>
        {/* Mobile close */}
        <button onClick={onClose} className="ml-auto text-forest-300 hover:text-white lg:hidden">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} onClick={onClose} />
        ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs font-semibold text-forest-400 uppercase tracking-widest">Admin</p>
            </div>
            {ADMIN_ITEMS.map((item) => (
              <NavItem key={item.to} {...item} onClick={onClose} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-forest-600/30 px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-sand-300/20 flex items-center justify-center text-sand-200 font-semibold text-sm flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-forest-300 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-forest-300 hover:text-white transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-forest-800 flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <aside className="relative z-50 flex flex-col w-64 bg-forest-800 h-full animate-fade-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
