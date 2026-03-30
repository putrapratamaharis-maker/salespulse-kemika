import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, X } from 'lucide-react';
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
  useState(() => {
    const generateId = async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from('accounts')
        .select('customer_id')
        .like('customer_id', `CUST${year}-%`);
      const nums = (data || [])
        .map(a => parseInt(a.customer_id?.replace(`CUST${year}-`, '') || '0', 10))
        .filter(n => !isNaN(n));
      const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      setCustomerId(`CUST${year}-${String(next).padStart(4, '0')}`);
    };
    generateId();
  });

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Nama akun wajib diisi', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          customer_id: customerId.trim(),
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

      if (error) throw error;

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
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger><SelectValue placeholder="Pilih account" /></SelectTrigger>
          <SelectContent>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
