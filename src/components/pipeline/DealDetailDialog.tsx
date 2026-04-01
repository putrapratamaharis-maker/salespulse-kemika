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
import { CalendarDays, Building2, User, MapPin, TrendingUp, Clock, FileText, Package, Hash, Phone, Mail, Contact, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export interface AccountPIC {
  picName?: string;
  picEmail?: string;
  picContact?: string;
}

interface DealDetailDialogProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getAccountName: (accountId: string) => string;
  getSalesName?: (salesId: string) => string;
  getAccountPIC?: (accountId: string) => AccountPIC | undefined;
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

export function DealDetailDialog({ deal, open, onOpenChange, getAccountName, getSalesName, getAccountPIC }: DealDetailDialogProps) {
  const navigate = useNavigate();
  const stageStatus = deal ? (deal.daysInStage > 14 ? 'red' : deal.daysInStage > 7 ? 'yellow' : 'green') : 'green';
  const pic = deal && getAccountPIC ? getAccountPIC(deal.accountId) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold leading-tight">{deal?.name || 'Deal Detail'}</DialogTitle>
        </DialogHeader>

        {deal && (
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
            <InfoRow icon={CalendarDays} label={deal.stage === 'invoice_issued' ? 'Invoice Issued Date' : deal.stage === 'po_secured' ? 'PO/Won/Closed Date' : 'Expected Close'} value={formatDate(deal.expectedCloseDate)} />
            <InfoRow icon={Clock} label="Created" value={formatDate(deal.createdAt)} />
            {deal.expectedMargin !== undefined && (
              <InfoRow icon={TrendingUp} label={deal.stage === 'po_secured' || deal.stage === 'invoice_issued' ? 'Gross Margin' : 'Expected Margin'} value={formatPercent(deal.expectedMargin)} />
            )}
            {deal.location && <InfoRow icon={MapPin} label="Location" value={deal.location} />}
            {deal.poNumber && (deal.stage === 'po_secured' || deal.stage === 'invoice_issued') && (
              <InfoRow icon={Hash} label={deal.stage === 'invoice_issued' ? 'No. Invoice' : 'No. PO/SP/SPK'} value={deal.poNumber} highlight />
            )}
          </div>

          {/* PIC Info & WhatsApp */}
          {pic && (pic.picName || pic.picEmail || pic.picContact) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Contact className="h-3.5 w-3.5" />
                  PIC Account
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {pic.picName && <InfoRow icon={User} label="PIC Name" value={pic.picName} />}
                  {pic.picEmail && <InfoRow icon={Mail} label="PIC Email" value={pic.picEmail} />}
                  {pic.picContact && <InfoRow icon={Phone} label="PIC Contact" value={pic.picContact} />}
                </div>
                {pic.picContact && (() => {
                  const phone = pic.picContact!.replace(/[^0-9]/g, '').replace(/^0/, '62');
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
                      asChild
                    >
                      <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-4 w-4" />
                        WhatsApp PIC ({pic.picContact})
                      </a>
                    </Button>
                  );
                })()}
              </div>
            </>
          )}

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
        )}
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
        <p className={`text-xs leading-tight break-words ${highlight ? 'font-bold text-foreground' : 'text-foreground'}`}>{value}</p>
      </div>
    </div>
  );
}
