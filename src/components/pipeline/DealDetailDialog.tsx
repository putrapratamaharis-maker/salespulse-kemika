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
import { CalendarDays, Building2, User, MapPin, TrendingUp, Clock, FileText, Package, Hash, Phone, Mail, Contact, ExternalLink, Warehouse, Receipt, CheckCircle2, AlertTriangle, RefreshCw, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    ok: boolean;
    status: string;
    message: string;
    eventType?: string;
    timestamp?: string;
  } | null>(null);

  const [wmsSyncing, setWmsSyncing] = useState(false);
  const [wmsSyncResult, setWmsSyncResult] = useState<{
    ok: boolean;
    status: string;
    message: string;
    eventType?: string;
    timestamp?: string;
  } | null>(null);

  const handleResyncWms = async () => {
    if (!deal) return;
    setWmsSyncing(true);
    setWmsSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('wms-resync-deal', {
        body: { deal_id: deal.id },
      });
      if (error) {
        const msg = error.message || 'Gagal memanggil sync';
        setWmsSyncResult({ ok: false, status: 'error', message: msg });
        toast.error('Re-sync WMS gagal', { description: msg });
        return;
      }
      const status = data?.status as string | undefined;
      if (status === 'resynced') {
        const ts = data?.last_event_at ? new Date(data.last_event_at).toLocaleString('id-ID') : '';
        const items = typeof data?.items_replaced === 'number' && data.items_replaced > 0
          ? ` ${data.items_replaced} item produk di-refresh.`
          : '';
        const msg = `SO ${data?.wms_so_number ?? ''} berhasil di-replay${ts ? ` pada ${ts}` : ''}.${items}`;
        setWmsSyncResult({
          ok: true,
          status: 'resynced',
          message: msg,
          eventType: data?.event_type,
          timestamp: data?.last_event_at,
        });
        toast.success('Deal tersinkron dari WMS', { description: msg });
      } else if (status === 'no_log' || status === 'no_so') {
        const msg = data?.message ?? 'Tidak ada event WMS untuk di-resync.';
        setWmsSyncResult({ ok: false, status, message: msg });
        toast.info('Tidak ada event WMS', { description: msg });
      } else {
        const msg = data?.error ?? data?.message ?? 'Respons tidak dikenali.';
        setWmsSyncResult({ ok: false, status: status ?? 'unknown', message: msg });
        toast.warning('Re-sync WMS', { description: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setWmsSyncResult({ ok: false, status: 'error', message: msg });
      toast.error('Re-sync WMS gagal', { description: msg });
    } finally {
      setWmsSyncing(false);
    }
  };

  const handleResyncAR = async () => {
    if (!deal) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('apar-resync-deal', {
        body: { deal_id: deal.id },
      });
      if (error) {
        const msg = error.message || 'Gagal memanggil sync';
        setSyncResult({ ok: false, status: 'error', message: msg });
        toast.error('Sync AR gagal', { description: msg });
        return;
      }
      const status = data?.status as string | undefined;
      if (status === 'resynced') {
        const ts = data?.last_event_at ? new Date(data.last_event_at).toLocaleString('id-ID') : '';
        const msg = `Event "${data?.event_type}" berhasil di-replay${ts ? ` pada ${ts}` : ''}.`;
        setSyncResult({
          ok: true,
          status: 'resynced',
          message: msg,
          eventType: data?.event_type,
          timestamp: data?.last_event_at,
        });
        toast.success('AR Status tersinkron', { description: msg });
      } else if (status === 'no_log' || status === 'no_so') {
        const msg = data?.message ?? 'Tidak ada event AR untuk di-resync.';
        setSyncResult({ ok: false, status, message: msg });
        toast.info('Tidak ada event AR', { description: msg });
      } else {
        const msg = data?.error ?? data?.message ?? 'Respons tidak dikenali.';
        setSyncResult({ ok: false, status: status ?? 'unknown', message: msg });
        toast.warning('Sync AR', { description: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setSyncResult({ ok: false, status: 'error', message: msg });
      toast.error('Sync AR gagal', { description: msg });
    } finally {
      setSyncing(false);
    }
  };

  const showSyncSection = !!deal?.wmsSoNumber;

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
            {deal.poNumber && (deal.stage === 'po_secured') && (
              <InfoRow icon={Hash} label="No. PO/SP/SPK" value={deal.poNumber} highlight />
            )}
            {deal.wmsSoNumber && (deal.stage === 'po_secured' || deal.stage === 'invoice_issued') && (
              <div className="flex items-start gap-2 col-span-2">
                <Warehouse className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground leading-tight">No. SO WMS</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 break-words">
                      {deal.wmsSoNumber}
                    </span>
                    {deal.wmsSoDate && (
                      <span className="text-[10px] text-muted-foreground">
                        ({formatDate(deal.wmsSoDate)})
                      </span>
                    )}
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-300 text-emerald-700 dark:text-emerald-300">
                      Synced
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            {deal.poNumber && deal.stage === 'invoice_issued' && (
              <div className="flex items-start gap-2 col-span-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground leading-tight">No. Invoice</p>
                  <button
                    type="button"
                    onClick={() => { onOpenChange(false); navigate('/revenue'); }}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    {deal.poNumber}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AR Invoice section (from AP/AR Nexus) */}
          {(deal.arInvoiceNumber || showSyncSection) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  AR Invoice (AP/AR Nexus)
                  {deal.arStatus === 'paid' && (
                    <Badge className="bg-emerald-500 text-white text-[9px] px-1.5 py-0 ml-auto">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> LUNAS
                    </Badge>
                  )}
                  {deal.arStatus === 'partial_paid' && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto border-amber-400 text-amber-700 dark:text-amber-300">
                      Partial Paid
                    </Badge>
                  )}
                  {deal.arStatus === 'overdue' && (
                    <Badge className="bg-rose-500 text-white text-[9px] px-1.5 py-0 ml-auto">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Overdue
                    </Badge>
                  )}
                  {deal.arStatus === 'approved' && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto border-blue-400 text-blue-700 dark:text-blue-300">
                      Approved
                    </Badge>
                  )}
                </div>
                {deal.arInvoiceNumber && (
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow icon={Hash} label="No. Invoice" value={deal.arInvoiceNumber} highlight />
                  {deal.arInvoiceAmount != null && deal.arInvoiceAmount > 0 && (
                    <InfoRow icon={TrendingUp} label="Nilai Invoice" value={formatIDRFull(deal.arInvoiceAmount)} highlight />
                  )}
                  {deal.arInvoiceDate && (
                    <InfoRow icon={CalendarDays} label="Tanggal Terbit" value={formatDate(deal.arInvoiceDate)} />
                  )}
                  {deal.arDueDate && (
                    <InfoRow icon={Clock} label="Jatuh Tempo" value={formatDate(deal.arDueDate)} />
                  )}
                  {deal.arPaidAmount != null && deal.arPaidAmount > 0 && deal.arStatus !== 'paid' && (
                    <InfoRow icon={TrendingUp} label="Sudah Dibayar" value={formatIDRFull(deal.arPaidAmount)} />
                  )}
                  {deal.arPaidDate && (
                    <InfoRow icon={CheckCircle2} label="Tanggal Lunas" value={formatDate(deal.arPaidDate)} highlight />
                  )}
                </div>
                )}
                {deal.arLastEventAt && (
                  <p className="text-[10px] text-muted-foreground">
                    Update terakhir: {new Date(deal.arLastEventAt).toLocaleString('id-ID')}
                  </p>
                )}

                {/* Sync AR Status button + result */}
                <div className="space-y-1.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResyncAR}
                    disabled={syncing}
                    className="w-full gap-2"
                  >
                    {syncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    {syncing ? 'Menyinkronkan...' : 'Sync AR Status'}
                  </Button>
                  {syncResult && (
                    <div
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug ${
                        syncResult.ok
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                          : syncResult.status === 'no_log' || syncResult.status === 'no_so'
                          ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                          : 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                      }`}
                    >
                      {syncResult.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : syncResult.status === 'no_log' || syncResult.status === 'no_so' ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {syncResult.ok
                            ? `Sync OK${syncResult.eventType ? ` · ${syncResult.eventType}` : ''}`
                            : syncResult.status === 'no_log' || syncResult.status === 'no_so'
                            ? 'Tidak ada event AR'
                            : 'Sync gagal'}
                        </p>
                        <p className="break-words">{syncResult.message}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
