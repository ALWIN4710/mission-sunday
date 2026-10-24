import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, ShoppingCart, Package, Users,
  Activity, AlertTriangle, Target, CreditCard, Banknote, Smartphone, RotateCcw
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { KPICard } from '../components/common/KPICard';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { ResetDashboardModal } from '../components/common/ResetDashboardModal';
import { useAuth } from '../context/AuthContext';
import { dashboardService, analyticsService } from '../services';
import { formatINR, formatDateTime, todayIST, paymentLabel } from '../utils';

const CATEGORY_COLORS = {
  'Ice Cream': '#1d5a44',
  'Cone':      '#358a6a',
  'Milkshake': '#57a686',
  'Mojito':    '#89c5ab',
};

function DateRangeSelector({ value, onChange }) {
  const presets = [
    { label: 'Today',      startDate: todayIST(), endDate: todayIST() },
    { label: 'This Week',  startDate: (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().split('T')[0]; })(), endDate: todayIST() },
    { label: 'This Month', startDate: (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; })(), endDate: todayIST() },
    { label: 'All Time',   startDate: '', endDate: '' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => onChange({ startDate: p.startDate, endDate: p.endDate })}
          className={`btn-sm btn ${JSON.stringify(value) === JSON.stringify({ startDate: p.startDate, endDate: p.endDate }) ? 'btn-primary' : 'btn-secondary'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [dateRange, setDateRange] = useState({ startDate: todayIST(), endDate: todayIST() });
  const [summary, setSummary] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const [trend, setTrend] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { startDate: dateRange.startDate, endDate: dateRange.endDate };
      const [summaryRes, trendRes, catRes] = await Promise.all([
        dashboardService.getSummary(params),
        analyticsService.getSalesTrend(params),
        analyticsService.getCategories(params),
      ]);
      setSummary(summaryRes.data.summary);
      setRecentSales(summaryRes.data.recentSales || []);
      setTrend(trendRes.data.trend || []);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner size="lg" className="mt-20" />;
  if (error) return (
    <div className="card border-red-100 bg-red-50 text-red-700 text-sm p-4">{error}</div>
  );

  const s = summary || {};

  // Pie chart data
  const pieData = [
    { name: 'Cash',  value: s.paymentBreakdown?.cashPaise || 0,  color: '#1d5a44' },
    { name: 'UPI',   value: s.paymentBreakdown?.upiPaise  || 0,  color: '#57a686' },
    { name: 'Other', value: s.paymentBreakdown?.otherPaise || 0, color: '#89c5ab' },
  ].filter((d) => d.value > 0);

  const trendData = trend.map((t) => ({
    date: t._id,
    Revenue: t.revenue / 100,
    Profit: t.profit / 100,
  }));

  const catData = categories.map((c) => ({
    name: c._id,
    Revenue: c.revenue / 100,
    Units: c.units,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track sales, profit, and inventory at a glance.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 font-medium text-xs shadow-sm transition-all active:scale-95"
              title="Reset dashboard & clear all sales/expenses for event start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Dashboard
            </button>
          )}
        </div>
      </div>

      {/* KPI cards - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Gross Sales"   valuePaise={s.grossSalesPaise}          icon={TrendingUp}   color="forest" />
        <KPICard label="Net Revenue"   valuePaise={s.netSalesPaise}            icon={DollarSign}   color="green" />
        <KPICard label="Gross Profit"  valuePaise={s.grossProfitPaise}         icon={Activity}     color="forest" />
        <KPICard label="Net Profit"    valuePaise={s.netProfitPaise}           icon={TrendingUp}   color={s.netProfitPaise >= 0 ? 'green' : 'red'} />
      </div>

      {/* KPI cards - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Transactions"   valueCount={s.transactionCount || 0}   icon={ShoppingCart} color="blue" />
        <KPICard label="Units Sold"     valueCount={s.unitsSold || 0}           icon={Package}      color="sand" />
        <KPICard label="Avg Order"      valuePaise={s.averageOrderValuePaise}   icon={CreditCard}   color="forest" />
        <KPICard label="Op. Expenses"   valuePaise={s.operatingExpensesPaise}   icon={DollarSign}   color="yellow" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <div className="card lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue & Profit Trend</h3>
          {trendData.length === 0 ? (
            <EmptyState title="No trend data" description="Record some sales to see the trend." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, '']} />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke="#1d5a44" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Profit"  stroke="#57a686" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment breakdown */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payment Methods</h3>
          {pieData.length === 0 ? (
            <EmptyState title="No payment data" description="Complete sales to see payment breakdown." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatINR(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-gray-600">{d.name}</span>
                    </div>
                    <span className="font-medium text-gray-800">{formatINR(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category chart */}
      {catData.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Sales by Category</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v, name) => name === 'Revenue' ? [`₹${v.toLocaleString('en-IN')}`, name] : [v, name]} />
              <Legend />
              <Bar dataKey="Revenue" fill="#1d5a44" radius={[4,4,0,0]} />
              <Bar dataKey="Units"   fill="#89c5ab" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Transactions</h3>
          {recentSales.length === 0 ? (
            <EmptyState title="No transactions" description="Sales will appear here." />
          ) : (
            <div className="space-y-2">
              {recentSales.slice(0, 8).map((sale) => (
                <div key={sale._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{sale.transactionId}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(sale.createdAt)} · {sale.createdBy?.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge status={sale.status} />
                    <span className="text-sm font-semibold text-gray-800">{formatINR(sale.totalPaise)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock alerts */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            Low Stock Alerts
          </h3>
          {(s.lowStockProducts || []).length === 0 ? (
            <EmptyState title="Stock levels are fine" description="No products below threshold." />
          ) : (
            <div className="space-y-2">
              {s.lowStockProducts.map((p) => (
                <div key={p._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.flavour} {p.category}</p>
                    <p className="text-xs text-gray-400">Threshold: {p.lowStockThreshold} {p.stockUnit}s</p>
                  </div>
                  <span className="badge-red">{p.stockUnit}s low</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ResetDashboardModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={load}
      />
    </div>
  );
}
