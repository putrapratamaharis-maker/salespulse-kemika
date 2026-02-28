import { Deal, formatIDR } from '@/types/sales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';

const stageOrder = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued', 'canceled', 'lost'];
const stageLabels: Record<string, string> = {
  prospect: 'Prospect',
  quotation: 'Quotation',
  negotiation: 'Negotiation',
  po_secured: 'PO Secured/Won',
  invoice_issued: 'Invoice Issued',
  canceled: 'Canceled',
  lost: 'Lost',
};
const stageColors: Record<string, 'green' | 'yellow' | 'red'> = {
  prospect: 'red',
  quotation: 'yellow',
  negotiation: 'yellow',
  po_secured: 'green',
  invoice_issued: 'green',
  canceled: 'red',
  lost: 'red',
};

const stageBgColors: Record<string, string> = {
  prospect: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  quotation: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
  negotiation: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  po_secured: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  invoice_issued: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  canceled: 'bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800',
  lost: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
};

interface KanbanBoardProps {
  deals: Deal[];
  getAccountName: (accountId: string) => string;
}

export function KanbanBoard({ deals, getAccountName }: KanbanBoardProps) {
  const kanbanData = stageOrder.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    const totalValue = stageDeals.reduce((s, d) => s + d.value, 0);
    return { stage, label: stageLabels[stage], color: stageColors[stage], deals: stageDeals, totalValue };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Pipeline Kanban</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        <ScrollArea className="w-full">
          <div className="flex gap-3 px-6 min-w-max">
            {kanbanData.map(col => (
              <div key={col.stage} className={`flex flex-col w-56 shrink-0 rounded-lg border ${stageBgColors[col.stage]}`}>
                {/* Column Header */}
                <div className="p-3 border-b border-inherit">
                  <div className="flex items-center justify-between mb-1">
                    <StatusBadge status={col.color} label={col.label} />
                    <span className="text-xs font-semibold text-muted-foreground">{col.deals.length}</span>
                  </div>
                  <p className="text-xs font-bold text-foreground">{formatIDR(col.totalValue)}</p>
                </div>

                {/* Deal Cards */}
                <div className="p-2 space-y-2 min-h-[80px] max-h-[300px] overflow-y-auto">
                  {col.deals.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                  ) : (
                    col.deals.map(d => (
                      <div key={d.id} className="bg-card rounded-md border shadow-sm p-2.5 space-y-1">
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getAccountName(d.accountId)}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{formatIDR(d.value)}</span>
                          <span className="text-[10px] text-muted-foreground">{d.probability}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
