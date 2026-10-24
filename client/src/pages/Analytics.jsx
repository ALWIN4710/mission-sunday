import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp, BarChart2, Package, Clock, Trophy, Star,
  AlertTriangle, ChevronDown, ChevronUp, Flame, Calendar,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Area, ReferenceLine,
} from 'recharts';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { analyticsService } from '../services';
import { formatINR, formatINRCompact, formatDate, todayIST, getErrorMessage } from '../utils';
import { useNotification } from '../context/NotificationContext';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  'Ice Cream': '#1d5a44',
  'Cone':      '#358a6a',
  'Milkshake': '#57a686',
  'Mojito':    '#89c5ab',
};
const PIE_COLORS = ['#1d5a44', '#57a686', '#89c5ab', '#b8ddcc'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TABS = ['Overview', 'Sales Trends', 'Products', 'Hourly Analysis'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPresets() {
  const today = todayIST();
  const yesterday = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();
  const last7 = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  })();
  const last30 = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  })();
  return [
    { label: 'Today',       startDate: today,     endDate: today },
    { label: 'Yesterday',   startDate: yesterday,  endDate: yesterday },
    { label: 'Last 7 Days', startDate: last7,      endDate: today },
    { label: 'Last 30 Days',startDate: last30,     endDate: today },
  ];
}

