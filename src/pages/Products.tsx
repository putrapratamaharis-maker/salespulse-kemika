import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

const Products = () => {
  const products = [
    { name: 'Medical Equipment Pro', segment: 'B2G', revenue: 2050000000, units: 45, margin: 22 },
    { name: 'Network Switch X500', segment: 'B2B', revenue: 1230000000, units: 320, margin: 21 },
    { name: 'Widget Pro X', segment: 'B2C', revenue: 385000000, units: 12400, margin: 28 },
    { name: 'Lab Equipment Starter', segment: 'B2G', revenue: 800000000, units: 15, margin: 18 },
    { name: 'Server Rack Enterprise', segment: 'B2B', revenue: 900000000, units: 85, margin: 19 },
    { name: 'Smart Sensor Kit', segment: 'B2C', revenue: 210000000, units: 5600, margin: 32 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Product Performance</h2>
        <p className="text-sm text-muted-foreground">Sales breakdown by product line</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <Card key={p.name} className="animate-fade-in">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-accent" />
                {p.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-semibold">Rp {(p.revenue / 1_000_000).toFixed(0)}M</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Units Sold</span>
                  <span className="font-semibold">{p.units.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margin</span>
                  <span className={`font-semibold ${p.margin >= 17 ? 'text-status-green' : 'text-status-red'}`}>{p.margin}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Segment</span>
                  <span className="font-medium">{p.segment}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Products;
