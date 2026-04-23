import { LucideIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface KPICardProps {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  status?: 'green' | 'yellow' | 'red';
  icon?: LucideIcon;
  className?: string;
  autoFitText?: boolean;
  borderAccent?: string;
  tooltip?: string;
}

export function KPICard({ label, value, change, changeLabel, status, icon: Icon, className, autoFitText, borderAccent, tooltip }: KPICardProps) {
  return (
    <div className={cn('kpi-card animate-fade-in relative', className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-bold text-white uppercase tracking-wider">{label}</span>
        {Icon && (
          <Icon className={cn(
            'h-4 w-4',
            status === 'green' && 'text-emerald-200',
            status === 'yellow' && 'text-amber-200',
            status === 'red' && 'text-rose-200',
            !status && 'text-white/70',
          )} />
        )}
      </div>
      <div className={cn(
        "font-bold text-white tracking-tight",
        autoFitText ? "text-base sm:text-lg lg:text-xl break-all leading-tight" : "text-2xl"
      )}>{value}</div>
      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-1 mt-1.5">
          {change !== undefined && (
            <span className={cn(
              'text-xs font-semibold',
              change >= 0 ? 'text-emerald-200' : 'text-rose-200'
            )}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
          )}
          {changeLabel && <span className="text-xs text-white/70">{changeLabel}</span>}
        </div>
      )}
      {tooltip && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Keterangan KPI"
                className="absolute bottom-2 right-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/15 hover:bg-white/30 text-white/90 cursor-help transition-colors"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
              <TooltipContent side="top" align="end" sideOffset={6} className="max-w-[260px] text-xs leading-relaxed z-[9999]">
                {tooltip}
              </TooltipContent>
            </TooltipPrimitive.Portal>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
