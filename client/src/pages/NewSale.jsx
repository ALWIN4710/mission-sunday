import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, CreditCard, X, Check, Loader2, Search, Printer, Tag, Edit3 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { productsService, salesService } from '../services';
import { formatINR, getErrorMessage, generateIdempotencyKey } from '../utils';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { EditPricesModal } from '../components/common/EditPricesModal';
import { AddProductModal } from '../components/common/AddProductModal';

const DEFAULT_CATEGORIES = ['All', 'Ice Cream', 'Cone', 'Milkshake', 'Mojito'];
const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash',  icon: '💵' },
  { id: 'upi',  label: 'UPI',   icon: '📱' },
  { id: 'other',label: 'Other', icon: '💳' },
];

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('ice cream')) return '🍨';
  if (cat.includes('cone')) return '🍦';
  if (cat.includes('milkshake') || cat.includes('shake')) return '🥤';
  if (cat.includes('mojito') || cat.includes('juice') || cat.includes('drink') || cat.includes('beverage') || cat.includes('tea') || cat.includes('coffee')) return '🍹';
  if (cat.includes('snack') || cat.includes('biscuit') || cat.includes('chips')) return '🍿';
  if (cat.includes('cake') || cat.includes('bake') || cat.includes('brownie') || cat.includes('pastry') || cat.includes('dessert')) return '🧁';
  return '🏷️';
};

