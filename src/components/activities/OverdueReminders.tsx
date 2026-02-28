import { useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SalesActivity {
  id: string;
  type: string;
  activity_date: string;
  account_id: string | null;
  notes: string | null;
  next_action_date: string | null;
}

interface Account {
  id: string;
  name: string;
}

const activityLabels: Record<string, string> = {
  call_chat: 'Call/Chat',
  visit: 'Visit',
  online_meeting: 'Online Meeting',
  training: 'Training',
  demo: 'Demo',
};

interface OverdueRemindersProps {
  activities: SalesActivity[];
  accounts: Account[];
}

export const OverdueReminders = ({ activities, accounts }: OverdueRemindersProps) => {
  const overdueItems = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return activities
      .filter(a => a.next_action_date && a.next_action_date < today)
      .sort((a, b) => (a.next_action_date! > b.next_action_date! ? 1 : -1))
      .slice(0, 10);
  }, [activities]);

  if (overdueItems.length === 0) return null;

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '';
    return accounts.find(a => a.id === accountId)?.name || '';
  };

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">
        Overdue Reminders ({overdueItems.length})
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1.5">
          {overdueItems.map(item => {
            const daysOverdue = differenceInDays(new Date(), new Date(item.next_action_date!));
            const account = getAccountName(item.account_id);
            return (
              <li key={item.id} className="text-xs flex items-start gap-2">
                <span className="font-medium text-destructive whitespace-nowrap">
                  {daysOverdue}d overdue
                </span>
                <span className="text-foreground">
                  <strong>{activityLabels[item.type] || item.type}</strong>
                  {account ? ` — ${account}` : ''}
                  {' · '}
                  Due {format(new Date(item.next_action_date!), 'dd MMM yyyy')}
                  {item.notes ? ` · ${item.notes.substring(0, 60)}${item.notes.length > 60 ? '…' : ''}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
