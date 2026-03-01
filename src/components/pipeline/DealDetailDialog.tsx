import { Deal, formatIDRFull, formatDate, formatPercent } from '@/types/sales';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Building2, User, MapPin, TrendingUp, Clock, FileText, Package } from 'lucide-react';

interface DealDetailDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getAccountName: (accountId: string) => string;
  getSalesName?: (salesId: string) => string;
}

const stageLabels: Record<string, string> = {
  prospect: 'Prospect',
  quotation: 'Quotation',
  negotiation: 'Negotiation',
  po_secured: 'PO Secured / Won',
  invoice_issued: 'Invoice Issued',
  canceled: 'Canceled',
  lost: 'Lost',
};

export function DealDetailDialog({ deal, open, onOpenChange, getAccountName, getSalesName }: DealDetailDialogProps) {
  if (!deal) return null;

  const stageStatus = deal.daysInStage > 14 ? 'red' : deal.daysInStage > 7 ? 'yellow' : 'green';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold leading-tight">{deal.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stage & Segment */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={stageStatus} label={stageLabels[deal.stage] || deal.stage} />
            <Badge variant="secondary" className="text-xs">{deal.segment}</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{deal.daysInStage} days in stage</span>
          </div>

          <Separator />

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={Building2} label="Account" value={getAccountName(deal.accountId)} />
            {getSalesName && <InfoRow icon={User} label="Sales Person" value={getSalesName(deal.salesId)} />}
            <InfoRow icon={TrendingUp} label="Deal Value" value={formatIDRFull(deal.value)} highlight />
            <InfoRow icon={TrendingUp} label="Probability" value={`${deal.probability}%`} />
            <InfoRow icon={CalendarDays} label="Expected Close" value={formatDate(deal.expectedCloseDate)} />
            <InfoRow icon={Clock} label="Created" value={formatDate(deal.createdAt)} />
            {deal.expectedMargin !== undefined && (
              <InfoRow icon={TrendingUp} label="Expected Margin" value={formatPercent(deal.expectedMargin)} />
            )}
            {deal.location && <InfoRow icon={MapPin} label="Location" value={deal.location} />}
          </div>

          {/* Notes */}
          {deal.notes && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  Notes
                </div>
                <p className="text-sm text-foreground leading-relaxed">{deal.notes}</p>
              </div>
            </>
          )}

          {/* Products */}
          {deal.products && deal.products.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Package className="h-3.5 w-3.5" />
                  Products ({deal.products.length})
                </div>
                <div className="space-y-1.5">
                  {deal.products.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-2.5 py-1.5">
                      <div>
                        <span className="font-medium text-foreground">{p.productName}</span>
                        <span className="text-muted-foreground ml-1.5">{p.qty} {p.unit}</span>
                      </div>
                      <span className="font-semibold text-foreground">{formatIDRFull(p.qty * p.pricePerUnit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        <p className={`text-xs leading-tight truncate ${highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>{value}</p>
      </div>
    </div>
  );
}