function ReceiptModal({ sale, settings, onClose }) {
  if (!sale) return null;
  const handlePrint = () => window.print();
  return (
    <Modal isOpen={!!sale} onClose={onClose} title="Receipt" size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm">Close</button>
          <button onClick={handlePrint} className="btn-primary btn-sm gap-2">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </>
      }
    >
      <div id="receipt" className="font-mono text-sm space-y-2">
        <div className="text-center border-b pb-3 mb-3">
          <p className="font-bold text-base">Mission Sunday</p>
          <p className="text-xs text-gray-500">Thank you for your support!</p>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>ID: {sale.transactionId}</span>
          <span>{new Date(sale.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
        </div>
        <div className="border-t pt-2 mt-2 space-y-1">
          {sale.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.productName} × {item.quantity}</span>
              <span>{formatINR(item.lineTotalPaise)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatINR(sale.subtotalPaise)}</span></div>
          {sale.discountPaise > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatINR(sale.discountPaise)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatINR(sale.totalPaise)}</span></div>
          <div className="flex justify-between text-xs text-gray-500"><span>Paid via</span><span className="capitalize">{sale.paymentMethod}</span></div>
          {sale.upiReference && <div className="flex justify-between text-xs text-gray-500"><span>UPI Ref</span><span>{sale.upiReference}</span></div>}
        </div>
        <p className="text-center text-xs text-gray-400 pt-2 border-t">🙏 God bless you!</p>
      </div>
    </Modal>
  );
}

export default function NewSale() {
  const { items, addItem, updateQuantity, removeItem, clearCart, subtotalPaise, totalItems } = useCart();
  const { user, isAdmin } = useAuth();
  const { success, error } = useNotification();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [upiRef, setUpiRef] = useState('');
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadProducts = useCallback(() => {
    setLoadingProducts(true);
    productsService.getAll({ available: 'true' })
      .then((res) => setProducts(res.data.products || []))
      .catch(() => error('Failed to load products.'))
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = [
    'All',
    ...Array.from(
      new Set([
        'Ice Cream',
        'Cone',
        'Milkshake',
        'Mojito',
        ...products.map((p) => p.category).filter(Boolean),
      ])
    ),
  ];

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.flavour.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const discountPaise = Math.round((Number(discount) || 0) * 100);
  const totalPaise = Math.max(0, subtotalPaise - discountPaise);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        paymentMethod,
        upiReference: upiRef || undefined,
        discountPaise,
        idempotencyKey,
      };
      const res = await salesService.create(payload);
      setCompletedSale(res.data.sale);
      clearCart();
      setShowPayment(false);
      setDiscount('');
      setUpiRef('');
      setIdempotencyKey(generateIdempotencyKey());
      success(`Sale ${res.data.sale.transactionId} recorded!`);
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full animate-fade-in">
      {/* Product panel */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search + category tabs */}
        <div className="card p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn btn-sm btn-primary flex items-center gap-1.5 shadow-sm"
                title="Add new item to catalogue"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowPriceModal(true)}
                  className="btn btn-sm btn-secondary border-forest-200 text-forest-700 hover:bg-forest-50 flex items-center gap-1.5 shadow-sm"
                  title="Edit selling prices for all products"
                >
                  <Tag className="w-3.5 h-3.5 text-forest-600" />
                  Edit Selling Prices
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Product grid */}
        {loadingProducts ? (
          <LoadingSpinner size="lg" className="mt-10" />
        ) : filtered.length === 0 ? (
          <EmptyState title="No products found" description="Try a different category or search." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((product) => {
              const inCart = items.find((i) => i.productId === product._id);
              return (
                <button
                  key={product._id}
                  onClick={() => addItem(product)}
                  className={`card card-hover text-left group transition-all p-4 space-y-2 relative
                    ${inCart ? 'ring-2 ring-forest-500 ring-offset-1' : ''}`}
                >
                  {inCart && (
                    <span className="absolute top-2 right-2 bg-forest-700 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {inCart.quantity}
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-forest-50 flex items-center justify-center text-lg">
                    {getCategoryIcon(product.category)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{product.flavour}</p>
                    <p className="text-xs text-gray-400">{product.category}</p>
                  </div>
                  <p className="text-base font-bold text-forest-700">{formatINR(product.sellingPricePaise)}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="lg:w-80 xl:w-96 flex-shrink-0">
        <div className="card sticky top-0 flex flex-col" style={{ maxHeight: 'calc(100vh - 7rem)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Cart {totalItems > 0 && <span className="badge-forest">{totalItems}</span>}
            </h2>
            {items.length > 0 && (
              <button onClick={clearCart} className="btn-ghost btn-sm text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Cart is empty" description="Tap a product to add it." icon={ShoppingCart} />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400">{formatINR(item.sellingPricePaise)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="btn-icon btn-ghost text-gray-500 w-6 h-6">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="btn-icon btn-ghost text-gray-500 w-6 h-6">
                        <Plus className="w-3 h-3" />
                      </button>
                      <button onClick={() => removeItem(item.productId)} className="btn-icon btn-ghost text-red-400 w-6 h-6 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-800 w-16 text-right">
                      {formatINR(item.sellingPricePaise * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span><span className="font-medium">{formatINR(subtotalPaise)}</span>
                </div>
                {discountPaise > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span><span>-{formatINR(discountPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t">
                  <span>Total</span><span>{formatINR(totalPaise)}</span>
                </div>
              </div>

              <button
                onClick={() => setShowPayment(true)}
                className="btn-primary btn-lg w-full mt-4"
              >
                <CreditCard className="w-4 h-4" />
                Proceed to Payment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Modal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        title="Complete Payment"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowPayment(false)} className="btn-secondary btn-sm" disabled={submitting}>Cancel</button>
            <button onClick={handleCheckout} disabled={submitting || items.length === 0} className="btn-primary btn-sm">
              {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</> : <><Check className="w-3.5 h-3.5" /> Confirm Sale</>}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Payment method */}
          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${paymentMethod === m.id ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-forest-300'}`}
                >
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* UPI reference */}
          {paymentMethod === 'upi' && (
            <div>
              <label className="label">UPI Reference (optional)</label>
              <input
                type="text"
                placeholder="Transaction ID or UTR"
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                className="input"
              />
            </div>
          )}

          {/* Discount */}
          <div>
            <label className="label">Discount (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="input"
            />
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Items</span><span>{totalItems}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span>{formatINR(subtotalPaise)}</span></div>
            {discountPaise > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-{formatINR(discountPaise)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="text-forest-700">{formatINR(totalPaise)}</span></div>
            <div className="flex justify-between text-xs text-gray-400"><span>Payment</span><span className="capitalize">{paymentMethod}</span></div>
          </div>
        </div>
      </Modal>

      {/* Receipt modal */}
      <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />

      {/* Edit Prices modal */}
      <EditPricesModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        onSuccess={loadProducts}
      />

      {/* Add New Item modal */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadProducts}
        existingCategories={categories}
      />
    </div>
  );
}
