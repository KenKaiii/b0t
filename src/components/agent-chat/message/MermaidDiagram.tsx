import React, { useLayoutEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#fafafa',
    primaryBorderColor: 'rgba(59, 130, 246, 0.3)',
    lineColor: 'rgba(59, 130, 246, 0.5)',
    secondaryColor: 'rgba(59, 130, 246, 0.1)',
    background: 'transparent',
    mainBkg: 'rgba(59, 130, 246, 0.1)',
    secondBkg: 'rgba(59, 130, 246, 0.05)',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
  },
  securityLevel: 'loose',
});

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const renderedChartRef = useRef<string>('');

  useLayoutEffect(() => {
    // Only render if chart content changed
    if (renderedChartRef.current === chart) return;

    const timeoutId = setTimeout(async () => {
      if (ref.current && renderedChartRef.current !== chart) {
        try {
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2)}`;
          const { svg } = await mermaid.render(id, chart);
          ref.current.innerHTML = svg;
          renderedChartRef.current = chart;
        } catch {
          if (ref.current) {
            ref.current.innerHTML = `<code class="text-sm text-muted-foreground">${chart}</code>`;
            renderedChartRef.current = chart;
          }
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [chart]);

  return (
    <div
      ref={ref}
      className="my-3 p-4 border border-border rounded-lg bg-black/20 overflow-x-auto"
      style={{ minHeight: '100px' }}
    />
  );
}
