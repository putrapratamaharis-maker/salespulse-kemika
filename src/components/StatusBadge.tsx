import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'green' | 'yellow' | 'red';
  label: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
      status === 'green' && 'status-badge-green',
      status === 'yellow' && 'status-badge-yellow',
      status === 'red' && 'status-badge-red',
      className,
    )}>
      {label}
    </span>
  );
}
