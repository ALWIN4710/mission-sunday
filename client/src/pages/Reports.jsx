import { useState, useCallback, useRef } from 'react';
import {
  FileText, TrendingUp, CreditCard, Package,
  Download, Printer, RefreshCw, ChevronRight,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { reportsService } from '../services';
import { formatINR, formatDate, todayIST, getErrorMessage, downloadRawCSV } from '../utils';
import { useNotification } from '../context/NotificationContext';

// ─── Constants ─────────────────────────────────────────────────────────────

const REPORT_TYPES = [
  {
    id:          'sales',
    label:       'Sales Summary',
    description: 'Aggregated sales data for the selected date range.',
    icon:        TrendingUp,
    color:       'forest',
  },
  {
    id:          'profit-loss',
    label:       'Profit & Loss',
    description: 'Revenue, COGS, gross profit, expenses and net profit.',
    icon:        FileText,
    color:       'blue',
  },
  {
    id:          'reconciliation',
    label:       'Payment Reconciliation',
    description: 'Cash vs UPI vs other breakdown with totals.',
    icon:        CreditCard,
    color:       'emerald',
  },
  {
    id:          'inventory',
    label:       'Inventory Valuation',
    description: 'Current stock values by product and category.',
    icon:        Package,
    color:       'sand',
  },
];

const COLOR_MAP = {
  forest:  { bg: 'bg-forest-50',  border: 'border-forest-200', icon: 'bg-forest-100 text-forest-700', active: 'ring-2 ring-forest-400' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   icon: 'bg-blue-100 text-blue-700',     active: 'ring-2 ring-blue-400'   },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',icon: 'bg-emerald-100 text-emerald-700',active: 'ring-2 ring-emerald-400'},
  sand:    { bg: 'bg-sand-50',    border: 'border-sand-200',   icon: 'bg-sand-100 text-sand-700',     active: 'ring-2 ring-sand-400'   },
};

function todayMinus(days) {
  const d = new Date(todayIST());
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ─── Print styles injected once ────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body > *:not(#report-print-root) { display: none !important; }
  #report-print-root { display: block !important; }
  .no-print { display: none !important; }
  .print-page { padding: 20px; font-family: Inter, sans-serif; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  .report-header { text-align: center; margin-bottom: 24px; }
  .report-header h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  .report-header p { font-size: 12px; color: #666; margin: 0; }
  .section-title { font-size: 14px; font-weight: 700; margin: 16px 0 8px; border-bottom: 2px solid #1d5a44; padding-bottom: 4px; }
  .pl-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #eee; }
  .pl-row.total { font-weight: 700; border-top: 2px solid #1d5a44; }
  .pl-row.net { font-size: 16px; font-weight: 700; color: #1d5a44; }
  .pl-indent { padding-left: 16px; }
}
`;

(function injectPrintStyle() {
  if (typeof document !== 'undefined' && !document.getElementById('report-print-style')) {
    const style = document.createElement('style');
    style.id = 'report-print-style';
    style.textContent = PRINT_STYLE;
    document.head.appendChild(style);
  }
})();

// ─── Shared components ────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, highlight = false, negative = false }) {
  return (
    <div className={`rounded-xl border p-4 shadow-card ${
      highlight  ? 'bg-forest-50 border-forest-200' :
      negative   ? 'bg-red-50 border-red-100'       :
                   'bg-white border-gray-100'
    }`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${
        highlight ? 'text-forest-800' : negative ? 'text-red-700' : 'text-gray-900'
      }`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function PLRow({ label, value, indent = false, isTotal = false, isNet = false, isNegative = false }) {
  return (
    <div className={`flex items-center justify-between py-2 ${
      isTotal ? 'border-t-2 border-forest-200 font-bold' :
      isNet   ? 'border-t-2 border-forest-700 font-bold text-lg' :
                'border-b border-gray-50'
    } ${indent ? 'pl-6' : ''}`}>
      <span className={`text-sm ${isNet ? 'text-forest-800 text-base' : isTotal ? 'text-gray-800' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold ${
        isNet       ? 'text-forest-800 text-base' :
        isNegative  ? 'text-red-600' :
        isTotal     ? 'text-gray-900' :
                      'text-gray-700'
      }`}>
        {value}
      </span>
    </div>
  );
}

// ─── Report: Sales Summary ────────────────────────────────────────────────

function SalesSummaryReport({ data }) {
  const s = data?.summary || {};
  const rows = data?.daily || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Total Gross Sales"   value={formatINR(s.grossSalesPaise || 0)} highlight />
        <SummaryCard label="Net Sales"           value={formatINR(s.netSalesPaise || 0)} />
        <SummaryCard label="Transactions"        value={(s.transactionCount || 0).toLocaleString('en-IN')} />
        <SummaryCard label="Units Sold"          value={(s.unitsSold || 0).toLocaleString('en-IN')} />
        <SummaryCard label="Avg Order Value"     value={formatINR(s.avgOrderValuePaise || 0)} />
        <SummaryCard label="Total Discounts"     value={formatINR(s.discountsPaise || 0)} negative={!!(s.discountsPaise)} />
        <SummaryCard label="Refunds"             value={formatINR(s.refundsPaise || 0)} negative={!!(s.refundsPaise)} />
      </div>

      {rows.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Sales Breakdown by Day</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium pr-4">Date</th>
                  <th className="pb-2 font-medium pr-4 text-right">Transactions</th>
                  <th className="pb-2 font-medium pr-4 text-right">Gross Sales</th>
                  <th className="pb-2 font-medium pr-4 text-right">Discounts</th>
                  <th className="pb-2 font-medium pr-4 text-right">Refunds</th>
                  <th className="pb-2 font-medium text-right">Net Sales</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-gray-700">{formatDate(r.date || r._id)}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{(r.transactionCount || r.count || 0).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-forest-800">{formatINR(r.grossSalesPaise || r.grossSales || 0)}</td>
                    <td className="py-2.5 pr-4 text-right text-red-600">{formatINR(r.discountsPaise || r.discounts || 0)}</td>
                    <td className="py-2.5 pr-4 text-right text-red-600">{formatINR(r.refundsPaise || r.refunds || 0)}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-800">{formatINR(r.netSalesPaise || r.netSales || 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-forest-200 bg-forest-50 font-bold">
                  <td className="py-2.5 pr-4 text-forest-800 text-sm">TOTAL</td>
                  <td className="py-2.5 pr-4 text-right text-forest-800">{(s.transactionCount || 0).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4 text-right text-forest-800">{formatINR(s.grossSalesPaise || 0)}</td>
                  <td className="py-2.5 pr-4 text-right text-red-700">{formatINR(s.discountsPaise || 0)}</td>
                  <td className="py-2.5 pr-4 text-right text-red-700">{formatINR(s.refundsPaise || 0)}</td>
                  <td className="py-2.5 text-right text-forest-800">{formatINR(s.netSalesPaise || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report: Profit & Loss ────────────────────────────────────────────────

function ProfitLossReport({ data, dateRange }) {
  const d = data || {};
  const grossSales     = d.grossSalesPaise || 0;
  const discounts      = d.discountsPaise  || 0;
  const refunds        = d.refundsPaise    || 0;
  const netRevenue     = grossSales - discounts - refunds;
  const cogs           = d.cogsPaise || 0;
  const grossProfit    = netRevenue - cogs;
  const expenses       = d.expenses || [];
  const totalExpenses  = expenses.reduce((s, e) => s + (e.amountPaise || e.amount || 0), 0);
  const netProfit      = grossProfit - totalExpenses;
  const margin         = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="card max-w-2xl mx-auto">
      {/* Print-ready branding header */}
      <div className="text-center pb-5 mb-5 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-forest-700 flex items-center justify-center mx-auto mb-2">
          <span className="text-white text-lg font-bold">M</span>
        </div>
        <h3 className="text-lg font-bold text-gray-900">Mission Sunday</h3>
        <p className="text-xs text-gray-500">Profit & Loss Statement</p>
        {dateRange.startDate && (
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(dateRange.startDate)}
            {dateRange.endDate !== dateRange.startDate ? ` — ${formatDate(dateRange.endDate)}` : ''}
          </p>
        )}
      </div>

      <div className="space-y-0">
        {/* Revenue */}
        <p className="text-xs font-bold text-forest-700 uppercase tracking-widest mb-2">Revenue</p>
        <PLRow label="Gross Sales"        value={formatINR(grossSales)} />
        <PLRow label="Less: Discounts"    value={`(${formatINR(discounts)})`} indent isNegative />
        <PLRow label="Less: Refunds"      value={`(${formatINR(refunds)})`}   indent isNegative />
        <PLRow label="Net Revenue"        value={formatINR(netRevenue)} isTotal />

        <div className="h-5" />

        {/* COGS */}
        <p className="text-xs font-bold text-forest-700 uppercase tracking-widest mb-2">Cost of Goods Sold</p>
        <PLRow label="Total COGS"         value={`(${formatINR(cogs)})`} isNegative />
        <PLRow label="Gross Profit"       value={formatINR(grossProfit)} isTotal />

        <div className="h-5" />

        {/* Expenses */}
        <p className="text-xs font-bold text-forest-700 uppercase tracking-widest mb-2">Operating Expenses</p>
        {expenses.length > 0 ? (
          expenses.map((e, i) => (
            <PLRow
              key={i}
              label={e.category || e.description || e.name || `Expense ${i + 1}`}
              value={formatINR(e.amountPaise || e.amount || 0)}
              indent
              isNegative
            />
          ))
        ) : (
          <PLRow label="No expenses recorded" value="—" indent />
        )}
        <PLRow label="Total Operating Expenses" value={`(${formatINR(totalExpenses)})`} isTotal isNegative />

        <div className="h-5" />

        {/* Net profit */}
        <PLRow
          label="NET PROFIT"
          value={`${formatINR(netProfit)}  (${margin}% margin)`}
          isNet
          isNegative={netProfit < 0}
        />
      </div>

      {netProfit < 0 && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          Net loss recorded for this period.
        </div>
      )}
      {netProfit > 0 && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Profitable period — net margin of {margin}%.
        </div>
      )}
    </div>
  );
}

// ─── Report: Payment Reconciliation ──────────────────────────────────────

function ReconciliationReport({ data }) {
  const d = data || {};
  const cash  = d.cashPaise  || 0;
  const upi   = d.upiPaise   || 0;
  const other = d.otherPaise || 0;
  const total = cash + upi + other;

  const cashCount  = d.cashCount  || 0;
  const upiCount   = d.upiCount   || 0;
  const otherCount = d.otherCount || 0;
  const totalCount = cashCount + upiCount + otherCount;

  const upiRefs = d.upiReferences || [];

  const methods = [
    { label: 'Cash',  value: cash,  count: cashCount,  icon: '💵', color: 'bg-forest-50 border-forest-200' },
    { label: 'UPI',   value: upi,   count: upiCount,   icon: '📱', color: 'bg-blue-50 border-blue-200' },
    { label: 'Other', value: other, count: otherCount, icon: '🏦', color: 'bg-sand-50 border-sand-200' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {methods.map((m) => (
          <div key={m.label} className={`rounded-xl border p-4 shadow-card ${m.color}`}>
            <p className="text-2xl mb-2">{m.icon}</p>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{m.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatINR(m.value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{m.count.toLocaleString('en-IN')} transactions</p>
          </div>
        ))}
        <div className="rounded-xl border border-gray-200 p-4 shadow-card bg-white">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Collected</p>
          <p className="text-xl font-bold text-forest-800 mt-1">{formatINR(total)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{totalCount.toLocaleString('en-IN')} transactions</p>
        </div>
      </div>

      <div className="card">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Payment Method Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium pr-4">Method</th>
                <th className="pb-2 font-medium pr-4 text-right">Transactions</th>
                <th className="pb-2 font-medium pr-4 text-right">Amount Collected</th>
                <th className="pb-2 font-medium text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => {
                const pct = total ? ((m.value / total) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={m.label} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-gray-800">
                      <span className="mr-1.5">{m.icon}</span>{m.label}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-600">{m.count.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-forest-800">{formatINR(m.value)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-forest-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-forest-200 bg-forest-50 font-bold">
                <td className="py-2.5 pr-4 text-forest-800 text-sm">TOTAL</td>
                <td className="py-2.5 pr-4 text-right text-forest-800">{totalCount.toLocaleString('en-IN')}</td>
                <td className="py-2.5 pr-4 text-right text-forest-800">{formatINR(total)}</td>
                <td className="py-2.5 text-right text-forest-800">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {upiRefs.length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">UPI Reference Numbers</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {upiRefs.map((ref, i) => (
              <div key={i} className="text-xs bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 font-mono text-blue-800 truncate">
                {ref}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report: Inventory Valuation ──────────────────────────────────────────

function InventoryReport({ data }) {
  const items = data?.items || data?.products || [];
  const total = items.reduce((s, p) => s + (p.stockValuePaise || p.stockValue || 0), 0);

  const LOW_THRESHOLD = 5;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard label="Total Stock Value" value={formatINR(total)} highlight />
        <SummaryCard label="Total Products"    value={items.length.toLocaleString('en-IN')} />
        <SummaryCard
          label="Low Stock Items"
          value={items.filter((p) => (p.currentStock || p.stock || 0) <= LOW_THRESHOLD).length.toLocaleString('en-IN')}
          negative={items.some((p) => (p.currentStock || p.stock || 0) <= LOW_THRESHOLD)}
        />
      </div>

      <div className="card">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">Stock Valuation by Product</h4>
        {items.length === 0 ? (
          <EmptyState title="No inventory data" description="Inventory report data will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium pr-3">Product</th>
                  <th className="pb-2 font-medium pr-3">Category</th>
                  <th className="pb-2 font-medium pr-3">Unit</th>
                  <th className="pb-2 font-medium pr-3 text-right">Current Stock</th>
                  <th className="pb-2 font-medium pr-3 text-right">Cost Price</th>
                  <th className="pb-2 font-medium text-right">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p, i) => {
                  const stock   = p.currentStock || p.stock || 0;
                  const isLow   = stock <= LOW_THRESHOLD;
                  const costPaise = p.costPricePaise || p.costPrice || 0;
                  const valuePaise = p.stockValuePaise || p.stockValue || 0;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${isLow ? 'bg-amber-50' : ''}`}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                          <span className={`font-medium ${isLow ? 'text-amber-800' : 'text-gray-800'}`}>
                            {p.name || p.flavour || p.productName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">{p.category}</td>
                      <td className="py-2.5 pr-3 text-gray-500 text-xs">{p.unit || p.stockUnit || '—'}</td>
                      <td className={`py-2.5 pr-3 text-right font-semibold ${isLow ? 'text-amber-700' : 'text-gray-700'}`}>
                        {stock.toLocaleString('en-IN')}
                        {isLow && <span className="ml-1 text-xs font-normal text-amber-500">LOW</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-600">{formatINR(costPaise)}</td>
                      <td className="py-2.5 text-right font-semibold text-forest-800">{formatINR(valuePaise)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-forest-200 bg-forest-50 font-bold">
                  <td colSpan={5} className="py-2.5 pr-3 text-forest-800 text-sm">TOTAL STOCK VALUE</td>
                  <td className="py-2.5 text-right text-forest-800">{formatINR(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {items.some((p) => (p.currentStock || p.stock || 0) <= LOW_THRESHOLD) && (
        <div className="card border-amber-100 bg-amber-50">
          <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Low Stock Alerts
          </h4>
          <div className="flex flex-wrap gap-2">
            {items
              .filter((p) => (p.currentStock || p.stock || 0) <= LOW_THRESHOLD)
              .map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-200 rounded-full text-xs text-amber-800 font-medium"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {p.name || p.flavour}: {(p.currentStock || p.stock || 0)} {p.unit || p.stockUnit || 'units'}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────

const SERVICE_MAP = {
  'sales':           (params) => reportsService.getSalesReport(params),
  'profit-loss':     (params) => reportsService.getProfitLossReport(params),
  'reconciliation':  (params) => reportsService.getReconciliationReport(params),
  'inventory':       (params) => reportsService.getInventoryReport(params),
};

export default function Reports() {
  const { error: notifyError, success: notifySuccess } = useNotification();

  const [selectedType, setSelectedType] = useState(null);
  const [dateRange, setDateRange]       = useState({ startDate: todayMinus(29), endDate: todayIST() });
  const [reportData, setReportData]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [generated, setGenerated]       = useState(false);
  const reportRef = useRef(null);

  const handleGenerate = useCallback(async () => {
    if (!selectedType) {
      notifyError('Please select a report type first.');
      return;
    }
    setLoading(true);
    setGenerated(false);
    setReportData(null);
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate:   dateRange.endDate,
      };
      const serviceFn = SERVICE_MAP[selectedType];
      const res = await serviceFn(params);
      setReportData(res.data);
      setGenerated(true);
      notifySuccess('Report generated successfully.');
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedType, dateRange, notifyError, notifySuccess]);

  const activeType = REPORT_TYPES.find((r) => r.id === selectedType);

  const handleDownloadCSV = useCallback(() => {
    if (!selectedType || !reportData) return;

    try {
      const filename = `${selectedType}-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      const escapeCSV = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines = [];

      if (selectedType === 'sales') {
        const s = reportData.summary || {};
        const daily = reportData.daily || [];
        const salesList = reportData.sales || [];

        lines.push(['MISSION SUNDAY - SALES SUMMARY REPORT'].map(escapeCSV).join(','));
        lines.push([`Period: ${dateRange.startDate} to ${dateRange.endDate}`].map(escapeCSV).join(','));
        lines.push([`Generated At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`].map(escapeCSV).join(','));
        lines.push('');

        lines.push(['=== SALES SUMMARY KPI ==='].map(escapeCSV).join(','));
        lines.push(['Metric', 'Value'].map(escapeCSV).join(','));
        lines.push(['Gross Sales (INR)', ((s.grossSalesPaise || 0) / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push(['Net Sales (INR)', ((s.netSalesPaise || 0) / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push(['Total Transactions', s.transactionCount || 0].map(escapeCSV).join(','));
        lines.push(['Units Sold', s.unitsSold || 0].map(escapeCSV).join(','));
        lines.push(['Average Order Value (INR)', ((s.avgOrderValuePaise || 0) / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push(['Total Discounts (INR)', ((s.discountsPaise || 0) / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push(['Total Refunds (INR)', ((s.refundsPaise || 0) / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push('');

        if (daily.length > 0) {
          lines.push(['=== DAILY SALES BREAKDOWN ==='].map(escapeCSV).join(','));
          lines.push(['Date', 'Transactions', 'Gross Sales (INR)', 'Discounts (INR)', 'Refunds (INR)', 'Net Sales (INR)'].map(escapeCSV).join(','));
          daily.forEach((r) => {
            lines.push([
              r.date,
              r.transactionCount || 0,
              ((r.grossSalesPaise || 0) / 100).toFixed(2),
              ((r.discountsPaise || 0) / 100).toFixed(2),
              ((r.refundsPaise || 0) / 100).toFixed(2),
              ((r.netSalesPaise || 0) / 100).toFixed(2),
            ].map(escapeCSV).join(','));
          });
          lines.push('');
        }

        if (salesList.length > 0) {
          lines.push(['=== DETAILED TRANSACTIONS ==='].map(escapeCSV).join(','));
          lines.push(['Transaction ID', 'Date & Time (IST)', 'Cashier', 'Payment Method', 'Items', 'Subtotal (INR)', 'Discount (INR)', 'Total (INR)', 'Status'].map(escapeCSV).join(','));
          salesList.forEach((t) => {
            const itemsStr = (t.items || []).map((i) => `${i.productName} x ${i.quantity}`).join('; ');
            lines.push([
              t.transactionId,
              new Date(t.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              t.createdBy?.name || '',
              t.paymentMethod,
              itemsStr,
              ((t.subtotalPaise || 0) / 100).toFixed(2),
              ((t.discountPaise || 0) / 100).toFixed(2),
              ((t.totalPaise || 0) / 100).toFixed(2),
              t.status,
            ].map(escapeCSV).join(','));
          });
        }
      } else if (selectedType === 'profit-loss') {
        const d = reportData.report || reportData || {};
        const grossSales = d.grossSalesPaise || d.revenue?.totalPaise || 0;
        const discounts = d.discountsPaise || 0;
        const refunds = d.refundsPaise || 0;
        const netRevenue = grossSales - discounts - refunds;
        const cogs = d.cogsPaise || d.cogs?.totalPaise || 0;
        const grossProfit = netRevenue - cogs;
        const expenses = d.expenses || [];
        const totalExpenses = d.totalExpensesPaise || expenses.reduce((s, e) => s + (e.amountPaise || 0), 0);
        const netProfit = grossProfit - totalExpenses;
        const margin = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : '0.0';

        lines.push(['MISSION SUNDAY - PROFIT & LOSS STATEMENT'].map(escapeCSV).join(','));
        lines.push([`Period: ${dateRange.startDate} to ${dateRange.endDate}`].map(escapeCSV).join(','));
        lines.push([`Generated At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`].map(escapeCSV).join(','));
        lines.push('');

        lines.push(['Section', 'Line Item', 'Amount (INR)'].map(escapeCSV).join(','));
        lines.push(['REVENUE', 'Gross Sales', (grossSales / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push(['REVENUE', 'Less: Discounts', `-${(discounts / 100).toFixed(2)}`].map(escapeCSV).join(','));
        lines.push(['REVENUE', 'Less: Refunds', `-${(refunds / 100).toFixed(2)}`].map(escapeCSV).join(','));
        lines.push(['REVENUE', 'Net Revenue', (netRevenue / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push('');
        lines.push(['COGS', 'Cost of Goods Sold (COGS)', `-${(cogs / 100).toFixed(2)}`].map(escapeCSV).join(','));
        lines.push(['GROSS PROFIT', 'Gross Profit', (grossProfit / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push('');
        lines.push(['EXPENSES', 'Operating Expenses', ''].map(escapeCSV).join(','));
        expenses.forEach((e) => {
          lines.push(['EXPENSES', e.category || 'Expense', (e.amountPaise / 100).toFixed(2)].map(escapeCSV).join(','));
        });
        lines.push(['EXPENSES', 'Total Operating Expenses', `-${(totalExpenses / 100).toFixed(2)}`].map(escapeCSV).join(','));
        lines.push('');
        lines.push(['SUMMARY', 'NET PROFIT', (netProfit / 100).toFixed(2)].map(escapeCSV).join(','));
        lines.push(['SUMMARY', 'Net Profit Margin', `${margin}%`].map(escapeCSV).join(','));
      } else if (selectedType === 'reconciliation') {
        const d = reportData || {};
        const cash = d.cashPaise || 0;
        const upi = d.upiPaise || 0;
        const other = d.otherPaise || 0;
        const total = cash + upi + other;
        const totalCount = (d.cashCount || 0) + (d.upiCount || 0) + (d.otherCount || 0);

        lines.push(['MISSION SUNDAY - PAYMENT RECONCILIATION REPORT'].map(escapeCSV).join(','));
        lines.push([`Period: ${dateRange.startDate} to ${dateRange.endDate}`].map(escapeCSV).join(','));
        lines.push([`Generated At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`].map(escapeCSV).join(','));
        lines.push('');

        lines.push(['Payment Method', 'Transactions', 'Amount Collected (INR)', 'Share %'].map(escapeCSV).join(','));
        lines.push(['Cash', d.cashCount || 0, (cash / 100).toFixed(2), total ? `${((cash / total) * 100).toFixed(1)}%` : '0%'].map(escapeCSV).join(','));
        lines.push(['UPI', d.upiCount || 0, (upi / 100).toFixed(2), total ? `${((upi / total) * 100).toFixed(1)}%` : '0%'].map(escapeCSV).join(','));
        lines.push(['Other', d.otherCount || 0, (other / 100).toFixed(2), total ? `${((other / total) * 100).toFixed(1)}%` : '0%'].map(escapeCSV).join(','));
        lines.push(['TOTAL', totalCount, (total / 100).toFixed(2), '100%'].map(escapeCSV).join(','));
        lines.push('');

        const upiRefs = d.upiReferences || [];
        if (upiRefs.length > 0) {
          lines.push(['=== UPI TRANSACTION REFERENCES ==='].map(escapeCSV).join(','));
          lines.push(['Sl. No.', 'UPI Reference'].map(escapeCSV).join(','));
          upiRefs.forEach((ref, idx) => {
            lines.push([idx + 1, ref].map(escapeCSV).join(','));
          });
        }
      } else if (selectedType === 'inventory') {
        const items = reportData.items || reportData.products || [];
        const totalValue = items.reduce((s, p) => s + (p.stockValuePaise || 0), 0);

        lines.push(['MISSION SUNDAY - INVENTORY VALUATION REPORT'].map(escapeCSV).join(','));
        lines.push([`Generated At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`].map(escapeCSV).join(','));
        lines.push([`Total Inventory Value (INR): ${(totalValue / 100).toFixed(2)}`].map(escapeCSV).join(','));
        lines.push([`Total Products: ${items.length}`].map(escapeCSV).join(','));
        lines.push('');

        lines.push(['Product Name', 'Category', 'Unit', 'Current Stock', 'Cost Price (INR)', 'Stock Value (INR)', 'Status'].map(escapeCSV).join(','));
        items.forEach((p) => {
          const stock = p.currentStock || 0;
          const cost = (p.costPricePaise || 0) / 100;
          const val = (p.stockValuePaise || 0) / 100;
          lines.push([
            p.name || p.flavour,
            p.category,
            p.stockUnit || p.unit || 'piece',
            stock,
            cost.toFixed(2),
            val.toFixed(2),
            stock <= (p.lowStockThreshold || 5) ? 'LOW STOCK' : 'IN STOCK',
          ].map(escapeCSV).join(','));
        });
      }

      downloadRawCSV(filename, lines.join('\r\n'));
      notifySuccess(`${activeType?.label || 'Report'} downloaded as CSV!`);
    } catch (err) {
      notifyError(getErrorMessage(err));
    }
  }, [selectedType, reportData, dateRange, activeType, notifyError, notifySuccess]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" id="report-print-root">
      {/* Header — hidden in print */}
      <div className="no-print flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate and download detailed business reports.</p>
        </div>
      </div>

      {/* Report type selector */}
      <div className="no-print">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">Select Report Type</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {REPORT_TYPES.map((type) => {
            const cm      = COLOR_MAP[type.color] || COLOR_MAP.forest;
            const Icon    = type.icon;
            const isActive = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type.id); setGenerated(false); setReportData(null); }}
                className={`text-left p-4 rounded-xl border transition-all shadow-card hover:shadow-card-hover ${cm.bg} ${cm.border} ${isActive ? cm.active : ''}`}
              >
                <div className={`inline-flex p-2 rounded-lg mb-3 ${cm.icon}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-gray-800">{type.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{type.description}</p>
                {isActive && (
                  <div className="mt-2 flex items-center gap-1 text-xs font-medium text-forest-700">
                    <CheckCircle className="w-3.5 h-3.5" /> Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls row */}
      <div className="no-print card">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Date range */}
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                max={dateRange.endDate}
                onChange={(e) => setDateRange((r) => ({ ...r, startDate: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-forest-300"
              />
            </div>
            <div className="text-gray-400 text-sm mt-5">to</div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                min={dateRange.startDate}
                max={todayIST()}
                onChange={(e) => setDateRange((r) => ({ ...r, endDate: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-forest-300"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={!selectedType || loading}
              className="flex items-center gap-2 px-4 py-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Generate Report
            </button>
            {generated && (
              <>
                <button
                  onClick={handleDownloadCSV}
                  className="flex items-center gap-2 px-3 py-2 border border-forest-300 text-forest-700 hover:bg-forest-50 text-sm font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" /> Download CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Report output */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-gray-500 mt-4">Generating report…</p>
        </div>
      )}

      {!loading && !generated && !selectedType && (
        <div className="card">
          <EmptyState
            title="No report selected"
            description="Choose a report type above, set your date range, and click Generate Report."
          />
        </div>
      )}

      {!loading && !generated && selectedType && (
        <div className="card">
          <EmptyState
            title={`Ready to generate ${activeType?.label}`}
            description={`${activeType?.description} Click "Generate Report" to proceed.`}
          />
        </div>
      )}

      {!loading && generated && reportData && (
        <div ref={reportRef} className="print-page">
          {/* Print header — visible only in print */}
          <div className="hidden print:block report-header mb-6">
            <h1>Mission Sunday — {activeType?.label}</h1>
            <p>Period: {formatDate(dateRange.startDate)} – {formatDate(dateRange.endDate)}</p>
            <p>Generated: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
          </div>

          {/* Report title */}
          <div className="flex items-center justify-between mb-5 no-print">
            <div>
              <h3 className="text-base font-bold text-gray-900">{activeType?.label}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {formatDate(dateRange.startDate)}
                {dateRange.endDate !== dateRange.startDate ? ` — ${formatDate(dateRange.endDate)}` : ''}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" /> Report Ready
            </span>
          </div>

          {selectedType === 'sales' && (
            <SalesSummaryReport data={reportData} />
          )}
          {selectedType === 'profit-loss' && (
            <ProfitLossReport data={reportData} dateRange={dateRange} />
          )}
          {selectedType === 'reconciliation' && (
            <ReconciliationReport data={reportData} />
          )}
          {selectedType === 'inventory' && (
            <InventoryReport data={reportData} />
          )}
        </div>
      )}
    </div>
  );
}
