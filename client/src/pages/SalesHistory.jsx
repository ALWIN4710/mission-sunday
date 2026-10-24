import { useState, useEffect, useCallback } from 'react';
import { Eye, RefreshCw, Search, Filter, Download, RotateCcw, Loader2 } from 'lucide-react';
import { salesService } from '../services';
import { formatINR, formatDateTime, paymentLabel, getErrorMessage, todayIST, downloadCSV } from '../utils';
import { Badge } from '../components/common/Badge';
import { Pagination } from '../components/common/Pagination';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useForm } from 'react-hook-form';

function SaleDetailModal({ sale, isOpen, onClose, onRefund }) {
  if (!sale) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sale ${sale.transactionId}`} size="lg"
      footer={<button onClick={onClose} className="btn-secondary btn-sm">Close</button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-gray-400 text-xs mb-0.5">Date</p><p className="font-medium">{formatDateTime(sale.createdAt)}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Status</p><Badge status={sale.status} /></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Recorded by</p><p className="font-medium">{sale.createdBy?.name}</p></div>
          <div><p className="text-gray-400 text-xs mb-0.5">Payment</p><p className="font-medium capitalize">{paymentLabel(sale.paymentMethod)}</p></div>
          {sale.upiReference && <div className="col-span-2"><p className="text-gray-400 text-xs mb-0.5">UPI Ref</p><p className="font-medium font-mono text-xs">{sale.upiReference}</p></div>}
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {sale.items?.map((item, i) => (
                <tr key={i}>
                  <td className="font-medium">{item.productName}</td>
                  <td><span className="badge-forest">{item.category}</span></td>
                  <td>{formatINR(item.sellingPricePaise)}</td>
                  <td>{item.quantity}</td>
                  <td className="text-right font-semibold">{formatINR(item.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatINR(sale.subtotalPaise)}</span></div>
          {sale.discountPaise > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatINR(sale.discountPaise)}</span></div>}
          {sale.refundedAmountPaise > 0 && <div className="flex justify-between text-red-500"><span>Refunded</span><span>-{formatINR(sale.refundedAmountPaise)}</span></div>}
          <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Total</span><span>{formatINR(sale.totalPaise)}</span></div>
        </div>

        {['completed', 'partially_refunded'].includes(sale.status) && onRefund && (
          <button onClick={() => onRefund(sale)} className="btn-danger btn-sm w-full">
            <RotateCcw className="w-3.5 h-3.5" /> Process Refund
          </button>
        )}
      </div>
    </Modal>
  );
}

function RefundModal({ sale, isOpen, onClose, onSuccess }) {
  const { error, success } = useNotification();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const amountPaise = Math.round(parseFloat(data.amount) * 100);
      await salesService.createRefund(sale._id, { amountPaise, reason: data.reason });
      success('Refund processed successfully.');
      reset();
      onSuccess();
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!sale) return null;
  const maxRefund = (sale.totalPaise - (sale.refundedAmountPaise || 0)) / 100;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Process Refund"  size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn-sm" disabled={loading}>Cancel</button>
          <button form="refund-form" type="submit" className="btn-danger btn-sm" disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refund'}
          </button>
        </>
      }
    >
      <form id="refund-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-gray-500">Max refundable: <strong>{formatINR(sale.totalPaise - (sale.refundedAmountPaise || 0))}</strong></p>
        <div>
          <label className="label">Amount (₹)</label>
          <input type="number" step="0.01" min="0.01" max={maxRefund} placeholder={`Max ₹${maxRefund.toFixed(2)}`}
            {...register('amount', { required: 'Amount required', min: { value: 0.01, message: 'Must be positive' }, max: { value: maxRefund, message: `Cannot exceed ₹${maxRefund.toFixed(2)}` } })}
            className={`input ${errors.amount ? 'input-error' : ''}`}
          />
          {errors.amount && <p className="error-text">{errors.amount.message}</p>}
        </div>
        <div>
          <label className="label">Reason</label>
          <textarea rows={3} {...register('reason', { required: 'Reason required' })} className={`input resize-none ${errors.reason ? 'input-error' : ''}`} placeholder="Describe why a refund is being issued..." />
          {errors.reason && <p className="error-text">{errors.reason.message}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default function SalesHistory() {
  const { isAdmin } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();
  const [sales, setSales] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [refundSale, setRefundSale] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentMethod = paymentFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await salesService.getAll(params);
      setSales(res.data.sales || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, paymentFilter, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const viewSale = async (sale) => {
    try {
      const res = await salesService.getById(sale._id);
      setSelectedSale(res.data.sale);
    } catch {
      setSelectedSale(sale);
    }
  };

  const handleDownloadCSV = async () => {
    setDownloading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentMethod = paymentFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      // Fetch full filtered records for export
      const res = await salesService.getAll({ ...params, limit: 3000 });
      const exportList = res.data?.sales || sales;

      if (!exportList || exportList.length === 0) {
        showError('No sales records to export.');
        return;
      }

      const columns = [
        { key: 'transactionId', label: 'Transaction ID' },
        { key: 'createdAt', label: 'Date & Time (IST)', format: (val) => formatDateTime(val) },
        { key: 'createdBy', label: 'Recorded By', format: (val) => val?.name || '—' },
        {
          key: 'items',
          label: 'Items Sold',
          format: (items) => (items || []).map((i) => `${i.productName} (${i.quantity})`).join('; '),
        },
        {
          key: 'items',
          label: 'Total Quantity',
          format: (items) => (items || []).reduce((s, i) => s + (i.quantity || 0), 0),
        },
        { key: 'subtotalPaise', label: 'Subtotal (INR)', format: (val) => (val / 100).toFixed(2) },
        { key: 'discountPaise', label: 'Discount (INR)', format: (val) => (val / 100).toFixed(2) },
        { key: 'refundedAmountPaise', label: 'Refunded (INR)', format: (val) => (val / 100).toFixed(2) },
        { key: 'totalPaise', label: 'Net Total (INR)', format: (val) => (val / 100).toFixed(2) },
        { key: 'paymentMethod', label: 'Payment Method', format: (val) => paymentLabel(val) },
        { key: 'upiReference', label: 'UPI Reference', format: (val) => val || '—' },
        { key: 'status', label: 'Status', format: (val) => val },
      ];

      const filename = `sales-history-${startDate || 'all'}-to-${endDate || todayIST()}.csv`;
      downloadCSV(filename, exportList, columns);
      showSuccess(`Exported ${exportList.length} sales records to CSV.`);
    } catch (err) {
      showError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input placeholder="Search Transaction ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input pl-9" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="select">
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="partially_refunded">Partial Refund</option>
            <option value="fully_refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} className="select">
            <option value="">All Payments</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="other">Other</option>
          </select>
          <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="input" />
          <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="input" />
        </div>
      </div>

      {/* Count + results */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">{total.toLocaleString('en-IN')} transactions</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            disabled={downloading || total === 0}
            className="btn-secondary btn-sm flex items-center gap-1.5 text-forest-700 hover:bg-forest-50 border-forest-200"
            title="Download sales history as CSV"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download Sales History
          </button>
          <button onClick={load} className="btn-ghost btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <LoadingSpinner size="lg" className="py-16" />
        ) : sales.length === 0 ? (
          <EmptyState title="No sales found" description="Adjust your filters to see results." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Volunteer</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale._id}>
                    <td className="font-mono text-xs font-medium text-forest-700">{sale.transactionId}</td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(sale.createdAt)}</td>
                    <td className="text-sm">{sale.createdBy?.name || '—'}</td>
                    <td className="text-sm">{sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''}</td>
                    <td><span className="badge-gray capitalize">{paymentLabel(sale.paymentMethod)}</span></td>
                    <td><Badge status={sale.status} /></td>
                    <td className="text-right font-semibold text-gray-800">{formatINR(sale.totalPaise)}</td>
                    <td>
                      <button onClick={() => viewSale(sale)} className="btn-ghost btn-sm">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
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

      <SaleDetailModal
        sale={selectedSale}
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        onRefund={isAdmin ? (sale) => { setSelectedSale(null); setRefundSale(sale); } : null}
      />
      <RefundModal
        sale={refundSale}
        isOpen={!!refundSale}
        onClose={() => setRefundSale(null)}
        onSuccess={() => { setRefundSale(null); load(); }}
      />
    </div>
  );
}
