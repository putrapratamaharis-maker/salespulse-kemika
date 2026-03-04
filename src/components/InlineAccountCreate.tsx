import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SEGMENTS = ['B2B', 'B2G', 'B2C'];
const TYPES = ['Corporate', 'Government', 'SME', 'Individual', 'Distributor'];

interface InlineAccountCreateProps {
  salesId: string;
  onAccountCreated: (account: { id: string; name: string }) => void;
  onCancel: () => void;
}

export function InlineAccountCreate({ salesId, onAccountCreated, onCancel }: InlineAccountCreateProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('B2B');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('Corporate');
  const [saving, setSaving] = useState(false);

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
          name: name.trim(),
          segment,
          region: region.trim(),
          type,
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
      <div className="space-y-1.5">
        <Label className="text-xs">Nama Akun *</Label>
        <Input className="h-9 text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Nama perusahaan / instansi" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Segmen</Label>
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Region</Label>
          <Input className="h-9 text-sm" value={region} onChange={e => setRegion(e.target.value)} placeholder="Contoh: Jakarta" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tipe</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
