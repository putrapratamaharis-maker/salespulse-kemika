import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Deal } from '@/types/sales';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal;
  getAccountName: (accountId: string) => string;
  onConfirm: (data: { poNumber: string; closeDate: string }) => void;
}

function DatePicker({ date, onSelect, placeholder }: { date?: Date; onSelect: (d: Date | undefined) => void; placeholder?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd MMM yyyy') : (placeholder || 'Pilih tanggal')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export function InvoiceTransitionDialog({ open, onOpenChange, deal, getAccountName, onConfirm }: InvoiceTransitionDialogProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [paidDate, setPaidDate] = useState<Date | undefined>();
  const [grossMarginPct, setGrossMarginPct] = useState('');
  const [grossProfit, setGrossProfit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && deal) {
      setInvoiceNumber('');
      setIssueDate(new Date());
      setDueDate(undefined);
      setPaidDate(undefined);
      const margin = deal.expectedMargin || 0;
      setGrossMarginPct(margin > 0 ? String(margin) : '');
      const calculatedGP = Math.round(deal.value * margin / 100);
      setGrossProfit(calculatedGP > 0 ? String(calculatedGP) : '');
    }
  }, [open, deal]);

  // Recalculate gross profit when margin changes
  const handleMarginChange = (val: string) => {
    setGrossMarginPct(val);
    const pct = Number(val) || 0;
    const gp = Math.round(deal.value * pct / 100);
    setGrossProfit(String(gp));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) { toast.error('Nomor Invoice wajib diisi'); return; }
    if (!issueDate) { toast.error('Tanggal Terbit wajib diisi'); return; }
    if (!dueDate) { toast.error('Tanggal Jatuh Tempo wajib diisi'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Anda harus login'); setSaving(false); return; }

    // Create invoice record
    const { error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber.trim(),
      account_id: deal.accountId,
      sales_id: user.id,
      segment: deal.segment,
      net_sales: deal.value,
      gross_profit: Number(grossProfit) || 0,
      issue_date: format(issueDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      paid_date: paidDate ? format(paidDate, 'yyyy-MM-dd') : null,
    });

    if (error) {
      toast.error('Gagal membuat invoice: ' + error.message);
      setSaving(false);
      return;
    }

    toast.success('Invoice berhasil dibuat dari deal');
    // Move deal stage
    onConfirm({ poNumber: invoiceNumber.trim(), closeDate: format(issueDate, 'yyyy-MM-dd') });
    setSaving(false);
  };

  const accountName = getAccountName(deal.accountId);
  const formatRpDisplay = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Issued</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Deal "<span className="font-medium text-foreground">{deal.name}</span>" akan dipindahkan ke tahap{' '}
            <span className="font-semibold">Invoice Issued</span>. Invoice akan otomatis dibuat.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Pre-filled read-only info */}
          <div className="rounded-md border border-border bg-muted/50 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Akun / Pelanggan</p>
                <p className="text-sm font-medium text-foreground">{accountName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Segment</p>
                <p className="text-sm font-medium text-foreground">{deal.segment}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Sales (dari Deal Value)</p>
              <p className="text-sm font-bold text-foreground">{formatRpDisplay(deal.value)}</p>
            </div>
          </div>

          {/* Invoice Number */}
          <div className="space-y-1.5">
            <Label>No. Invoice <span className="text-destructive">*</span></Label>
            <Input
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="Contoh: INV-2026-001"
              autoFocus
            />
          </div>

          {/* Gross Margin + Gross Profit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Gross Margin (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={grossMarginPct}
                onChange={e => handleMarginChange(e.target.value)}
                placeholder="0-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gross Profit (Rp)</Label>
              <Input
                type="number"
                value={grossProfit}
                onChange={e => setGrossProfit(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal Terbit <span className="text-destructive">*</span></Label>
              <DatePicker date={issueDate} onSelect={setIssueDate} placeholder="Pilih tanggal" />
            </div>
            <div className="space-y-1.5">
              <Label>Jatuh Tempo <span className="text-destructive">*</span></Label>
              <DatePicker date={dueDate} onSelect={setDueDate} placeholder="Pilih tanggal" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tanggal Bayar (opsional)</Label>
            <DatePicker date={paidDate} onSelect={setPaidDate} placeholder="Pilih tanggal" />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Ya, Buat Invoice & Pindahkan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
