import { useState, useMemo } from 'react';
import { Deal, DealStage, formatIDR, formatDate } from '@/types/sales';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, Filter, X, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AllOpenDealsTableProps {
  deals: Deal[];
  getSalesName: (salesId: string) => string;
  getAccountName: (accountId: string) => string;
}

const stageOptions = [
  { value: 'all', label: 'All Stages' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'po_secured', label: 'PO Secured' },
  { value: 'invoice_issued', label: 'Invoice Issued' },
];

const segmentOptions = [
  { value: 'all', label: 'All Segments' },
  { value: 'B2G', label: 'B2G' },
  { value: 'B2B', label: 'B2B' },
  { value: 'B2C', label: 'B2C' },
];

const sortColumns = [
  { key: 'sales', label: 'Sales' },
  { key: 'value', label: 'Value' },
  { key: 'stage', label: 'Stage' },
  { key: 'segment', label: 'Segment' },
  { key: 'probability', label: 'Prob.' },
  { key: 'close', label: 'Close' },
];

const stageOrd = ['prospect', 'quotation', 'negotiation', 'po_secured', 'invoice_issued'];

export function AllOpenDealsTable({ deals, getSalesName, getAccountName }: AllOpenDealsTableProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const hasFilters = search || stageFilter !== 'all' || segmentFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setStageFilter('all');
    setSegmentFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const filteredAndSorted = useMemo(() => {
    let result = deals.filter(d => !['canceled', 'lost'].includes(d.stage));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        getAccountName(d.accountId).toLowerCase().includes(q) ||
        getSalesName(d.salesId).toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'all') result = result.filter(d => d.stage === stageFilter);
    if (segmentFilter !== 'all') result = result.filter(d => d.segment === segmentFilter);
    if (dateFrom) result = result.filter(d => new Date(d.expectedCloseDate) >= dateFrom);
    if (dateTo) result = result.filter(d => new Date(d.expectedCloseDate) <= dateTo);

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case 'value': cmp = a.value - b.value; break;
          case 'probability': cmp = a.probability - b.probability; break;
          case 'stage': cmp = stageOrd.indexOf(a.stage) - stageOrd.indexOf(b.stage); break;
          case 'segment': cmp = a.segment.localeCompare(b.segment); break;
          case 'sales': cmp = getSalesName(a.salesId).localeCompare(getSalesName(b.salesId)); break;
          case 'close': cmp = a.expectedCloseDate.localeCompare(b.expectedCloseDate); break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [deals, search, stageFilter, segmentFilter, dateFrom, dateTo, sortKey, sortDir, getSalesName, getAccountName]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">All Open Deals</CardTitle>
            <span className="text-xs text-muted-foreground">{filteredAndSorted.length} deals</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search deal, account, or sales..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {segmentOptions.map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 w-[140px] text-xs justify-start font-normal", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("h-8 w-[140px] text-xs justify-start font-normal", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {dateTo ? format(dateTo, 'dd MMM yyyy') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Deal</TableHead>
              {sortColumns.map(col => (
                <TableHead
                  key={col.key}
                  className="text-xs cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No deals found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map(d => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{getAccountName(d.accountId)}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getSalesName(d.salesId)}</TableCell>
                  <TableCell className="text-sm">{formatIDR(d.value)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={d.daysInStage > 14 ? 'red' : d.daysInStage > 7 ? 'yellow' : 'green'}
                      label={d.stage.replace('_', ' ')}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d.segment}</span>
                  </TableCell>
                  <TableCell className="text-sm">{d.probability}%</TableCell>
                  <TableCell className="text-sm">{formatDate(d.expectedCloseDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
