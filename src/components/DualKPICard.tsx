import { LucideIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
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
    <div className={cn('kpi-card animate-fade-in relative', className)}>
      {Icon && (
        <div className="flex justify-end mb-2">
          <div className="p-1.5 rounded-md bg-white/15">
            <Icon className="h-4 w-4 text-white/80" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className={cn(idx === 1 && 'pt-3 border-t border-white/20', 'relative')}>
            <span className="text-xs font-bold text-white uppercase tracking-wider">{item.label}</span>
            <div className={cn(
              "font-bold text-white tracking-tight text-base sm:text-lg leading-tight mt-0.5",
              item.status === 'green' && 'text-emerald-200',
              item.status === 'red' && 'text-rose-200',
            )}>
              {item.value}
            </div>
            {item.changeLabel && (
              <span className="text-xs text-white/70">{item.changeLabel}</span>
            )}
            {item.tooltip && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Keterangan KPI"
                      className="absolute -top-0.5 right-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/15 hover:bg-white/30 text-white/90 cursor-help transition-colors"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipPrimitive.Portal>
                    <TooltipContent side="top" align="end" sideOffset={6} className="max-w-[260px] text-xs leading-relaxed z-[9999]">
                      {item.tooltip}
                    </TooltipContent>
                  </TooltipPrimitive.Portal>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
