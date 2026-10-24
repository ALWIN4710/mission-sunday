import { useState, useEffect } from 'react';
import { Plus, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { productsService } from '../../services';
import { useNotification } from '../../context/NotificationContext';
import { rupeesToPaise, formatINR, getErrorMessage } from '../../utils';

const DEFAULT_CATEGORIES = ['Ice Cream', 'Cone', 'Milkshake', 'Mojito'];
const STOCK_UNITS = [
  { value: 'piece', label: 'Piece / Item' },
  { value: 'cup', label: 'Cup' },
  { value: 'cone', label: 'Cone' },
  { value: 'glass', label: 'Glass' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'plate', label: 'Plate' },
  { value: 'pack', label: 'Pack' },
];

export function AddProductModal({ isOpen, onClose, onSuccess, existingCategories = [] }) {
  const { success, error } = useNotification();

  // Combine default categories with any existing ones from the system
  const allCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...existingCategories.filter((c) => c && c !== 'All')])
  );

  const [category, setCategory] = useState(allCategories[0] || 'Ice Cream');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [flavour, setFlavour] = useState('');
  const [customName, setCustomName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [initialStock, setInitialStock] = useState('50');
  const [stockUnit, setStockUnit] = useState('cup');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCategory(allCategories[0] || 'Ice Cream');
      setIsCustomCategory(false);
      setCustomCategory('');
      setFlavour('');
      setCustomName('');
      setSellingPrice('');
      setCostPrice('');
      setInitialStock('50');
      setStockUnit('cup');
      setLowStockThreshold('10');
      setFormError('');
    }
  }, [isOpen]);

  const activeCategory = isCustomCategory ? customCategory.trim() : category;
  const displayName = customName.trim() || (flavour.trim() ? `${flavour.trim()} ${activeCategory}` : '');

  const sellingNum = parseFloat(sellingPrice) || 0;
  const costNum = parseFloat(costPrice) || 0;
  const profitMargin = sellingNum > 0 ? ((sellingNum - costNum) / sellingNum) * 100 : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!activeCategory) {
      setFormError('Please select or specify a category.');
      return;
    }
    if (!flavour.trim()) {
      setFormError('Item / flavour name is required.');
      return;
    }
    if (sellingPrice === '' || isNaN(sellingNum) || sellingNum < 0) {
      setFormError('Please enter a valid selling price.');
      return;
    }
    if (costPrice !== '' && (isNaN(costNum) || costNum < 0)) {
      setFormError('Cost price must be a positive number.');
      return;
    }
    const stockQty = parseInt(initialStock, 10);
    if (isNaN(stockQty) || stockQty < 0) {
      setFormError('Opening stock must be 0 or greater.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: displayName,
        category: activeCategory,
        flavour: flavour.trim(),
        sellingPricePaise: rupeesToPaise(sellingNum),
        costPricePaise: costPrice !== '' ? rupeesToPaise(costNum) : 0,
        stockUnit,
        initialStock: stockQty,
        lowStockThreshold: parseInt(lowStockThreshold, 10) || 10,
      };

      const res = await productsService.create(payload);
      success(`Added "${res.data.product?.name || flavour}" to catalogue!`);
      if (onSuccess) onSuccess(res.data.product);
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      setFormError(msg);
      error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Item to Sales Catalogue"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary btn-sm flex items-center gap-1.5"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Adding Item...
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{formError}</span>
          </div>
        )}

        {/* Category Selection */}
        <div>
          <label className="label">Category</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setIsCustomCategory(false);
                  if (cat === 'Ice Cream') setStockUnit('cup');
                  else if (cat === 'Cone') setStockUnit('cone');
                  else if (cat === 'Milkshake') setStockUnit('cup');
                  else if (cat === 'Mojito') setStockUnit('glass');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  !isCustomCategory && category === cat
                    ? 'bg-forest-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustomCategory(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isCustomCategory
                  ? 'bg-forest-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              + New Category
            </button>
          </div>

          {isCustomCategory && (
            <input
              type="text"
              placeholder="e.g. Snacks, Bakery, Fresh Juice, Desserts"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="input text-sm mt-1"
              autoFocus
              required
            />
          )}
        </div>

        {/* Flavour / Item Name */}
        <div>
          <label className="label">Item / Flavour Name *</label>
          <input
            type="text"
            placeholder="e.g. Belgian Chocolate, Tender Coconut, Blue Curacao"
            value={flavour}
            onChange={(e) => setFlavour(e.target.value)}
            className="input text-sm"
            required
          />
        </div>

        {/* Price Row (Selling & Cost) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Selling Price (₹) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 50"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="input pl-7 text-sm font-semibold text-gray-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="label">Cost Price (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 25"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="input pl-7 text-sm text-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Margin Preview */}
        {sellingNum > 0 && costNum > 0 && (
          <div className="bg-forest-50/70 border border-forest-100 rounded-xl p-2.5 flex items-center justify-between text-xs text-forest-800">
            <span>Estimated Profit per item:</span>
            <span className="font-semibold">
              ₹{(sellingNum - costNum).toFixed(2)} ({profitMargin.toFixed(0)}% margin)
            </span>
          </div>
        )}

        {/* Stock & Unit Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Opening Stock (Units) *</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="50"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              className="input text-sm"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Available immediately to sell</p>
          </div>

          <div>
            <label className="label">Unit Type</label>
            <select
              value={stockUnit}
              onChange={(e) => setStockUnit(e.target.value)}
              className="select text-sm"
            >
              {STOCK_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product display preview */}
        {flavour.trim() && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Card Preview in Sales:</p>
              <p className="text-sm font-semibold text-gray-800">
                {displayName}
              </p>
              <p className="text-xs text-gray-500">
                Category: {activeCategory} • Stock: {initialStock || 0} {stockUnit}s
              </p>
            </div>
            {sellingNum > 0 && (
              <span className="text-base font-bold text-forest-700">
                {formatINR(rupeesToPaise(sellingNum))}
              </span>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
