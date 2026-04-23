import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserPlus, X, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const TYPES = ['Corporate', 'Government', 'SME', 'Individual', 'Distributor', 'NGO', 'Others'];
const STATUSES = ['Active', 'Non-Active'];
const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Barat', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya',
];

interface InlineAccountCreateProps {
  salesId: string;
  onAccountCreated: (account: { id: string; name: string }) => void;
  onCancel: () => void;
}

export function InlineAccountCreate({ salesId, onAccountCreated, onCancel }: InlineAccountCreateProps) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [picName, setPicName] = useState('');
  const [picContact, setPicContact] = useState('');
  const [picEmail, setPicEmail] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('Corporate');
  const [status, setStatus] = useState('Active');
  const [saving, setSaving] = useState(false);

  // Auto-generate Customer ID on mount
  // Uses ORDER BY DESC + LIMIT 1 to avoid the 1000-row default limit and
  // ensure the highest existing number is found even with large datasets.
  useEffect(() => {
    const generateId = async () => {
      const year = new Date().getFullYear();
      const prefix = `CUST${year}-`;
      const { data } = await supabase
        .from('accounts')
        .select('customer_id')
        .like('customer_id', `${prefix}%`)
        .order('customer_id', { ascending: false })
        .limit(1);
      const lastNum = data && data.length > 0
        ? parseInt(data[0].customer_id?.replace(prefix, '') || '0', 10)
        : 0;
      const next = (isNaN(lastNum) ? 0 : lastNum) + 1;
      setCustomerId(`${prefix}${String(next).padStart(4, '0')}`);
    };
    generateId();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nama akun wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Duplicate detection
    try {
      const duplicateWarnings: string[] = [];

      if (customerId.trim()) {
        const { data: cidDups } = await supabase
          .from('accounts')
          .select('id, customer_id, name')
          .eq('customer_id', customerId.trim());
        if (cidDups && cidDups.length > 0) {
          duplicateWarnings.push(`Customer ID "${customerId.trim()}" sudah digunakan oleh akun "${cidDups[0].name}".`);
        }
      }

      if (name.trim()) {
        const { data: nameDups } = await supabase
          .from('accounts')
          .select('id, customer_id, name')
          .ilike('name', name.trim());
        if (nameDups && nameDups.length > 0) {
          duplicateWarnings.push(`Nama akun "${name.trim()}" sudah ada (Customer ID: ${nameDups[0].customer_id || '-'}).`);
        }
      }

      if (duplicateWarnings.length > 0) {
        const proceed = window.confirm(
          `⚠️ Potensi duplikasi terdeteksi:\n\n${duplicateWarnings.join('\n')}\n\nApakah Anda tetap ingin melanjutkan?`
        );
        if (!proceed) {
          setSaving(false);
          return;
        }
      }

      // Try insert with retry on duplicate customer_id (race condition safety)
      let attemptId = customerId.trim();
      let data: any = null;
      let lastError: any = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await supabase
          .from('accounts')
          .insert({
            customer_id: attemptId,
            name: name.trim(),
            pic_name: picName.trim(),
            pic_contact: picContact.trim(),
            pic_email: picEmail.trim(),
            region,
            type,
            status,
            sales_id: salesId,
          })
          .select()
          .single();

        if (!result.error) {
          data = result.data;
          break;
        }

        lastError = result.error;
        // Only retry on duplicate customer_id constraint
        const isDupCustomerId =
          result.error.code === '23505' &&
          (result.error.message?.includes('accounts_customer_id_unique') ||
            result.error.message?.includes('customer_id'));
        if (!isDupCustomerId) break;

        // Re-fetch latest max and bump
        const year = new Date().getFullYear();
        const prefix = `CUST${year}-`;
        const { data: latest } = await supabase
          .from('accounts')
          .select('customer_id')
          .like('customer_id', `${prefix}%`)
          .order('customer_id', { ascending: false })
          .limit(1);
        const lastNum = latest && latest.length > 0
          ? parseInt(latest[0].customer_id?.replace(prefix, '') || '0', 10)
          : 0;
        const next = (isNaN(lastNum) ? 0 : lastNum) + 1;
        attemptId = `${prefix}${String(next).padStart(4, '0')}`;
        setCustomerId(attemptId);
      }

      if (!data) throw lastError ?? new Error('Gagal membuat akun setelah beberapa percobaan');

      onAccountCreated({ id: data.id, name: data.name });
      toast({ title: `Akun "${data.name}" berhasil dibuat` });
    } catch (err: any) {
      toast({ title: 'Gagal membuat akun', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary">Buat Akun Baru</span>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Customer ID</Label>
          <Input className="h-9 text-sm font-mono" value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="CUST2026-XXXX" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Nama Akun Pelanggan/Customer *</Label>
          <Input className="h-9 text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Nama perusahaan / instansi" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Nama PIC</Label>
        <Input className="h-9 text-sm" value={picName} onChange={e => setPicName(e.target.value)} placeholder="Nama Person in Charge" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Nomor Contact</Label>
          <Input className="h-9 text-sm" value={picContact} onChange={e => setPicContact(e.target.value)} placeholder="08xxxxxxxxxx" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email <span className="text-muted-foreground">(optional)</span></Label>
          <Input type="email" className="h-9 text-sm" value={picEmail} onChange={e => setPicEmail(e.target.value)} placeholder="email@contoh.com" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipe</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Provinsi" /></SelectTrigger>
            <SelectContent>
              {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" className="gap-1 h-8 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Akun'}
        </Button>
      </div>
    </div>
  );
}

interface AccountSelectWithCreateProps {
  accounts: { id: string; name: string }[];
  value: string;
  onValueChange: (value: string) => void;
  salesId: string;
  onAccountCreated: (account: { id: string; name: string }) => void;
  label?: string;
  optional?: boolean;
}

export function AccountSelectWithCreate({
  accounts, value, onValueChange, salesId, onAccountCreated, label = 'Account/Customer', optional = false,
}: AccountSelectWithCreateProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [open, setOpen] = useState(false);

  const selectedAccount = accounts.find(a => a.id === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          {label} {optional && <span className="text-muted-foreground text-xs">(optional)</span>}
        </Label>
        {!showCreate && (
          <Button type="button" variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-3 w-3" /> Akun Baru
          </Button>
        )}
      </div>
      {showCreate ? (
        <InlineAccountCreate
          salesId={salesId}
          onAccountCreated={(acc) => {
            onAccountCreated(acc);
            onValueChange(acc.id);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            >
              {selectedAccount ? selectedAccount.name : 'Cari atau pilih account...'}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Ketik nama akun..." />
              <CommandList>
                <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                <CommandGroup>
                  {accounts.map(a => (
                    <CommandItem
                      key={a.id}
                      value={a.name}
                      onSelect={() => {
                        onValueChange(a.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                      {a.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
