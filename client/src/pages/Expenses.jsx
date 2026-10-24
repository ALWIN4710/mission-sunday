import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, DollarSign, Loader2 } from 'lucide-react';
import { expensesService } from '../services';
import { formatINR, formatDate, getErrorMessage, todayIST } from '../utils';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { Pagination } from '../components/common/Pagination';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useForm } from 'react-hook-form';

const EXPENSE_CATEGORIES = [
  'Ingredients', 'Ice Cream Supplies', 'Milk & Dairy', 'Cups & Packaging',
  'Cones', 'Beverages', 'Transport', 'Equipment', 'Miscellaneous',
];

function ExpenseModal({ isOpen, onClose, onSuccess }) {
  const { error, success } = useNotification();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { date: todayIST() } });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await expensesService.create({
        ...data,
        amountPaise: Math.round(parseFloat(data.amount) * 100),
        date: data.date,
      });
      success('Expense recorded.');
      reset({ date: todayIST() });
      onSuccess();
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Expense" size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm" disabled={loading}>Cancel</button>
          <button form="exp-form" type="submit" className="btn-primary btn-sm" disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </button>
        </>
      }
    >
      <form id="exp-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Description</label>
          <input type="text" placeholder="e.g. Ice cream from Amul" {...register('description', { required: 'Description required' })} className={`input ${errors.description ? 'input-error' : ''}`} />
          {errors.description && <p className="error-text">{errors.description.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select {...register('category', { required: 'Category required' })} className={`select ${errors.category ? 'input-error' : ''}`}>
              <option value="">Select...</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="error-text">{errors.category.message}</p>}
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" step="0.01" min="0.01" placeholder="0.00" {...register('amount', { required: 'Amount required', min: { value: 0.01, message: 'Must be positive' } })} className={`input ${errors.amount ? 'input-error' : ''}`} />
            {errors.amount && <p className="error-text">{errors.amount.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" {...register('date', { required: 'Date required' })} className={`input ${errors.date ? 'input-error' : ''}`} />
          </div>
          <div>
            <label className="label">Payment</label>
            <select {...register('paymentMethod')} className="select">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Vendor (optional)</label>
          <input type="text" placeholder="Supplier name" {...register('vendor')} className="input" />
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea rows={2} {...register('notes')} className="input resize-none" placeholder="Additional notes..." />
        </div>
      </form>
    </Modal>
  );
}

export default function Expenses() {
  const { isAdmin } = useAuth();
  const { error: showError } = useNotification();
  const [expenses, setExpenses] = useState([]);
  const [categoryTotals, setCategoryTotals] = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (categoryFilter) params.category = categoryFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await expensesService.getAll(params);
      setExpenses(res.data.expenses || []);
      setCategoryTotals(res.data.categoryTotals || []);
      setGrandTotal(res.data.grandTotalPaise || 0);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card lg:col-span-2">
          <p className="kpi-label">Total Expenses</p>
          <p className="kpi-value text-red-600">{formatINR(grandTotal)}</p>
          <p className="text-xs text-gray-400">{total} records</p>
        </div>
        {categoryTotals.slice(0, 2).map((cat) => (
          <div key={cat._id} className="kpi-card">
            <p className="kpi-label">{cat._id}</p>
            <p className="kpi-value text-sm">{formatINR(cat.total)}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {categoryTotals.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">By Category</h3>
          <div className="space-y-2">
            {categoryTotals.map((cat) => {
              const pct = grandTotal > 0 ? Math.round((cat.total / grandTotal) * 100) : 0;
              return (
                <div key={cat._id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{cat._id}</span>
                    <span className="font-medium text-gray-800">{formatINR(cat.total)} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-forest-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + action */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="select w-auto">
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="input w-40" />
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="input w-40" />
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          {isAdmin && <button onClick={() => setShowModal(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" />Add Expense</button>}
        </div>
      </div>

      <div className="card p-0">
        {loading ? <LoadingSpinner size="lg" className="py-16" /> : expenses.length === 0 ? (
          <EmptyState title="No expenses" description="Record expenses to track your costs." icon={DollarSign} />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Vendor</th><th>Payment</th><th>By</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp._id}>
                    <td className="text-xs text-gray-400 whitespace-nowrap">{formatDate(exp.date)}</td>
                    <td className="font-medium text-sm">{exp.description}</td>
                    <td><span className="badge-yellow">{exp.category}</span></td>
                    <td className="text-gray-400 text-xs">{exp.vendor || '—'}</td>
                    <td><span className="badge-gray capitalize">{exp.paymentMethod}</span></td>
                    <td className="text-xs">{exp.createdBy?.name || '—'}</td>
                    <td className="text-right font-semibold text-red-600">{formatINR(exp.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-4">
          <Pagination page={page} pages={pages} onPage={setPage} />
        </div>
      </div>

      <ExpenseModal isOpen={showModal} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); load(); }} />
    </div>
  );
}
