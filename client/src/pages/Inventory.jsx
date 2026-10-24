import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, AlertTriangle, TrendingDown, Package, Loader2, Tag, Edit3 } from 'lucide-react';
import { inventoryService } from '../services';
import { formatINR, formatDateTime, getErrorMessage } from '../utils';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { EditPricesModal } from '../components/common/EditPricesModal';
import { AddProductModal } from '../components/common/AddProductModal';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useForm } from 'react-hook-form';

const MOVEMENT_TYPES = [
  { value: 'opening',           label: 'Opening Stock',    add: true },
  { value: 'adjustment_add',    label: 'Add Adjustment',   add: true },
  { value: 'adjustment_remove', label: 'Remove Adjustment', add: false },
  { value: 'wastage',           label: 'Wastage',          add: false },
  { value: 'refund_return',     label: 'Refund Return',    add: true },
];

function AdjustmentModal({ isOpen, onClose, products, onSuccess }) {
  const { error, success } = useNotification();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await inventoryService.createMovement({
        productId: data.productId,
        movementType: data.movementType,
        quantity: Math.abs(parseInt(data.quantity, 10)),
        notes: data.notes,
      });
      success('Stock movement recorded.');
      reset();
      onSuccess();
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Stock Movement" size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm" disabled={loading}>Cancel</button>
          <button form="adj-form" type="submit" className="btn-primary btn-sm" disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </button>
        </>
      }
    >
      <form id="adj-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Product</label>
          <select {...register('productId', { required: 'Product required' })} className={`select ${errors.productId ? 'input-error' : ''}`}>
            <option value="">Select product...</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.flavour} {p.category}</option>)}
          </select>
          {errors.productId && <p className="error-text">{errors.productId.message}</p>}
        </div>
        <div>
          <label className="label">Movement Type</label>
          <select {...register('movementType', { required: 'Type required' })} className={`select ${errors.movementType ? 'input-error' : ''}`}>
            <option value="">Select type...</option>
            {MOVEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {errors.movementType && <p className="error-text">{errors.movementType.message}</p>}
        </div>
        <div>
          <label className="label">Quantity</label>
          <input type="number" min="1" placeholder="e.g. 50" {...register('quantity', { required: 'Quantity required', min: { value: 1, message: 'Min 1' } })} className={`input ${errors.quantity ? 'input-error' : ''}`} />
          {errors.quantity && <p className="error-text">{errors.quantity.message}</p>}
        </div>
        <div>
          <label className="label">Notes</label>
          <input type="text" placeholder="Optional notes..." {...register('notes')} className="input" />
        </div>
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const { isAdmin } = useAuth();
  const { error: showError } = useNotification();
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [movPage, setMovPage] = useState(1);
  const [movPages, setMovPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAdj, setShowAdj] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tab, setTab] = useState('stock');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, movRes] = await Promise.all([
        inventoryService.getAll(),
        inventoryService.getMovements({ page: movPage, limit: 30 }),
      ]);
      setInventory(invRes.data.inventory || []);
      setMovements(movRes.data.movements || []);
      setMovPages(movRes.data.pages || 1);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [movPage]);

  useEffect(() => { load(); }, [load]);

  const lowStock = inventory.filter((p) => p.isLowStock);
  const totalValue = inventory.reduce((s, p) => s + p.currentStock * p.costPricePaise, 0);

  const products = inventory.map((p) => ({ _id: p._id, flavour: p.flavour, category: p.category }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <p className="kpi-label">Total Products</p>
          <p className="kpi-value">{inventory.length}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Low Stock</p>
          <p className="kpi-value text-red-500">{lowStock.length}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Stock Value</p>
          <p className="kpi-value">{formatINR(totalValue)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Total Units</p>
          <p className="kpi-value">{inventory.reduce((s, p) => s + Math.max(0, p.currentStock), 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <div className="card border-yellow-200 bg-yellow-50 flex items-start gap-3 p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Low stock alert</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              {lowStock.map((p) => `${p.flavour} ${p.category} (${p.currentStock})`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Tabs + action */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex rounded-xl border border-gray-200 p-0.5 bg-gray-50">
          {['stock', 'movements'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? 'bg-white shadow-sm text-forest-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'stock' ? 'Current Stock' : 'Movement History'}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} className="btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn-primary btn-sm flex items-center gap-1.5"
                title="Add new product to catalogue and stock"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
              <button
                type="button"
                onClick={() => setShowPriceModal(true)}
                className="btn-secondary btn-sm border-forest-200 text-forest-700 hover:bg-forest-50"
                title="Edit selling prices for all products"
              >
                <Tag className="w-3.5 h-3.5 text-forest-600" />
                Edit Selling Prices
              </button>
              <button onClick={() => setShowAdj(true)} className="btn-secondary btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Record Movement
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner size="lg" className="mt-10" /> : tab === 'stock' ? (
        <div className="card p-0">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Current Stock</th>
                  <th>Selling Price</th>
                  <th>Cost Price</th>
                  <th>Threshold</th>
                  <th>Stock Value</th>
                  <th>Status</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item._id}>
                    <td className="font-medium">{item.flavour} {item.category}</td>
                    <td><span className="badge-forest">{item.category}</span></td>
                    <td className="text-gray-400 text-xs">{item.stockUnit}</td>
                    <td className={`font-semibold ${item.isLowStock ? 'text-red-500' : 'text-gray-800'}`}>{item.currentStock}</td>
                    <td><span className="font-bold text-forest-700">{formatINR(item.sellingPricePaise)}</span></td>
                    <td className="text-gray-500 text-xs">{formatINR(item.costPricePaise)}</td>
                    <td className="text-gray-400">{item.lowStockThreshold}</td>
                    <td>{formatINR(item.currentStock * item.costPricePaise)}</td>
                    <td>
                      {item.isLowStock
                        ? <span className="badge-red flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Low Stock</span>
                        : <span className="badge-green">OK</span>
                      }
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setShowPriceModal(true)}
                          className="px-2.5 py-1 text-xs font-medium text-forest-700 bg-forest-50 hover:bg-forest-100 rounded-lg transition-colors inline-flex items-center gap-1 shadow-sm"
                          title="Edit price"
                        >
                          <Edit3 className="w-3 h-3" /> Edit Price
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-0">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Quantity</th><th>Notes</th><th>By</th></tr></thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan="6"><EmptyState title="No movements" /></td></tr>
                ) : movements.map((m) => (
                  <tr key={m._id}>
                    <td className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    <td className="font-medium text-sm">{m.productId?.flavour} {m.productId?.category}</td>
                    <td><span className="badge-gray capitalize">{m.movementType.replace('_', ' ')}</span></td>
                    <td className={`font-semibold ${m.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="text-gray-400 text-xs">{m.notes || '—'}</td>
                    <td className="text-xs">{m.performedBy?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pb-4">
            <Pagination page={movPage} pages={movPages} onPage={setMovPage} />
          </div>
        </div>
      )}

      <AdjustmentModal isOpen={showAdj} onClose={() => setShowAdj(false)} products={products} onSuccess={() => { setShowAdj(false); load(); }} />
      <EditPricesModal isOpen={showPriceModal} onClose={() => setShowPriceModal(false)} onSuccess={load} />
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={load}
        existingCategories={Array.from(new Set(inventory.map((p) => p.category)))}
      />
    </div>
  );
}
