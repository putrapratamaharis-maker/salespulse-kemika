import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { User, Camera, Lock, Activity, Loader2, Save, MapPin, Building2, Users, Mail } from 'lucide-react';
import { formatDate } from '@/types/sales';

const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi',
  'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Barat', 'Sulawesi Tenggara',
  'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan',
];
const SEGMENTS = ['B2B', 'B2C', 'B2G', 'Enterprise'];
const DIVISIONS = ['BOD', 'HR-GA', 'Sales & Marketing', 'FAT', 'WH', 'Lainnya'];

const activityLabels: Record<string, string> = {
  call: 'Call', visit: 'Visit', email: 'Email', meeting: 'Meeting',
  follow_up: 'Follow Up', presentation: 'Presentation',
};

const MyProfile = () => {
  const { user, profile: authProfile, signOut } = useAuth();
  const { currentUser } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionPopoverOpen, setRegionPopoverOpen] = useState(false);
  const [segment, setSegment] = useState('');
  const [division, setDivision] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [positionName, setPositionName] = useState('');
  const [supervisorName, setSupervisorName] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [activities, setActivities] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  async function fetchData() {
    setLoading(true);
    const [{ data: prof }, { data: acts }] = await Promise.all([
      supabase.from('profiles').select('*, positions(position_name)').eq('user_id', user!.id).single(),
      supabase.from('sales_activities').select('*').eq('sales_id', user!.id).order('activity_date', { ascending: false }).limit(10),
    ]);

    if (prof) {
      setFullName(prof.full_name || '');
      setEmail(prof.email || '');
      setSelectedRegions(prof.region ? prof.region.split(', ').filter(Boolean) : []);
      setSegment(prof.segment || '');
      setDivision(prof.division || '');
      setAvatarUrl(prof.avatar_url);
      setPositionName((prof as any).positions?.position_name || '—');

      if (prof.supervisor_id) {
        const { data: sup } = await supabase.from('profiles').select('full_name').eq('id', prof.supervisor_id).single();
        setSupervisorName(sup?.full_name || '—');
      }
    }
    setActivities(acts || []);
    setLoading(false);
  }

  async function handleSaveProfile() {
    if (!fullName.trim()) {
      toast({ title: 'Nama tidak boleh kosong', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: fullName.trim(),
      region,
      segment,
      division,
    }).eq('user_id', user!.id);

    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profil berhasil diperbarui' });
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Ukuran file maksimal 2MB', variant: 'destructive' });
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split('.').pop();
    const path = `${user!.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload gagal', description: uploadError.message, variant: 'destructive' });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: newUrl }).eq('user_id', user!.id);
    setAvatarUrl(newUrl);
    toast({ title: 'Foto profil berhasil diperbarui' });
    setUploadingAvatar(false);
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      toast({ title: 'Password minimal 6 karakter', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Konfirmasi password tidak cocok', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Gagal mengubah password', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password berhasil diubah' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  }

  const initials = fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Profil Saya</h1>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info"><User className="h-4 w-4 mr-1.5" />Info Pribadi</TabsTrigger>
          <TabsTrigger value="password"><Lock className="h-4 w-4 mr-1.5" />Ubah Password</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1.5" />Riwayat Aktivitas</TabsTrigger>
        </TabsList>

        {/* ---- INFO PRIBADI ---- */}
        <TabsContent value="info" className="mt-4 space-y-4">
          {/* Avatar Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl || undefined} alt={fullName} />
                    <AvatarFallback className="text-lg bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{fullName}</h2>
                  <p className="text-sm text-muted-foreground">{email}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{positionName}</span>
                    {supervisorName && <span>• Supervisor: {supervisorName}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card>
            <CardHeader><CardTitle className="text-base">Edit Informasi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nama Lengkap</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/50">
                    <Mail className="h-3.5 w-3.5" />{email}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger><SelectValue placeholder="Pilih Region" /></SelectTrigger>
                    <SelectContent>
                      {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Segment</Label>
                  <Select value={segment} onValueChange={setSegment}>
                    <SelectTrigger><SelectValue placeholder="Pilih Segment" /></SelectTrigger>
                    <SelectContent>
                      {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Divisi</Label>
                  <Select value={division} onValueChange={setDivision}>
                    <SelectTrigger><SelectValue placeholder="Pilih Divisi" /></SelectTrigger>
                    <SelectContent>
                      {DIVISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Simpan
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- UBAH PASSWORD ---- */}
        <TabsContent value="password" className="mt-4">
          <Card className="max-w-md">
            <CardHeader><CardTitle className="text-base">Ubah Password</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPwd">Password Baru</Label>
                <Input id="newPwd" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPwd">Konfirmasi Password Baru</Label>
                <Input id="confirmPwd" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ketik ulang password" />
              </div>
              <Button onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Lock className="h-4 w-4 mr-1.5" />}
                Ubah Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- RIWAYAT AKTIVITAS ---- */}
        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">10 Aktivitas Terbaru</CardTitle></CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada aktivitas.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs">Tipe</TableHead>
                      <TableHead className="text-xs">Tujuan</TableHead>
                      <TableHead className="text-xs">Hasil</TableHead>
                      <TableHead className="text-xs">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map(act => (
                      <TableRow key={act.id}>
                        <TableCell className="text-sm">{formatDate(act.activity_date)}</TableCell>
                        <TableCell><StatusBadge status="green" label={activityLabels[act.type] || act.type} /></TableCell>
                        <TableCell className="text-sm">{act.purpose || '—'}</TableCell>
                        <TableCell className="text-sm">{act.outcome || '—'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{act.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyProfile;
