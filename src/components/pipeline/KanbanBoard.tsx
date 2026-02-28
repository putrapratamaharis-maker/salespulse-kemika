import { useState, useRef, DragEvent } from 'react';
import { Deal, DealStage, formatIDR } from '@/types/sales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, GripVertical } from 'lucide-react';
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

interface KanbanBoardProps {
  deals: Deal[];
  getAccountName: (accountId: string) => string;
  onEdit?: (deal: Deal) => void;
  onDelete?: (dealId: string) => void;
  onStageChange?: (dealId: string, newStage: DealStage) => void;
}

export function KanbanBoard({ deals, getAccountName, onEdit, onDelete, onStageChange }: KanbanBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null);
  const dragDealId = useRef<string | null>(null);

  const kanbanData = stageOrder.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
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

  const handleDrop = (e: DragEvent, targetStage: string) => {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = dragDealId.current;
    if (dealId && onStageChange) {
      const deal = deals.find(d => d.id === dealId);
      if (deal && deal.stage !== targetStage) {
        onStageChange(dealId, targetStage as DealStage);
      }
    }
    dragDealId.current = null;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pipeline Kanban</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          <ScrollArea className="w-full">
            <div className="flex gap-3 px-6 min-w-max">
              {kanbanData.map(col => (
                <div
                  key={col.stage}
                  className={`flex flex-col w-56 shrink-0 rounded-lg border transition-all ${stageBgColors[col.stage]} ${dragOverStage === col.stage ? 'ring-2 ring-primary ring-offset-2' : ''}`}
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
                  <div className="p-2 space-y-2 min-h-[80px] max-h-[300px] overflow-y-auto">
                    {col.deals.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No deals</p>
                    ) : (
                      col.deals.map(d => (
                        <div
                          key={d.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, d.id)}
                          className="bg-card rounded-md border shadow-sm p-2.5 space-y-1 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <GripVertical className="h-3 w-3 text-muted-foreground/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <p className="text-xs font-semibold text-foreground leading-tight truncate">{d.name}</p>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus deal "{deleteTarget?.name}"? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget && onDelete) {
                  onDelete(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
