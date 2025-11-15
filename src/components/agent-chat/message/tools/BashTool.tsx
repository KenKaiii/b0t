"use client";

import React, { useState } from 'react';

interface BashToolProps {
  command: string;
  description?: string;
}

export function BashTool({ command, description }: BashToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full border border-white/10 rounded-xl my-3 overflow-hidden">
      <div className="flex justify-between px-4 py-2 w-full text-xs bg-[#0C0E10] border-b border-white/10">
        <div className="flex overflow-hidden flex-1 gap-2 items-center whitespace-nowrap">
          <svg className="w-4 h-4" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" strokeWidth="2">
            <path d="M282.88 788.48l-35.84-35.84L486.4 512c-42.24-38.4-142.08-130.56-225.28-215.04L243.2 279.04l35.84-35.84 17.92 17.92c107.52 107.52 241.92 230.4 243.2 231.68 5.12 5.12 7.68 11.52 8.96 17.92 0 6.4-2.56 14.08-7.68 19.2L282.88 788.48zM503.04 733.44h281.6v51.2h-281.6v-51.2z" fill="currentColor" />
          </svg>
          <span className="text-sm font-medium leading-6 text-white">Shell</span>
          <div className="bg-gray-700 shrink-0 min-h-4 w-[1px] h-4" role="separator" aria-orientation="vertical" />
          <span className="flex-1 min-w-0 text-xs truncate text-white/60">{command}</span>
        </div>
        <div className="flex gap-1 items-center whitespace-nowrap">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            data-collapsed={!isExpanded}
            className="p-1.5 rounded-lg transition-all data-[collapsed=true]:-rotate-180"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" stroke="currentColor" className="w-3 h-3 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-black/30 text-sm space-y-2 text-white">
          <div>
            <span className="text-xs font-semibold text-white/60">Command:</span>
            <div className="font-mono text-sm mt-1 bg-black/20 px-2 py-1 rounded">
              <span className="text-green-400">$</span> <span>{command}</span>
            </div>
          </div>
          {description && (
            <div>
              <span className="text-xs font-semibold text-white/60">Description:</span>
              <div className="text-sm mt-1">{description}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
