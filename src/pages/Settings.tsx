import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationHistory } from '@/components/NotificationHistory';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { playNotificationSound, VolumeLevel } from '@/lib/notificationSound';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  Palette,
  LayoutDashboard,
  Globe,
  Bell,
  Clock,
  AlertTriangle,
  TrendingDown,
  Activity,
  Trash2,
  Volume2,
  Volume1,
  VolumeX,
  Sun,
  Moon,
  Monitor,
  CalendarDays,
  Languages,
} from 'lucide-react';

// ─── Notification types ───
type BooleanPrefKey = Exclude<keyof NotificationPreferences, 'volume_level'>;

interface SettingItem {
  key: BooleanPrefKey;
  label: string;
  description: string;
  icon: typeof Bell;
  color: string;
}

const alertSettings: SettingItem[] = [
  { key: 'stagnant_deal', label: 'Deal Stagnan', description: 'Notifikasi saat deal tidak bergerak lebih dari 14 hari', icon: Clock, color: 'text-amber-500' },
  { key: 'overdue_invoice', label: 'Invoice Jatuh Tempo', description: 'Notifikasi saat invoice belum dibayar lebih dari 30 hari', icon: AlertTriangle, color: 'text-destructive' },
  { key: 'low_margin', label: 'Margin Rendah', description: 'Notifikasi saat margin invoice di bawah 17%', icon: TrendingDown, color: 'text-orange-500' },
  { key: 'low_activity', label: 'Aktivitas Rendah', description: 'Notifikasi saat aktivitas mingguan di bawah target minimum', icon: Activity, color: 'text-blue-500' },
  { key: 'deletion_alerts', label: 'Persetujuan Hapus Deal', description: 'Notifikasi saat permintaan penghapusan deal disetujui/ditolak', icon: Trash2, color: 'text-purple-500' },
];

const deliverySettings: SettingItem[] = [
  { key: 'browser_push', label: 'Browser Push Notification', description: 'Tampilkan notifikasi di desktop/mobile browser meski tab tidak aktif', icon: Globe, color: 'text-green-500' },
  { key: 'sound_enabled', label: 'Suara Notifikasi', description: 'Putar suara saat notifikasi muncul', icon: Volume2, color: 'text-primary' },
];

// ─── Local storage helpers ───
const SETTINGS_KEY = 'app_settings';

interface AppSettings {
  dateFormat: string;
  timezone: string;
  language: string;
  defaultTab: string;
}

