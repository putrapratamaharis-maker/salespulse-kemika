import { useAuth } from '@/context/AuthContext';
import { ProductMasterManagement } from '@/components/admin/ProductMasterManagement';
import { Badge } from '@/components/ui/badge';

export default function ProductMaster() {
  const { userRole } = useAuth();
  const isSuperAdmin = userRole?.system_role === 'super_admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Product Master</h2>
          <p className="text-sm text-muted-foreground">Kelola produk, kategori, dan unit</p>
        </div>
        {!isSuperAdmin && <Badge variant="outline" className="text-[10px]">Read Only</Badge>}
      </div>
      <ProductMasterManagement readOnly={!isSuperAdmin} />
    </div>
  );
}
