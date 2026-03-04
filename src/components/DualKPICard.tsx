import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPIItem {
  label: string;
  value: string;
  status?: 'green' | 'yellow' | 'red';
  changeLabel?: string;
}

interface DualKPICardProps {
  items: [KPIItem, KPIItem];
  icon?: LucideIcon;
  className?: string;
}

export function DualKPICard({ items, icon: Icon, className }: DualKPICardProps) {
  return (
    <div className={cn('kpi-card animate-fade-in', className)}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{items[0].label}</span>
        {Icon && (
          <div className="p-1 rounded-md bg-secondary shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className={cn(
        "font-bold tracking-tight text-sm sm:text-base break-all leading-tight",
        items[0].status === 'green' && 'text-status-green',
        items[0].status === 'red' && 'text-status-red',
        !items[0].status && 'text-foreground',
      )}>
        {items[0].value}
      </div>
      {items[0].changeLabel && (
        <span className="text-[10px] text-muted-foreground leading-none">{items[0].changeLabel}</span>
      )}

      <div className="border-t border-border my-1.5 pt-1.5">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-tight">{items[1].label}</span>
        <div className={cn(
          "font-bold tracking-tight text-sm sm:text-base break-all leading-tight mt-0.5",
          items[1].status === 'green' && 'text-status-green',
          items[1].status === 'red' && 'text-status-red',
          !items[1].status && 'text-foreground',
        )}>
          {items[1].value}
        </div>
        {items[1].changeLabel && (
          <span className="text-[10px] text-muted-foreground leading-none">{items[1].changeLabel}</span>
        )}
      </div>
    </div>
  );
}
