import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RefreshKPIsButtonProps {
  onRefresh: () => Promise<void> | void;
  className?: string;
  /** Show short status text next to button after run */
  showStatus?: boolean;
}

/**
 * Shared "Refresh KPIs" button for corporate dashboard pages.
 * Triggers re-fetch via the page's RPCs. Displays loading + success/error states.
 */
export function RefreshKPIsButton({ onRefresh, className, showStatus = true }: RefreshKPIsButtonProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const handleClick = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setStatus('idle');
    try {
      await onRefresh();
      setStatus('success');
      setLastUpdated(new Date());
      toast.success('KPIs refreshed successfully');
    } catch (err: any) {
      setStatus('error');
      toast.error('Refresh failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showStatus && status === 'success' && lastUpdated && (
        <span className="flex items-center gap-1 text-xs text-status-green">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Updated {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
      {showStatus && status === 'error' && (
        <span className="flex items-center gap-1 text-xs text-status-red">
          <AlertCircle className="h-3.5 w-3.5" />
          Refresh failed
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={refreshing}
        className="h-8 gap-1.5"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
        {refreshing ? 'Refreshing…' : 'Refresh KPIs'}
      </Button>
    </div>
  );
}