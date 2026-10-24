import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatINR, formatINRCompact } from '../../utils';

export function KPICard({ label, valuePaise, valueCount, subtitle, trend, icon: Icon, color = 'forest', compact = false }) {
  const colorMap = {
    forest:  { bg: 'bg-forest-50',  icon: 'text-forest-600',  border: 'border-forest-100' },
    green:   { bg: 'bg-green-50',   icon: 'text-green-600',   border: 'border-green-100' },
    red:     { bg: 'bg-red-50',     icon: 'text-red-500',     border: 'border-red-100' },
    yellow:  { bg: 'bg-yellow-50',  icon: 'text-yellow-600',  border: 'border-yellow-100' },
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    border: 'border-blue-100' },
    sand:    { bg: 'bg-sand-50',    icon: 'text-sand-600',    border: 'border-sand-100' },
  };
  const c = colorMap[color] || colorMap.forest;

  const displayValue = valuePaise !== undefined
    ? (compact ? formatINRCompact(valuePaise) : formatINR(valuePaise))
    : (valueCount !== undefined ? valueCount.toLocaleString('en-IN') : '—');

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="kpi-card group hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <p className="kpi-label">{label}</p>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4.5 h-4.5 ${c.icon}`} />
          </div>
        )}
      </div>
      <p className="kpi-value">{displayValue}</p>
      <div className="flex items-center gap-2">
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(trend)}%
          </span>
        )}
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}