const defaultSettings: AppSettings = {
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Asia/Jakarta',
  language: 'id',
  defaultTab: 'dashboard',
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── Render helpers ───
function SettingRow({ icon: Icon, color, label, description, children }: { icon: typeof Bell; color: string; label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───
export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { prefs, loading, updatePref } = useNotificationPreferences();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => { saveSettings(settings); }, [settings]);

  const handleToggle = async (key: BooleanPrefKey, value: boolean) => {
    await updatePref(key, value);
    toast.success('Pengaturan disimpan', { duration: 2000 });
  };

  const handleVolumeChange = async (level: VolumeLevel) => {
    await updatePref('volume_level', level);
    playNotificationSound(level);
    toast.success('Volume disimpan', { duration: 2000 });
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast.success('Pengaturan disimpan', { duration: 2000 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Pengaturan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola tampilan, preferensi, dan notifikasi aplikasi Anda
        </p>
      </div>

      <Tabs defaultValue="tampilan" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tampilan" className="text-xs sm:text-sm gap-1">
            <Palette className="h-3.5 w-3.5 hidden sm:inline-block" />
            Tampilan
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm gap-1">
            <LayoutDashboard className="h-3.5 w-3.5 hidden sm:inline-block" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="regional" className="text-xs sm:text-sm gap-1">
            <Globe className="h-3.5 w-3.5 hidden sm:inline-block" />
            Regional
          </TabsTrigger>
          <TabsTrigger value="notifikasi" className="text-xs sm:text-sm gap-1">
            <Bell className="h-3.5 w-3.5 hidden sm:inline-block" />
            Notifikasi
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Tampilan ── */}
        <TabsContent value="tampilan" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tema Aplikasi</CardTitle>
              <CardDescription>Pilih mode tampilan yang nyaman untuk Anda</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'light', label: 'Terang', icon: Sun, desc: 'Latar putih dengan teks gelap' },
                  { value: 'dark', label: 'Gelap', icon: Moon, desc: 'Latar gelap, nyaman di malam hari' },
                  { value: 'system', label: 'Sistem', icon: Monitor, desc: 'Ikuti pengaturan perangkat' },
                ] as const).map(({ value, label, icon: TIcon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-center ${
                      theme === value
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <TIcon className={`h-6 w-6 ${theme === value ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{desc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Preferensi Dashboard ── */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferensi Dashboard</CardTitle>
              <CardDescription>Sesuaikan tampilan awal saat Anda membuka aplikasi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingRow icon={LayoutDashboard} color="text-primary" label="Tab Default" description="Halaman yang pertama kali ditampilkan setelah login">
                <Select value={settings.defaultTab} onValueChange={(v) => updateSetting('defaultTab', v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">Dashboard</SelectItem>
                    <SelectItem value="pipeline">Pipeline & Forecast</SelectItem>
                    <SelectItem value="revenue">Revenue & Margin</SelectItem>
                    <SelectItem value="activities">My Activities</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Format Regional ── */}
        <TabsContent value="regional" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Format Regional</CardTitle>
              <CardDescription>Atur zona waktu, format tanggal, dan bahasa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingRow icon={Globe} color="text-emerald-500" label="Zona Waktu" description="Zona waktu yang digunakan untuk menampilkan tanggal dan jam">
                <Select value={settings.timezone} onValueChange={(v) => updateSetting('timezone', v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Jakarta">WIB (Jakarta)</SelectItem>
                    <SelectItem value="Asia/Makassar">WITA (Makassar)</SelectItem>
                    <SelectItem value="Asia/Jayapura">WIT (Jayapura)</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator className="my-3" />

              <SettingRow icon={CalendarDays} color="text-blue-500" label="Format Tanggal" description="Format tampilan tanggal di seluruh aplikasi">
                <Select value={settings.dateFormat} onValueChange={(v) => updateSetting('dateFormat', v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="DD MMM YYYY">DD MMM YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>

              <Separator className="my-3" />

              <SettingRow icon={Languages} color="text-violet-500" label="Bahasa" description="Bahasa antarmuka aplikasi">
                <Select value={settings.language} onValueChange={(v) => updateSetting('language', v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Notifikasi ── */}
        <TabsContent value="notifikasi" className="space-y-4 mt-4">
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings">Pengaturan</TabsTrigger>
              <TabsTrigger value="history">Riwayat</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Kategori Alert</CardTitle>
                  <CardDescription>Pilih jenis peringatan bisnis yang ingin ditampilkan</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {alertSettings.map((setting, i) => (
                    <div key={setting.key}>
                      {i > 0 && <Separator className="my-3" />}
                      <SettingRow icon={setting.icon} color={setting.color} label={setting.label} description={setting.description}>
                        <Switch
                          checked={prefs[setting.key] as boolean}
                          onCheckedChange={(val) => handleToggle(setting.key, val)}
                        />
                      </SettingRow>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Metode Pengiriman</CardTitle>
                  <CardDescription>Atur cara notifikasi dikirimkan kepada Anda</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {deliverySettings.map((setting, i) => (
                    <div key={setting.key}>
                      {i > 0 && <Separator className="my-3" />}
                      <SettingRow icon={setting.icon} color={setting.color} label={setting.label} description={setting.description}>
                        <Switch
                          checked={prefs[setting.key] as boolean}
                          onCheckedChange={(val) => handleToggle(setting.key, val)}
                        />
                      </SettingRow>
                    </div>
                  ))}

                  {prefs.sound_enabled && (
                    <>
                      <Separator className="my-3" />
                      <SettingRow icon={Volume1} color="text-primary" label="Volume Suara" description="Atur tingkat volume notifikasi">
                        <div className="flex gap-1">
                          {([
                            { value: 'low' as VolumeLevel, label: 'Rendah', icon: VolumeX },
                            { value: 'medium' as VolumeLevel, label: 'Sedang', icon: Volume1 },
                            { value: 'high' as VolumeLevel, label: 'Tinggi', icon: Volume2 },
                          ]).map(({ value, label, icon: VIcon }) => (
                            <Button
                              key={value}
                              variant={prefs.volume_level === value ? 'default' : 'outline'}
                              size="sm"
                              className="text-xs h-8 px-2.5 gap-1"
                              onClick={() => handleVolumeChange(value)}
                            >
                              <VIcon className="h-3.5 w-3.5" />
                              {label}
                            </Button>
                          ))}
                        </div>
                      </SettingRow>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <NotificationHistory />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
