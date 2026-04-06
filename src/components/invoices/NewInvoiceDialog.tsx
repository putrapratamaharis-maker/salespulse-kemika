import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Account {
  id: string;
  name: string;
}

interface NewInvoiceDialogProps {
  onCreated: () => void;
}

const NewInvoiceDialog = ({ onCreated }: NewInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState<Date | undefined>();
  const [accountId, setAccountId] = useState('');
  const [segment, setSegment] = useState('B2B');
  const [netSales, setNetSales] = useState('');
  const [grossProfit, setGrossProfit] = useState('');
  const [issueDate, setIssueDate] = useState<Date | undefined>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [paidDate, setPaidDate] = useState<Date | undefined>();

  useEffect(() => {
    if (open) {
      supabase.from('accounts').select('id, name').order('name').then(({ data }) => {
        setAccounts((data || []) as Account[]);
      });
    }
  }, [open]);

  const resetForm = () => {
    setInvoiceNumber('');
    setPoNumber('');
    setPoDate(undefined);
    setAccountId('');
    setSegment('B2B');
    setNetSales('');
    setGrossProfit('');
    setIssueDate(new Date());
    setDueDate(undefined);
    setPaidDate(undefined);
  };

  const handleSubmit = async () => {
    if (!invoiceNumber.trim()) { toast.error('Nomor invoice wajib diisi'); return; }
    if (!accountId) { toast.error('Akun wajib dipilih'); return; }
    if (!netSales || Number(netSales) <= 0) { toast.error('Net Sales harus lebih dari 0'); return; }
    if (!issueDate) { toast.error('Tanggal terbit wajib diisi'); return; }
    if (!dueDate) { toast.error('Tanggal jatuh tempo wajib diisi'); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Anda harus login'); setSaving(false); return; }

    const netSalesNum = Number(netSales);
    const grossProfitNum = Number(grossProfit || 0);
    const marginPct = netSalesNum > 0 ? (grossProfitNum / netSalesNum) * 100 : 0;

    const { data: invoiceData, error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber.trim(),
      account_id: accountId,
      sales_id: user.id,
      segment,
      net_sales: netSalesNum,
      gross_profit: grossProfitNum,
      issue_date: format(issueDate, 'yyyy-MM-dd'),
      due_date: format(dueDate, 'yyyy-MM-dd'),
      paid_date: paidDate ? format(paidDate, 'yyyy-MM-dd') : null,
    }).select('id').single();

    if (error) {
      setSaving(false);
      const msg = error.code === '23505' ? 'Nomor invoice sudah digunakan, gunakan nomor lain' : 'Gagal menyimpan invoice: ' + error.message;
      toast.error(msg);
      return;
    }

    // Auto-create deal at invoice_issued stage for pipeline sync
    const selectedAccount = accounts.find(a => a.id === accountId);
    const dealName = `${invoiceNumber.trim()} - ${selectedAccount?.name || 'Invoice'}`;
    
    const { error: dealError } = await supabase.from('deals').insert({
      name: dealName,
      account_id: accountId,
      sales_id: user.id,
      stage: 'invoice_issued' as any,
      value: netSalesNum,
      probability: 100,
      expected_close_date: poDate ? format(poDate, 'yyyy-MM-dd') : format(issueDate, 'yyyy-MM-dd'),
      expected_margin: Math.round(marginPct * 100) / 100,
      segment,
      po_number: poNumber.trim() || invoiceNumber.trim(),
      
      notes: poNumber.trim()
        ? `Auto-created from invoice ${invoiceNumber.trim()} (PO: ${poNumber.trim()})`
        : `Auto-created from invoice ${invoiceNumber.trim()}`,
    });

    setSaving(false);
    if (dealError) {
      console.warn('Invoice saved but failed to create pipeline deal:', dealError.message);
      toast.success('Invoice berhasil dibuat (deal pipeline gagal disinkronkan)');
    } else {
      toast.success('Invoice berhasil dibuat & tersinkronisasi ke Pipeline');
    }
    resetForm();
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Buat Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Invoice Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Dasar PO/SP/SPK */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dasar Pembuatan Invoice</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>No. PO/SP/SPK</Label>
                <Input placeholder="Contoh: PO-2026-001" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>PO/Won/Closed Date</Label>
                <DatePicker date={poDate} onSelect={setPoDate} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nomor Invoice *</Label>
            <Input placeholder="INV-2026-001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Akun / Pelanggan *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Pilih akun" /></SelectTrigger>
              <SelectContent>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="B2B">B2B</SelectItem>
                <SelectItem value="B2C">B2C</SelectItem>
                <SelectItem value="B2G">B2G</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Net Sales (Rp) *</Label>
              <Input type="number" placeholder="0" value={netSales} onChange={e => setNetSales(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gross Profit (Rp)</Label>
              <Input type="number" placeholder="0" value={grossProfit} onChange={e => setGrossProfit(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal Terbit *</Label>
              <DatePicker date={issueDate} onSelect={setIssueDate} />
            </div>
            <div className="space-y-1.5">
              <Label>Jatuh Tempo *</Label>
              <DatePicker date={dueDate} onSelect={setDueDate} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tanggal Bayar (opsional)</Label>
            <DatePicker date={paidDate} onSelect={setPaidDate} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function DatePicker({ date, onSelect }: { date?: Date; onSelect: (d: Date | undefined) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'dd MMM yyyy') : 'Pilih tanggal'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default NewInvoiceDialog;
