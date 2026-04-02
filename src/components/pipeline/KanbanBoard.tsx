import { useState, useRef, useMemo, DragEvent } from 'react';
import { Deal, DealStage, Segment, formatIDR, formatDate } from '@/types/sales';
import { CalendarClock, Percent } from 'lucide-react';
import { DealDetailDialog } from '@/components/pipeline/DealDetailDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, GripVertical, Search, Filter, X, Copy } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StageTransitionDialog } from '@/components/pipeline/StageTransitionDialog';
import { InvoiceTransitionDialog } from '@/components/pipeline/InvoiceTransitionDialog';
import { DeleteDealRequestDialog } from '@/components/pipeline/DeleteDealRequestDialog';

const stageOrder: DealStage[] = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued', 'canceled', 'lost'];
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

import { AccountPIC } from '@/components/pipeline/DealDetailDialog';

interface KanbanBoardProps {
  deals: Deal[];
  getAccountName: (accountId: string) => string;
  getAccountPIC?: (accountId: string) => AccountPIC | undefined;
  getSalesName?: (salesId: string) => string;
  onEdit?: (deal: Deal) => void;
  onDelete?: (deal: Deal, reason: string) => void;
  onDuplicate?: (deal: Deal) => void;
  onStageChange?: (dealId: string, newStage: DealStage, extraData?: { poNumber: string; closeDate: string }) => void;
  readOnly?: boolean;
}

const segmentOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'All Segments' },
  { value: 'B2G', label: 'B2G' },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C/e-Commerce' },
];

const valueRanges = [
  { value: 'all', label: 'All Values' },
  { value: 'under50', label: '< Rp 50 Jt' },
  { value: '50to200', label: 'Rp 50–200 Jt' },
  { value: 'above200', label: '> Rp 200 Jt' },
];

const stageFilterOptions = [
  { value: 'all', label: 'All Stages' },
  ...stageOrder.map(s => ({ value: s, label: stageLabels[s] })),
];

function getMonthOptions(): { value: string; label: string }[] {
  const months = [];
  const now = new Date();
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });
    months.push({ value: val, label });
  }
  return months;
}