function movingAverage(data, key, window = 7) {
  return data.map((d, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, x) => s + (x[key] || 0), 0) / slice.length;
    return { ...d, MA7: Math.round(avg * 100) / 100 };
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {title && <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-forest-200 bg-forest-50' : 'border-gray-100 bg-white'} shadow-card`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className={`text-xl font-bold mt-1 ${accent ? 'text-forest-800' : 'text-gray-900'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${accent ? 'bg-forest-100' : 'bg-gray-50'}`}>
            <Icon className={`w-4 h-4 ${accent ? 'text-forest-700' : 'text-gray-500'}`} />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTooltipINR({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-card px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">
            {typeof p.value === 'number' && p.name !== 'Transactions' && p.name !== 'MA7 (Txns)'
              ? formatINR(p.value * 100)
              : p.value?.toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Date Range Controls ─────────────────────────────────────────────────────

function DateRangeControls({ range, onChange }) {
  const presets = getPresets();
  const [custom, setCustom] = useState(false);

  const isActive = (p) => p.startDate === range.startDate && p.endDate === range.endDate;

  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => { onChange(p); setCustom(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isActive(p)
                ? 'bg-forest-700 text-white border-forest-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-forest-300 hover:text-forest-700'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setCustom((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1 ${
            custom
              ? 'bg-forest-700 text-white border-forest-700'
              : 'bg-white text-gray-600 border-gray-200 hover:border-forest-300 hover:text-forest-700'
          }`}
        >
          <Calendar className="w-3 h-3" /> Custom
        </button>
      </div>
      {custom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => onChange({ ...range, startDate: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            max={todayIST()}
            onChange={(e) => onChange({ ...range, endDate: e.target.value })}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ trend, categories, hourly, volunteers, loading }) {
  if (loading) return <LoadingSpinner size="lg" className="mt-16" />;

  const trendData = (trend || []).map((t) => ({
    date: t._id,
    Revenue: +(t.revenue / 100).toFixed(2),
    Profit:  +(t.profit  / 100).toFixed(2),
  }));

  const catData = (categories || []).map((c) => ({
    name:    c._id,
    Revenue: +(c.revenue / 100).toFixed(2),
    Units:   c.units,
  }));

  const pieData = [
    { name: 'Cash',  value: 0 },
    { name: 'UPI',   value: 0 },
    { name: 'Other', value: 0 },
  ];
  (trend || []).forEach((t) => {
    pieData[0].value += t.cashPaise  || 0;
    pieData[1].value += t.upiPaise   || 0;
    pieData[2].value += t.otherPaise || 0;
  });
  const totalPie = pieData.reduce((s, d) => s + d.value, 0);
  const activePie = pieData.filter((d) => d.value > 0);

  const volData = (volunteers || []).slice(0, 10).map((v, i) => ({
    rank:   i + 1,
    name:   v.name || v.volunteerName || `Volunteer ${i + 1}`,
    txns:   v.transactionCount || v.count || 0,
    sales:  v.totalSalesPaise || v.revenue || 0,
    avg:    v.averageOrderPaise || (v.transactionCount ? Math.round((v.totalSalesPaise || 0) / v.transactionCount) : 0),
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Revenue + Profit trend */}
      <SectionCard title="Revenue & Net Profit Trend">
        {trendData.length === 0 ? (
          <EmptyState title="No trend data" description="Record sales to see the revenue trend." />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => formatDate(v)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatINRCompact(v * 100)} />
              <Tooltip content={<CustomTooltipINR />} />
              <Legend />
              <Line type="monotone" dataKey="Revenue" stroke="#1d5a44" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Profit"  stroke="#57a686" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Category bar chart */}
        <SectionCard title="Sales by Category" className="lg:col-span-2">
          {catData.length === 0 ? (
            <EmptyState title="No category data" description="Record sales to see category breakdown." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={catData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip content={<CustomTooltipINR />} />
                <Legend />
                {catData.map((d, i) => null)}
                <Bar dataKey="Revenue" radius={[4, 4, 0, 0]}>
                  {catData.map((entry, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Payment pie */}
        <SectionCard title="Payment Method Split">
          {activePie.length === 0 ? (
            <EmptyState title="No payment data" description="Complete sales to see breakdown." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={activePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {activePie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [formatINR(v), '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {activePie.map((d, i) => {
                  const pct = totalPie ? ((d.value / totalPie) * 100).toFixed(1) : 0;
                  return (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-gray-600">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-gray-800">{formatINR(d.value)}</span>
                        <span className="text-gray-400 ml-1">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Volunteer leaderboard */}
      <SectionCard title="Volunteer Leaderboard">
        {volData.length === 0 ? (
          <EmptyState title="No volunteer data" description="Sales data will appear here once processed." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium pr-4">#</th>
                  <th className="pb-2 font-medium pr-4">Volunteer</th>
                  <th className="pb-2 font-medium pr-4 text-right">Transactions</th>
                  <th className="pb-2 font-medium pr-4 text-right">Total Sales</th>
                  <th className="pb-2 font-medium text-right">Avg Order</th>
                </tr>
              </thead>
              <tbody>
                {volData.map((v) => (
                  <tr key={v.rank} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-4">
                      {v.rank <= 3 ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          v.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                          v.rank === 2 ? 'bg-gray-100 text-gray-600' :
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {v.rank === 1 ? '🥇' : v.rank === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs pl-1">{v.rank}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-gray-800">{v.name}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-700">{v.txns.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-forest-800">{formatINR(v.sales)}</td>
                    <td className="py-2.5 text-right text-gray-600">{formatINR(v.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Sales Trends Tab ────────────────────────────────────────────────────────

function SalesTrendsTab({ trend, loading }) {
  if (loading) return <LoadingSpinner size="lg" className="mt-16" />;

  const rawData = (trend || []).map((t) => ({
    date:         t._id,
    Revenue:      +(t.revenue / 100).toFixed(2),
    Transactions: t.count || 0,
  }));

  const chartData = movingAverage(rawData, 'Transactions');

  const totalRevenue = rawData.reduce((s, d) => s + d.Revenue, 0);
  const totalTxns    = rawData.reduce((s, d) => s + d.Transactions, 0);
  const dailyAvg     = rawData.length ? totalRevenue / rawData.length : 0;
  const bestDay      = rawData.length
    ? rawData.reduce((best, d) => (d.Revenue > best.Revenue ? d : best), rawData[0])
    : null;

  if (rawData.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="No sales trend data" description="Sales trends will appear here once data is available." />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue"   value={formatINRCompact(totalRevenue * 100)} icon={TrendingUp} accent />
        <StatCard label="Transactions"    value={totalTxns.toLocaleString('en-IN')}    icon={BarChart2} />
        <StatCard label="Daily Average"   value={formatINRCompact(dailyAvg * 100)}     icon={Calendar} />
        <StatCard
          label="Best Day"
          value={bestDay ? formatINRCompact(bestDay.Revenue * 100) : '—'}
          sub={bestDay ? formatDate(bestDay.date) : ''}
          icon={Star}
          accent
        />
      </div>

      <SectionCard title="Daily Revenue & Transaction Count (with 7-Day MA)">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => formatDate(v)} />
            <YAxis yAxisId="left"  tick={{ fontSize: 10 }} tickFormatter={(v) => formatINRCompact(v * 100)} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltipINR />} />
            <Legend />
            <Bar    yAxisId="left"  dataKey="Revenue"      fill="#b8ddcc" radius={[3, 3, 0, 0]} name="Revenue" />
            <Line   yAxisId="left"  dataKey="Revenue"      stroke="#1d5a44" strokeWidth={2} dot={false} name="Revenue" hide />
            <Line   yAxisId="right" dataKey="Transactions" stroke="#d9955a" strokeWidth={2} dot={false} name="Transactions" />
            <Line   yAxisId="right" dataKey="MA7"          stroke="#a85e35" strokeWidth={1.5} dot={false} strokeDasharray="5 3" name="MA7 (Txns)" />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab({ products, categories, loading }) {
  if (loading) return <LoadingSpinner size="lg" className="mt-16" />;

  const prodList = (products || []).map((p, i) => {
    let name = 'Unnamed Product';
    if (typeof p.name === 'string' && p.name) name = p.name;
    else if (typeof p.productName === 'string' && p.productName) name = p.productName;
    else if (typeof p._id === 'object' && p._id?.name) name = p._id.name;
    else if (typeof p._id === 'string' && p._id) name = p._id;

    let category = 'General';
    if (typeof p.category === 'string' && p.category) category = p.category;
    else if (typeof p._id === 'object' && p._id?.category) category = p._id.category;

    return {
      rank:     i + 1,
      name,
      category,
      units:    p.units || p.unitsSold || 0,
      revenue:  p.revenue || p.totalRevenuePaise || 0,
    };
  });

  const totalRevenue = prodList.reduce((s, p) => s + p.revenue, 0);

  const catMap = {};
  (categories || []).forEach((c) => {
    catMap[c._id] = { revenue: c.revenue || 0, units: c.units || 0 };
  });
  const catTotal = Object.values(catMap).reduce((s, c) => s + c.revenue, 0);

  const sorted   = [...prodList].sort((a, b) => b.revenue - a.revenue);
  const top      = sorted.slice(0, 10);
  const slow     = sorted.slice(-5).reverse();

  if (prodList.length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="No product data" description="Product performance data will appear here once sales are recorded." />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top products table */}
      <SectionCard title="Top Products by Revenue">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium pr-3">#</th>
                <th className="pb-2 font-medium pr-3">Product</th>
                <th className="pb-2 font-medium pr-3">Category</th>
                <th className="pb-2 font-medium pr-3 text-right">Units Sold</th>
                <th className="pb-2 font-medium pr-3 text-right">Revenue</th>
                <th className="pb-2 font-medium text-right">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p) => {
                const pct = totalRevenue ? ((p.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
                return (
                  <tr key={p.rank} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 pr-3 text-gray-400 text-xs">{p.rank}</td>
                    <td className="py-2.5 pr-3 font-medium text-gray-800">{p.name}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: (CATEGORY_COLORS[p.category] || '#1d5a44') + '20',
                          color: CATEGORY_COLORS[p.category] || '#1d5a44',
                        }}
                      >
                        {p.category}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right text-gray-700">{p.units.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-forest-800">{formatINR(p.revenue)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-forest-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Category performance cards */}
        <SectionCard title="Category Performance">
          <div className="space-y-3">
            {Object.entries(catMap).map(([cat, data]) => {
              const pct = catTotal ? (data.revenue / catTotal) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: CATEGORY_COLORS[cat] || '#1d5a44' }}
                      />
                      <span className="font-medium text-gray-700">{cat}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-gray-800">{formatINR(data.revenue)}</span>
                      <span className="text-xs text-gray-400 ml-1">({pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: CATEGORY_COLORS[cat] || '#1d5a44',
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(catMap).length === 0 && (
              <EmptyState title="No category data" description="Category data will appear here." />
            )}
          </div>
        </SectionCard>

        {/* Slow-moving products */}
        <SectionCard title="Slow-Moving Products">
          {slow.length === 0 ? (
            <EmptyState title="No data" description="Slow-moving products will appear here." />
          ) : (
            <div className="space-y-2">
              {slow.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">{p.units.toLocaleString('en-IN')} units</p>
                    <p className="text-xs text-gray-400">{formatINR(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Hourly Analysis Tab ──────────────────────────────────────────────────────

function HourlyAnalysisTab({ hourly, loading }) {
  if (loading) return <LoadingSpinner size="lg" className="mt-16" />;

  // hourly: array of { hour: 0-23, count, revenue, dayOfWeek: 1-7 }
  const hourlyAgg = Array.from({ length: 24 }, (_, h) => ({
    hour:         h,
    label:        h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
    Transactions: 0,
    Revenue:      0,
  }));

  (hourly || []).forEach((d) => {
    const h = d.hour ?? d._id?.hour ?? null;
    if (h !== null && h >= 0 && h < 24) {
      hourlyAgg[h].Transactions += d.count || d.transactions || 0;
      hourlyAgg[h].Revenue      += (d.revenue || 0) / 100;
    }
  });

  const maxTxns    = Math.max(...hourlyAgg.map((h) => h.Transactions), 1);
  const peakHour   = hourlyAgg.reduce((best, h) => (h.Transactions > best.Transactions ? h : best), hourlyAgg[0]);

  // Heatmap: [dayOfWeek 1-7][hour 0-23]
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  (hourly || []).forEach((d) => {
    const h   = d.hour ?? d._id?.hour ?? null;
    const dow = d.dayOfWeek ?? d._id?.dayOfWeek ?? null; // 1=Mon, 7=Sun
    if (h !== null && dow !== null && h >= 0 && h < 24 && dow >= 1 && dow <= 7) {
      heatmap[dow - 1][h] += d.count || 0;
    }
  });
  const heatMax = Math.max(...heatmap.flat(), 1);

  if ((hourly || []).length === 0) {
    return (
      <div className="animate-fade-in">
        <EmptyState title="No hourly data" description="Hourly analytics will appear here once sales are recorded." />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Peak hour card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 rounded-xl border border-forest-200 bg-forest-50 p-4 shadow-card flex items-center gap-4">
          <div className="p-3 bg-forest-100 rounded-xl">
            <Flame className="w-6 h-6 text-forest-700" />
          </div>
          <div>
            <p className="text-xs text-forest-600 font-medium uppercase tracking-wide">Peak Hour</p>
            <p className="text-2xl font-bold text-forest-800">{peakHour.label}</p>
            <p className="text-xs text-forest-600">{peakHour.Transactions.toLocaleString('en-IN')} transactions</p>
          </div>
        </div>
        <StatCard
          label="Peak Hour Revenue"
          value={formatINRCompact(peakHour.Revenue * 100)}
          sub={`${peakHour.label} total`}
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Revenue/Hour"
          value={formatINRCompact((hourlyAgg.reduce((s, h) => s + h.Revenue, 0) / 24) * 100)}
          icon={BarChart2}
        />
      </div>

      {/* Bar chart */}
      <SectionCard title="Average Transactions Per Hour">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourlyAgg} barSize={14}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(v, name) => [v.toLocaleString('en-IN'), name]}
              labelFormatter={(l) => `Hour: ${l}`}
            />
            <Bar dataKey="Transactions" radius={[3, 3, 0, 0]}>
              {hourlyAgg.map((h, i) => (
                <Cell
                  key={i}
                  fill={h.hour === peakHour.hour ? '#1d5a44' : '#89c5ab'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Heatmap */}
      <SectionCard title="Sales Heatmap (Day × Hour) — darker = more activity">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Hour labels */}
            <div className="flex ml-8 mb-1">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-gray-400">
                  {h % 3 === 0 ? (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`) : ''}
                </div>
              ))}
            </div>
            {heatmap.map((row, dayIdx) => (
              <div key={dayIdx} className="flex items-center mb-0.5">
                <div className="w-8 text-[10px] text-gray-500 text-right pr-1.5 flex-shrink-0">{DAYS[dayIdx]}</div>
                {row.map((val, hourIdx) => {
                  const intensity = val / heatMax;
                  const alpha = 0.08 + intensity * 0.92;
                  return (
                    <div
                      key={hourIdx}
                      className="flex-1 h-5 rounded-[2px] mx-px cursor-default"
                      style={{ background: `rgba(29,90,68,${alpha})` }}
                      title={`${DAYS[dayIdx]} ${hourIdx}:00 — ${val} transactions`}
                    />
                  );
                })}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-xs text-gray-400">Low</span>
              {[0.08, 0.3, 0.5, 0.7, 0.9, 1].map((a) => (
                <div
                  key={a}
                  className="w-4 h-4 rounded-sm"
                  style={{ background: `rgba(29,90,68,${a})` }}
                />
              ))}
              <span className="text-xs text-gray-400">High</span>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export default function Analytics() {
  const { error: notifyError } = useNotification();
  const presets = getPresets();
  const [range, setRange]         = useState(presets[2]); // Last 7 Days default
  const [activeTab, setActiveTab] = useState(0);

  const [trend,      setTrend]      = useState([]);
  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [hourly,     setHourly]     = useState([]);
  const [volunteers, setVolunteers] = useState([]);

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingTrend,    setLoadingTrend]    = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingHourly,   setLoadingHourly]   = useState(false);

  const params = useMemo(() => ({
    startDate: range.startDate,
    endDate:   range.endDate,
  }), [range.startDate, range.endDate]);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [trendRes, catRes, volRes] = await Promise.all([
        analyticsService.getSalesTrend(params),
        analyticsService.getCategories(params),
        analyticsService.getVolunteers(params),
      ]);
      setTrend(trendRes.data.trend || trendRes.data.data || []);
      setCategories(catRes.data.categories || catRes.data.data || []);
      setVolunteers(volRes.data.volunteers || volRes.data.data || []);
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setLoadingOverview(false);
    }
  }, [params, notifyError]);

  const loadTrend = useCallback(async () => {
    setLoadingTrend(true);
    try {
      const res = await analyticsService.getSalesTrend(params);
      setTrend(res.data.trend || res.data.data || []);
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setLoadingTrend(false);
    }
  }, [params, notifyError]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        analyticsService.getProducts(params),
        analyticsService.getCategories(params),
      ]);
      setProducts(prodRes.data.products || prodRes.data.data || []);
      setCategories(catRes.data.categories || catRes.data.data || []);
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setLoadingProducts(false);
    }
  }, [params, notifyError]);

  const loadHourly = useCallback(async () => {
    setLoadingHourly(true);
    try {
      const res = await analyticsService.getHourly(params);
      setHourly(res.data.hourly || res.data.data || []);
    } catch (err) {
      notifyError(getErrorMessage(err));
    } finally {
      setLoadingHourly(false);
    }
  }, [params, notifyError]);

  // Load data when tab or params change
  useEffect(() => {
    if (activeTab === 0) loadOverview();
    if (activeTab === 1) loadTrend();
    if (activeTab === 2) loadProducts();
    if (activeTab === 3) loadHourly();
  }, [activeTab, params]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-load overview on mount regardless of tab
  useEffect(() => {
    loadOverview();
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Deep-dive into sales performance and trends.</p>
        </div>
        <DateRangeControls range={range} onChange={setRange} />
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === i
                  ? 'border-forest-700 text-forest-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <OverviewTab
          trend={trend}
          categories={categories}
          hourly={hourly}
          volunteers={volunteers}
          loading={loadingOverview}
        />
      )}
      {activeTab === 1 && (
        <SalesTrendsTab trend={trend} loading={loadingTrend} />
      )}
      {activeTab === 2 && (
        <ProductsTab products={products} categories={categories} loading={loadingProducts} />
      )}
      {activeTab === 3 && (
        <HourlyAnalysisTab hourly={hourly} loading={loadingHourly} />
      )}
    </div>
  );
}
