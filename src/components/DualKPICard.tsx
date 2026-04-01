import { LucideIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KPIItem {
  label: string;
  value: string;
  status?: 'green' | 'yellow' | 'red';
  changeLabel?: string;
  tooltip?: string;
}

interface DualKPICardProps {
  items: [KPIItem, KPIItem];
  icon?: LucideIcon;
  className?: string;
}

export function DualKPICard({ items, icon: Icon, className }: DualKPICardProps) {
  return (
    <div className={cn('kpi-card animate-fade-in', className)}>
      {Icon && (
        <div className="flex justify-end mb-2">
          <div className="p-1.5 rounded-md bg-secondary">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className={cn(idx === 1 && 'pt-3 border-t border-border')}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{item.label}</span>
              {item.tooltip && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                      {item.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className={cn(
              "font-bold text-foreground tracking-tight text-base sm:text-lg leading-tight mt-0.5",
              item.status === 'green' && 'text-status-green',
              item.status === 'red' && 'text-status-red',
            )}>
              {item.value}
            </div>
            {item.changeLabel && (
              <span className="text-xs text-muted-foreground">{item.changeLabel}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
