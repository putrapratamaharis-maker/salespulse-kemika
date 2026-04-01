import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Bell, Clock, AlertTriangle, TrendingDown, Activity, Trash2, Volume2, Globe, Volume1, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { playNotificationSound, VolumeLevel } from '@/lib/notificationSound';
import { Button } from '@/components/ui/button';

type BooleanPrefKey = Exclude<keyof NotificationPreferences, 'volume_level'>;

interface SettingItem {
  key: BooleanPrefKey;
  label: string;
  description: string;
  icon: typeof Bell;
  color: string;
}

const alertSettings: SettingItem[] = [
  {
    key: 'stagnant_deal',
    label: 'Deal Stagnan',
    description: 'Notifikasi saat deal tidak bergerak lebih dari 14 hari',
    icon: Clock,
    color: 'text-amber-500',
  },
  {
    key: 'overdue_invoice',
    label: 'Invoice Jatuh Tempo',
    description: 'Notifikasi saat invoice belum dibayar lebih dari 30 hari',
    icon: AlertTriangle,
    color: 'text-destructive',
  },
  {
    key: 'low_margin',
    label: 'Margin Rendah',
    description: 'Notifikasi saat margin invoice di bawah 17%',
    icon: TrendingDown,
    color: 'text-orange-500',
  },
  {
    key: 'low_activity',
    label: 'Aktivitas Rendah',
    description: 'Notifikasi saat aktivitas mingguan di bawah target minimum',
    icon: Activity,
    color: 'text-blue-500',
  },
  {
    key: 'deletion_alerts',
    label: 'Persetujuan Hapus Deal',
    description: 'Notifikasi saat permintaan penghapusan deal disetujui/ditolak',
    icon: Trash2,
    color: 'text-purple-500',
  },
];

const deliverySettings: SettingItem[] = [
  {
    key: 'browser_push',
    label: 'Browser Push Notification',
    description: 'Tampilkan notifikasi di desktop/mobile browser meski tab tidak aktif',
    icon: Globe,
    color: 'text-green-500',
  },
  {
    key: 'sound_enabled',
    label: 'Suara Notifikasi',
    description: 'Putar suara saat notifikasi muncul',
    icon: Volume2,
    color: 'text-primary',
  },
];

export default function NotificationSettings() {
  const { prefs, loading, updatePref } = useNotificationPreferences();

  const handleToggle = async (key: BooleanPrefKey, value: boolean) => {
    await updatePref(key, value);
    toast.success('Pengaturan disimpan', { duration: 2000 });
  };

  const handleVolumeChange = async (level: VolumeLevel) => {
    await updatePref('volume_level', level);
    playNotificationSound(level);
    toast.success('Volume disimpan', { duration: 2000 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Pengaturan Notifikasi
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola jenis notifikasi yang ingin Anda terima
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kategori Alert</CardTitle>
          <CardDescription>Pilih jenis peringatan bisnis yang ingin ditampilkan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {alertSettings.map((setting, i) => {
            const Icon = setting.icon;
            return (
              <div key={setting.key}>
                {i > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${setting.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{setting.label}</p>
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs[setting.key] as boolean}
                    onCheckedChange={(val) => handleToggle(setting.key, val)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metode Pengiriman</CardTitle>
          <CardDescription>Atur cara notifikasi dikirimkan kepada Anda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {deliverySettings.map((setting, i) => {
            const Icon = setting.icon;
            return (
              <div key={setting.key}>
                {i > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${setting.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{setting.label}</p>
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs[setting.key]}
                    onCheckedChange={(val) => handleToggle(setting.key, val)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
