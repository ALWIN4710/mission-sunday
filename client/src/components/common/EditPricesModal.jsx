import { useState, useEffect } from 'react';
import { Tag, Loader2, Save, X, Search, Check, RefreshCw } from 'lucide-react';
import { Modal } from './Modal';
import { productsService } from '../../services';
import { useNotification } from '../../context/NotificationContext';
import { formatINR, rupeesToPaise, getErrorMessage } from '../../utils';

export function EditPricesModal({ isOpen, onClose, onSuccess, initialProducts = [] }) {
  const { success, error } = useNotification();
  const [products, setProducts] = useState([]);
  const [priceMap, setPriceMap] = useState({}); // { [productId]: { selling: number, cost: number } }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await productsService.getAll();
      const list = res.data?.products || [];
      setProducts(list);
      const initialMap = {};
      list.forEach((p) => {
        initialMap[p._id] = {
          selling: (p.sellingPricePaise / 100).toString(),
          cost: (p.costPricePaise / 100).toString(),
        };
      });
      setPriceMap(initialMap);
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      setSearch('');
      setSelectedCategory('All');
    }
  }, [isOpen]);

  const handlePriceChange = (id, field, value) => {
    setPriceMap((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    // Validate
    const payload = [];
    for (const [id, values] of Object.entries(priceMap)) {
      const sellingNum = parseFloat(values.selling);
      const costNum = parseFloat(values.cost || 0);

      if (isNaN(sellingNum) || sellingNum <= 0) {
        return error('Selling price must be a valid amount greater than ₹0.');
      }

      payload.push({
        id,
        sellingPricePaise: rupeesToPaise(sellingNum),
        costPricePaise: rupeesToPaise(costNum),
      });
    }

    setSaving(true);
    try {
      await productsService.updateBatchPrices(payload);
      success('Product selling prices updated successfully.');
      onSuccess?.();
      onClose();
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const categories = ['All', 'Ice Cream', 'Cone', 'Milkshake', 'Mojito'];

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      !search ||
      p.flavour.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Product Selling Prices"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-gray-500">
            Total {products.length} products · Prices update live across POS and reports
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving Prices...' : 'Save All Prices'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 max-w-full">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedCategory === c
                    ? 'bg-forest-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search flavours..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
          </div>
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-forest-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No products match your filter.</div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase sticky top-0 border-b border-gray-100 z-10">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Current Price</th>
                  <th className="px-4 py-3">New Selling Price (₹)</th>
                  <th className="px-4 py-3">Cost Price (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((product) => {
                  const currentVals = priceMap[product._id] || { selling: '0', cost: '0' };
                  const isModified =
                    parseFloat(currentVals.selling) !== product.sellingPricePaise / 100;

                  return (
                    <tr
                      key={product._id}
                      className={`hover:bg-gray-50/70 transition-colors ${
                        isModified ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-gray-900 flex items-center gap-2">
                        <span className="text-base">
                          {product.category === 'Ice Cream'
                            ? '🍨'
                            : product.category === 'Cone'
                            ? '🍦'
                            : product.category === 'Milkshake'
                            ? '🥤'
                            : '🍹'}
                        </span>
                        <span>{product.flavour}</span>
                      </td>

                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        <span className="px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 font-medium">
                          {product.category}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 text-xs text-gray-400 line-through">
                        {formatINR(product.sellingPricePaise)}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="relative w-28">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={currentVals.selling}
                            onChange={(e) =>
                              handlePriceChange(product._id, 'selling', e.target.value)
                            }
                            className={`w-full pl-6 pr-2 py-1.5 rounded-lg border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-forest-500 transition-all ${
                              isModified
                                ? 'border-amber-400 bg-amber-50 text-amber-900'
                                : 'border-gray-200 text-gray-800'
                            }`}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={currentVals.cost}
                            onChange={(e) =>
                              handlePriceChange(product._id, 'cost', e.target.value)
                            }
                            className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-forest-400"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
