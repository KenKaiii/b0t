'use client';

import { Button } from '@/components/ui/button';
import { Copy, Download, Check, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

interface Column {
  key: string;
  label: string;
  type?: 'text' | 'link' | 'date' | 'number' | 'boolean';
}

interface DataTableProps {
  data: unknown;
  config?: {
    columns?: Column[];
  };
  onClose?: () => void;
}

export function DataTable({ data, config, onClose }: DataTableProps) {
  // Hook must be at the top before any returns
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted before using portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle single object with nested array
  if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;

    // Check for common nested array patterns
    const arrayKeys = ['items', 'data', 'results', 'entries', 'records', 'rows'];
    for (const key of arrayKeys) {
      const value = dataObj[key];
      if (Array.isArray(value) && value.length > 0) {
        // Found nested array - use it directly
        data = value;
        break;
      }
    }

    // If still not an array after checking, show as key-value pairs
    // Note: Custom columns are ignored for single objects as they only apply to arrays
    if (!Array.isArray(data)) {
      const entries = Object.entries(dataObj);
      return (
        <div className="relative overflow-hidden rounded-lg border-0 bg-gradient-to-br from-primary/5 via-blue-500/3 to-primary/5 backdrop-blur-sm shadow-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-400 to-primary opacity-80" />
          <table className="w-full text-sm mt-1">
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b border-border/30 last:border-0 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200">
                  <td className="p-3 font-medium text-muted-foreground bg-muted/30 w-1/3">
                    {formatLabel(key)}
                  </td>
                  <td className="p-3">
                    <CellRenderer value={value} type={inferType(value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  // Handle array of objects
  if (!Array.isArray(data)) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/5 p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              Type Mismatch: Table Display Error
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Table display requires array data. Received: <code className="bg-muted px-1 py-0.5 rounded">{typeof data}</code>
            </p>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground select-none">
              Technical Details
            </summary>
            <div className="mt-2 bg-black/5 dark:bg-white/5 rounded p-3 font-mono space-y-2">
              <div className="text-muted-foreground">
                <div className="mb-2 font-semibold">Type Analysis:</div>
                <div>Expected: Array</div>
                <div>Received: {typeof data}</div>
                <div>Display Mode: Table</div>
              </div>
              <div className="text-muted-foreground">
                <div className="mb-2 font-semibold">Data Preview:</div>
                <pre className="text-[10px] whitespace-pre-wrap break-all">
{JSON.stringify(data, null, 2).slice(0, 200)}{JSON.stringify(data).length > 200 ? '...(truncated)' : ''}
                </pre>
              </div>
              <div className="text-muted-foreground">
                <div className="mb-2 font-semibold">Resolution Steps:</div>
                <div>1. Verify transform step returns array</div>
                <div>2. Check returnValue extracts correct field</div>
                <div>3. Use outputDisplay type: &quot;json&quot; for objects</div>
                <div>4. Review workflow JSON structure</div>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
              Empty Result Set
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Workflow executed successfully but returned 0 items.
            </p>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground select-none">
              Technical Details
            </summary>
            <div className="mt-2 bg-black/5 dark:bg-white/5 rounded p-3 font-mono space-y-1">
              <div className="text-muted-foreground">
                <div className="mb-2 font-semibold">Output Analysis:</div>
                <div>Type: Array</div>
                <div>Length: 0</div>
                <div>Display Mode: Table</div>
              </div>
              <div className="text-muted-foreground mt-3">
                <div className="mb-2 font-semibold">Common Causes:</div>
                <div>1. API/source returned no matching results</div>
                <div>2. Query parameters too restrictive (date range, filters)</div>
                <div>3. Transform/filter step removed all items</div>
                <div>4. Data source temporarily empty</div>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // Infer columns if not provided
  const columns = config?.columns || inferColumnsFromData(data);

  // Export functions
  const convertToCSV = () => {
    const headers = columns.map((col) => col.label).join(',');
    const rows = data
      .map((row) =>
        columns
          .map((col) => {
            const value = getNestedValue(row, col.key);
            const stringValue = value === null || value === undefined ? '' : String(value);
            // Escape quotes and wrap in quotes if contains comma/quote/newline
            return /[",\n]/.test(stringValue)
              ? `"${stringValue.replace(/"/g, '""')}"`
              : stringValue;
          })
          .join(',')
      )
      .join('\n');
    return `${headers}\n${rows}`;
  };

  const handleCopy = async () => {
    try {
      const csv = convertToCSV();
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    const csv = convertToCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table-data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded as table-data.csv');
  };

  const floatingButtons = mounted && createPortal(
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '24px',
        zIndex: 9998,
        display: 'flex',
        gap: '8px',
        pointerEvents: 'auto',
        isolation: 'isolate',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)',
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
        className="h-8 gap-2 bg-background shadow-xl border-2 border-primary/20"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy CSV'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
        }}
        className="h-8 gap-2 bg-background shadow-xl border-2 border-primary/20"
      >
        <Download className="h-3.5 w-3.5" />
        Download CSV
      </Button>
      {onClose && (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="h-8 gap-2 bg-background shadow-xl border-2 border-primary/20"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </Button>
      )}
    </div>,
    document.body
  );

  return (
    <>
      {floatingButtons}
      {/* Scrollable table container */}
      <div className="w-full -mx-6">
        <div className="w-full overflow-x-auto px-6" ref={scrollContainerRef}>
        <div className="relative overflow-hidden rounded-lg border-0 bg-gradient-to-br from-primary/5 via-blue-500/3 to-primary/5 backdrop-blur-sm shadow-sm">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-400 to-primary opacity-80" />
          <table className="w-full border-collapse mt-1" style={{ tableLayout: 'auto' }}>
            <thead className="bg-background/95 backdrop-blur-sm">
              <tr className="border-b border-border/50">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap" style={{ minWidth: '150px' }}>
                  {col.label}
                </th>
              ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all duration-200">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm align-top" style={{ minWidth: '150px', maxWidth: '400px' }}>
                    <div className="break-words overflow-hidden">
                      <CellRenderer value={getNestedValue(row, col.key)} type={col.type} />
                    </div>
                  </td>
                ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </>
  );
}

function CellRenderer({
  value,
  type,
}: {
  value: unknown;
  type?: 'text' | 'link' | 'date' | 'number' | 'boolean';
}) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">—</span>;
  }

  switch (type) {
    case 'link':
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all line-clamp-2"
          title={String(value)}
        >
          {String(value)}
        </a>
      );

    case 'date':
      try {
        const date = new Date(String(value));
        return <span className="whitespace-nowrap">{date.toLocaleDateString()}</span>;
      } catch {
        return <span>{String(value)}</span>;
      }

    case 'number':
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;

    case 'boolean':
      return (
        <span className={value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {value ? '✓' : '✗'}
        </span>
      );

    default:
      // Handle objects and arrays
      if (typeof value === 'object') {
        return (
          <span className="text-muted-foreground text-xs font-mono break-all line-clamp-3">
            {JSON.stringify(value)}
          </span>
        );
      }
      // Handle long text with line clamping
      const textValue = String(value);
      if (textValue.length > 100) {
        return (
          <span className="line-clamp-3" title={textValue}>
            {textValue}
          </span>
        );
      }
      return <span>{textValue}</span>;
  }
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function inferColumnsFromData(data: unknown[]): Column[] {
  if (data.length === 0) return [];

  const firstItem = data[0];
  if (typeof firstItem !== 'object' || firstItem === null) return [];

  return Object.keys(firstItem)
    .map((key) => ({
      key,
      label: formatLabel(key),
      type: inferType((firstItem as Record<string, unknown>)[key]),
    }));
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function inferType(value: unknown): 'text' | 'link' | 'date' | 'number' | 'boolean' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) return 'link';
    const date = new Date(value);
    if (!isNaN(date.getTime()) && value.length > 8) return 'date';
  }
  return 'text';
}
