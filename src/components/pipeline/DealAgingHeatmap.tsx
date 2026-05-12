import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatIDRFull } from '@/types/sales';
import { Flame } from 'lucide-react';

interface DealRow {
  sales_id: string;
  stage: string;
  value: number;
  days_in_stage: number;
}

interface DealAgingHeatmapProps {
  deals: DealRow[];
  getSalesName: (id: string) => string;
  salesPersons: { id: string; name: string }[];
}

const OPEN_STAGES = ['prospect', 'quotation', 'negotiation'];
const STAGE_LABELS: Record<string, string> = {
  prospect: 'Prospect',
  quotation: 'Quotation',
  negotiation: 'Negotiation',
};

function agingColor(avgDays: number, count: number): { bg: string; text: string; label: string } {
  if (count === 0) return { bg: 'bg-muted/30', text: 'text-muted-foreground', label: '' };
  if (avgDays <= 7)  return { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  label: 'Fresh' };
  if (avgDays <= 14) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Warning' };
  if (avgDays <= 30) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'At Risk' };
  return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Stagnant' };
}

export function DealAgingHeatmap({ deals, getSalesName, salesPersons }: DealAgingHeatmapProps) {
  const openDeals = useMemo(() => deals.filter(d => OPEN_STAGES.includes(d.stage)), [deals]);

  // Get unique salespeople who have at least one open deal
  const activeSalesIds = useMemo(() => {
    const ids = new Set(openDeals.map(d => d.sales_id));
    return salesPersons.filter(s => ids.has(s.id));
  }, [openDeals, salesPersons]);

  // Build cell data: salesId × stage → { count, avgDays, totalValue }
  const cellData = useMemo(() => {
    const map: Record<string, Record<string, { count: number; totalDays: number; totalValue: number }>> = {};
    activeSalesIds.forEach(s => {
      map[s.id] = {};
      OPEN_STAGES.forEach(stage => { map[s.id][stage] = { count: 0, totalDays: 0, totalValue: 0 }; });
    });
    openDeals.forEach(d => {
      if (!map[d.sales_id]) return;
      map[d.sales_id][d.stage].count += 1;
      map[d.sales_id][d.stage].totalDays += d.days_in_stage;
      map[d.sales_id][d.stage].totalValue += d.value;
    });
    return map;
  }, [openDeals, activeSalesIds]);

  if (activeSalesIds.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" /> Deal Aging Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">Tidak ada open deal saat ini</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" /> Deal Aging Heatmap
          </CardTitle>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-200 inline-block" /> ≤7d Fresh</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-200 inline-block" /> ≤14d Warning</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-200 inline-block" /> ≤30d At Risk</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block" /> &gt;30d Stagnant</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <TooltipProvider>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-muted-foreground w-40">Sales</th>
                  {OPEN_STAGES.map(stage => (
                    <th key={stage} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground min-w-[120px]">
                      {STAGE_LABELS[stage]}
                    </th>
                  ))}
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground min-w-[80px]">Total Deals</th>
                </tr>
              </thead>
              <tbody>
                {activeSalesIds.map((sp, rowIdx) => {
                  const totalDeals = OPEN_STAGES.reduce((s, stage) => s + cellData[sp.id][stage].count, 0);
                  return (
                    <tr key={sp.id} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="py-2 pr-4 text-xs font-medium truncate max-w-[160px]" title={sp.name}>
                        {sp.name}
                      </td>
                      {OPEN_STAGES.map(stage => {
                        const cell = cellData[sp.id][stage];
                        const avgDays = cell.count > 0 ? Math.round(cell.totalDays / cell.count) : 0;
                        const { bg, text, label } = agingColor(avgDays, cell.count);
                        return (
                          <td key={stage} className="py-1.5 px-2 text-center">
                            {cell.count === 0 ? (
                              <span className="text-muted-foreground/40 text-xs">—</span>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`inline-flex flex-col items-center rounded-md px-3 py-1.5 cursor-default ${bg}`}>
                                    <span className={`text-xs font-bold ${text}`}>{cell.count} deal</span>
                                    <span className={`text-[10px] ${text}`}>avg {avgDays}d</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs space-y-1 max-w-[200px]">
                                  <p className="font-semibold">{sp.name} — {STAGE_LABELS[stage]}</p>
                                  <p>Jumlah deal: <strong>{cell.count}</strong></p>
                                  <p>Avg hari di stage: <strong>{avgDays} hari</strong></p>
                                  <p>Total nilai: <strong>{formatIDRFull(cell.totalValue)}</strong></p>
                                  <p className={`font-semibold ${text}`}>Status: {label}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center">
                        <span className="text-xs font-semibold">{totalDeals}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
