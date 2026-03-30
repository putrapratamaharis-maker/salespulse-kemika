import { useAuth } from '@/context/AuthContext';
import { ProductMasterManagement } from '@/components/admin/ProductMasterManagement';

export default function ProductMaster() {
  const { userRole } = useAuth();

  if (!userRole || !['super_admin', 'admin', 'staff'].includes(userRole.system_role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Anda tidak memiliki akses ke halaman ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Master</h2>
        <p className="text-sm text-muted-foreground">Kelola produk, kategori, dan unit</p>
      </div>
      <ProductMasterManagement />
    </div>
  );
}
