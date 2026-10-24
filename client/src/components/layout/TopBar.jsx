import { Menu, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';

export function TopBar({ onMenuClick, title }) {
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 sm:px-6 py-3.5 flex items-center gap-3">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <h1 className="text-base font-semibold text-gray-800 flex-1">{title}</h1>

      {/* Cart badge (visible when items are in cart) */}
      {totalItems > 0 && (
        <Link
          to="/new-sale"
          className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-forest-700 text-white text-sm font-medium hover:bg-forest-800 transition-colors"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{totalItems} item{totalItems > 1 ? 's' : ''}</span>
        </Link>
      )}
    </header>
  );
}
