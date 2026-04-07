import { LucideIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{label}</span>
        {Icon && (
          <Icon className={cn(
            'h-4 w-4',
            status === 'green' && 'text-status-green',
            status === 'yellow' && 'text-status-yellow',
            status === 'red' && 'text-status-red',
            !status && 'text-muted-foreground',
          )} />
        )}
      </div>
      <div className={cn(
        "font-bold text-foreground tracking-tight",
        autoFitText ? "text-base sm:text-lg lg:text-xl break-all leading-tight" : "text-2xl"
      )}>{value}</div>
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
      {tooltip && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="absolute bottom-2 right-2 h-3.5 w-3.5 text-muted-foreground/50 cursor-help hover:text-muted-foreground transition-colors" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed z-[100]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
