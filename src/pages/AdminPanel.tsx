import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sliders, Loader2, Target, FileText, TrendingUp, Crosshair } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KPIMasterManagement } from '@/components/admin/KPIMasterManagement';
import { KPITemplateManagement } from '@/components/admin/KPITemplateManagement';
import { MonthlyKPITargets } from '@/components/admin/MonthlyKPITargets';
import { KPICalculationEngine } from '@/components/admin/KPICalculationEngine';
import { RevenueTargetManagement } from '@/components/admin/RevenueTargetManagement';
import { useToast } from '@/hooks/use-toast';

const AdminPanel = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [usersCount, setUsersCount] = useState(0);

  const isSuperAdmin = userRole?.system_role === 'super_admin';

  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      setUsersCount(count || 0);
    }
    fetchCount();
  }, []);

  if (!userRole || !['super_admin', 'admin'].includes(userRole.system_role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Admin Panel</h2>
        <p className="text-sm text-muted-foreground">Kelola KPI dan konfigurasi sistem</p>
      </div>

      <Tabs defaultValue="kpi-master">
        <TabsList>
          <TabsTrigger value="kpi-master">
            <Target className="h-4 w-4 mr-1" /> KPI Master
          </TabsTrigger>
          <TabsTrigger value="kpi-templates">
            <FileText className="h-4 w-4 mr-1" /> KPI Templates
          </TabsTrigger>
          <TabsTrigger value="sales-targets">
            <Crosshair className="h-4 w-4 mr-1" /> Sales Targets
          </TabsTrigger>
          <TabsTrigger value="kpi-engine">
            <TrendingUp className="h-4 w-4 mr-1" /> KPI Engine
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="config">
              <Sliders className="h-4 w-4 mr-1" /> Configuration
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="kpi-master" className="mt-4">
          <KPIMasterManagement />
        </TabsContent>

        <TabsContent value="kpi-templates" className="mt-4">
          <KPITemplateManagement />
        </TabsContent>

        <TabsContent value="sales-targets" className="mt-4">
          <Tabs defaultValue="revenue-targets">
            <TabsList className="mb-4">
              <TabsTrigger value="revenue-targets">Revenue & Margin Targets</TabsTrigger>
              <TabsTrigger value="kpi-monthly">KPI Monthly Targets</TabsTrigger>
            </TabsList>
            <TabsContent value="revenue-targets">
              <RevenueTargetManagement />
            </TabsContent>
            <TabsContent value="kpi-monthly">
              <MonthlyKPITargets />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="kpi-engine" className="mt-4">
          <KPICalculationEngine />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="config" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">KPI Thresholds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Minimum Margin %</span>
                      <span className="font-semibold">17%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Achievement Green Threshold</span>
                      <span className="font-semibold">≥ 100%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Achievement Yellow Threshold</span>
                      <span className="font-semibold">80–99%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deal Stuck Alert (days)</span>
                      <span className="font-semibold">14</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Min Weekly Activities</span>
                      <span className="font-semibold">5</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">System Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Currency</span>
                      <span className="font-semibold">IDR (Rp)</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Timezone</span>
                      <span className="font-semibold">Asia/Jakarta</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Date Format</span>
                      <span className="font-semibold">DD MMM YYYY</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Users</span>
                      <span className="font-semibold">{usersCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AdminPanel;
