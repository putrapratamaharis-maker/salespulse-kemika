import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProductWithSales {
  id: string;
  name: string;
  category: string;
  totalRevenue: number;
  unitsSold: number;
  segments: string[];
}

const Products = () => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductWithSales[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: prods }, { data: sales }, { data: cats }] = await Promise.all([
        supabase.from('products').select('id, name, category_id').eq('is_active', true).order('name'),
        supabase.from('product_sales').select('product_id, revenue, units_sold, segment'),
        supabase.from('product_categories').select('id, name'),
      ]);

      const catMap = new Map((cats || []).map(c => [c.id, c.name]));
      const salesByProduct = new Map<string, { revenue: number; units: number; segments: Set<string> }>();

      (sales || []).forEach(s => {
        const existing = salesByProduct.get(s.product_id) || { revenue: 0, units: 0, segments: new Set<string>() };
        existing.revenue += Number(s.revenue) || 0;
        existing.units += Number(s.units_sold) || 0;
        if (s.segment) existing.segments.add(s.segment);
        salesByProduct.set(s.product_id, existing);
      });

      const merged: ProductWithSales[] = (prods || []).map(p => {
        const s = salesByProduct.get(p.id);
        return {
          id: p.id,
          name: p.name,
          category: catMap.get(p.category_id || '') || '—',
          totalRevenue: s?.revenue || 0,
          unitsSold: s?.units || 0,
          segments: s ? Array.from(s.segments) : [],
        };
      }).sort((a, b) => b.totalRevenue - a.totalRevenue);

      setProducts(merged);
      setLoading(false);
    };
    fetchData();
  }, []);

  const formatIDR = (val: number) => {
    if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}B`;
    if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(0)}M`;
    if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}K`;
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Performance</h2>
        <p className="text-sm text-muted-foreground">Sales breakdown by product line</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">Belum ada data produk.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <Card key={p.id} className="animate-fade-in">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4 text-accent" />
                  {p.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{p.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-semibold">{formatIDR(p.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Units Sold</span>
                    <span className="font-semibold">{p.unitsSold.toLocaleString()}</span>
                  </div>
                  {p.segments.length > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Segment</span>
                      <span className="font-medium">{p.segments.join(', ')}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;
