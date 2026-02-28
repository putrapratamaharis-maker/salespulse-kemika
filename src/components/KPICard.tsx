import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  status?: 'green' | 'yellow' | 'red';
  icon?: LucideIcon;
  className?: string;
}

export function KPICard({ label, value, change, changeLabel, status, icon: Icon, className }: KPICardProps) {
  return (
    <div className={cn('kpi-card animate-fade-in', className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && (
          <div className={cn(
            'p-1.5 rounded-md',
            status === 'green' && 'bg-status-green-bg',
            status === 'yellow' && 'bg-status-yellow-bg',
            status === 'red' && 'bg-status-red-bg',
            !status && 'bg-secondary',
          )}>
            <Icon className={cn(
              'h-4 w-4',
              status === 'green' && 'text-status-green',
              status === 'yellow' && 'text-status-yellow',
              status === 'red' && 'text-status-red',
              !status && 'text-muted-foreground',
            )} />
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-1 mt-1.5">
          {change !== undefined && (
            <span className={cn(
              'text-xs font-semibold',
              change >= 0 ? 'text-status-green' : 'text-status-red'
            )}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
          )}
          {changeLabel && <span className="text-xs text-muted-foreground">{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