export function KanbanBoard({ deals, getAccountName, getAccountPIC, getSalesName, onEdit, onDelete, onDuplicate, onStageChange, readOnly }: KanbanBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [valueFilter, setValueFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [stageConfirm, setStageConfirm] = useState<{ deal: Deal; targetStage: DealStage } | null>(null);
  const dragDealId = useRef<string | null>(null);

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = d.name.toLowerCase().includes(q);
        const matchAccount = getAccountName(d.accountId).toLowerCase().includes(q);
        if (!matchName && !matchAccount) return false;
      }
      if (segmentFilter !== 'all' && d.segment !== segmentFilter) return false;
      if (valueFilter === 'under50' && d.value >= 50_000_000) return false;
      if (valueFilter === '50to200' && (d.value < 50_000_000 || d.value > 200_000_000)) return false;
      if (valueFilter === 'above200' && d.value <= 200_000_000) return false;
      if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
      if (monthFilter !== 'all') {
        const dealDate = d.expectedCloseDate || d.createdAt;
        if (dealDate) {
          const dt = new Date(dealDate);
          const dealMonth = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
          if (dealMonth !== monthFilter) return false;
        }
      }
      return true;
    });
  }, [deals, searchQuery, segmentFilter, valueFilter, stageFilter, monthFilter, getAccountName]);

  const hasActiveFilters = searchQuery || segmentFilter !== 'all' || valueFilter !== 'all' || stageFilter !== 'all' || monthFilter !== 'all';

  const kanbanData = stageOrder.map(stage => {
    const stageDeals = filteredDeals.filter(d => d.stage === stage);
    const totalValue = stageDeals.reduce((s, d) => s + d.value, 0);
    return { stage, label: stageLabels[stage], color: stageColors[stage], deals: stageDeals, totalValue };
  });

  const handleDragStart = (e: DragEvent, dealId: string) => {
    dragDealId.current = dealId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dealId);
  };

  const handleDragOver = (e: DragEvent, stage: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const finalStages: DealStage[] = ['po_secured', 'invoice_issued', 'canceled', 'lost'];
  const formStages: DealStage[] = ['po_secured', 'invoice_issued'];

  const handleDrop = (e: DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = dragDealId.current;
    if (dealId && onStageChange) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage !== targetStage) {
        if (formStages.includes(targetStage as DealStage)) {
          setStageConfirm({ deal, targetStage: targetStage as DealStage });
        } else if (finalStages.includes(targetStage as DealStage)) {
          setStageConfirm({ deal, targetStage: targetStage as DealStage });
        } else {
          onStageChange(dealId, targetStage as DealStage);
        }
      }
    }
    dragDealId.current = null;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Pipeline Kanban</CardTitle>
              {hasActiveFilters && (
                <span className="text-xs text-muted-foreground font-normal">
                  {filteredDeals.length} / {deals.length} deals
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search deal or account..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select value={segmentFilter} onValueChange={setSegmentFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {segmentOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={valueFilter} onValueChange={setValueFilter}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {valueRanges.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 w-[150px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageFilterOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Months</SelectItem>
                  {monthOptions.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSearchQuery(''); setSegmentFilter('all'); setValueFilter('all'); setStageFilter('all'); setMonthFilter('all'); }}>
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <ScrollArea className="w-full">
            <div className="flex gap-3 px-6 pb-2">
              {kanbanData.map(col => (
                <div
                  key={col.stage}
                  className={`flex flex-col w-[220px] shrink-0 rounded-lg border transition-all ${stageBgColors[col.stage]} ${dragOverStage === col.stage ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onDragOver={(e) => handleDragOver(e, col.stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.stage)}
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-inherit">
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={col.color} label={col.label} />
                      <span className="text-xs font-semibold text-muted-foreground">{col.deals.length}</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{formatIDR(col.totalValue)}</p>
                  </div>

                  {/* Deal Cards */}
                  <div className="p-2 space-y-2">
                    {col.deals.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                    ) : (
                      col.deals.map(d => (
                        <div
                          key={d.id}
                          draggable={!readOnly}
                          onDragStart={(e) => !readOnly && handleDragStart(e, d.id)}
                          className={`bg-card rounded-md border shadow-sm p-2.5 space-y-1 overflow-hidden ${readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} hover:shadow-md transition-shadow group font-normal`}
                          onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setDetailDeal(d); }}
                        >
                        {/* Account name - bold on top */}
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-bold text-foreground leading-tight truncate flex-1 min-w-0" title={getAccountName(d.accountId)}>
                            <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline mr-0.5 align-text-bottom" />
                            {getAccountName(d.accountId)}
                          </p>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onDuplicate && (
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onDuplicate(d); }} title="Duplikasi deal">
                                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </Button>
                            )}
                            {onEdit && (
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); onEdit(d); }}>
                                <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); setDeleteTarget(d); }}>
                                <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Deal name - only show if no products */}
                        {(!d.products || d.products.length === 0) && (
                          <p className="text-[11px] font-medium text-foreground/80 break-words">{d.name}</p>
                        )}

                        {/* Sales name (for global pipeline) */}
                        {getSalesName && (
                          <p className="text-[10px] text-muted-foreground break-words">{getSalesName(d.salesId)}</p>
                        )}

                        {/* Products list - max 3 items */}
                        {d.products && d.products.length > 0 && (
                          <div className="space-y-0.5 pt-0.5 overflow-hidden">
                            {d.products.slice(0, 3).map((p, i) => (
                              <p key={i} className="text-[10px] text-muted-foreground break-words" title={`${p.productName} (${p.qty} ${p.unit})`}>
                                • {p.productName} ({p.qty} {p.unit})
                              </p>
                            ))}
                            {d.products.length > 3 && (
                              <p className="text-[10px] text-muted-foreground italic">+{d.products.length - 3} item lainnya</p>
                            )}
                          </div>
                        )}

                        {/* Value row */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-foreground">{formatIDR(d.value)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{d.segment}</span>
                        </div>

                        {/* Meta row: expected close, margin, probability */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/50 gap-1">
                          <span className="flex items-center gap-0.5" title="Expected Close">
                            <CalendarClock className="h-3 w-3" />
                            {formatDate(d.expectedCloseDate)}
                          </span>
                          <div className="flex items-center gap-2">
                            {d.expectedMargin != null && d.expectedMargin > 0 && (
                              <span title="Expected Margin">M: {d.expectedMargin}%</span>
                            )}
                            <span
                              title="Probability"
                              className={`font-semibold ${
                                d.probability === 100 ? 'text-emerald-600 dark:text-emerald-400'
                                : d.probability >= 80 ? 'text-blue-600 dark:text-blue-400'
                                : d.probability >= 50 ? 'text-yellow-600 dark:text-yellow-400'
                                : d.probability > 0 ? 'text-purple-600 dark:text-purple-400'
                                : 'text-red-600 dark:text-red-400'
                              }`}
                            >{d.probability}%</span>
                          </div>
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

      {/* Stage Transition Form for PO Secured */}
      {stageConfirm && stageConfirm.targetStage === 'po_secured' && (
        <StageTransitionDialog
          open={true}
          onOpenChange={(open) => !open && setStageConfirm(null)}
          dealName={stageConfirm.deal.name}
          targetStage={stageConfirm.targetStage}
          onConfirm={(data) => {
            if (onStageChange) {
              onStageChange(stageConfirm.deal.id, stageConfirm.targetStage, data);
            }
            setStageConfirm(null);
          }}
        />
      )}

      {/* Invoice Transition Form for Invoice Issued */}
      {stageConfirm && stageConfirm.targetStage === 'invoice_issued' && (
        <InvoiceTransitionDialog
          open={true}
          onOpenChange={(open) => !open && setStageConfirm(null)}
          deal={stageConfirm.deal}
          getAccountName={getAccountName}
          onConfirm={(data) => {
            if (onStageChange) {
              onStageChange(stageConfirm.deal.id, stageConfirm.targetStage, data);
            }
            setStageConfirm(null);
          }}
        />
      )}

      {/* Simple Confirmation for Canceled / Lost */}
      <AlertDialog open={!!stageConfirm && (stageConfirm?.targetStage === 'canceled' || stageConfirm?.targetStage === 'lost')} onOpenChange={(open) => !open && setStageConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Perpindahan Stage</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin memindahkan deal "{stageConfirm?.deal.name}" ke tahap <span className="font-semibold">{stageConfirm ? stageLabels[stageConfirm.targetStage] : ''}</span>?
              <span className="block mt-1 text-xs text-destructive">Deal akan ditandai sebagai {stageConfirm ? stageLabels[stageConfirm.targetStage] : ''}.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (stageConfirm && onStageChange) {
                  onStageChange(stageConfirm.deal.id, stageConfirm.targetStage);
                }
                setStageConfirm(null);
              }}
            >
              Ya, Pindahkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Request Dialog */}
      {deleteTarget && onDelete && (
        <DeleteDealRequestDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          dealName={deleteTarget.name}
          onSubmit={async (reason) => {
            onDelete(deleteTarget, reason);
          }}
        />
      )}

      <DealDetailDialog
        deal={detailDeal}
        open={!!detailDeal}
        onOpenChange={(open) => !open && setDetailDeal(null)}
        getAccountName={getAccountName}
        getSalesName={getSalesName}
        getAccountPIC={getAccountPIC}
      />
    </>
  );
}
