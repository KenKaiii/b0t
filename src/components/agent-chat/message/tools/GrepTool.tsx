"use client";

import React, { useState } from 'react';

interface GrepToolProps {
  pattern: string;
  path?: string;
  glob?: string;
}

export function GrepTool({ pattern, path, glob }: GrepToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full border border-white/10 rounded-xl my-3 overflow-hidden">
      <div className="flex justify-between px-4 py-2 w-full text-xs bg-[#0C0E10] border-b border-white/10">
        <div className="flex overflow-hidden flex-1 gap-2 items-center whitespace-nowrap">
          <svg className="w-4 h-4" strokeWidth="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-medium leading-6 text-white">Grep</span>
          <div className="bg-gray-700 shrink-0 min-h-4 w-[1px] h-4" role="separator" aria-orientation="vertical" />
          <span className="flex-1 min-w-0 text-xs truncate text-white/60">{pattern}</span>
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
            <span className="text-xs font-semibold text-white/60">Pattern:</span>
            <div className="text-sm mt-1 font-mono">{pattern}</div>
          </div>
          {path && (
            <div>
              <span className="text-xs font-semibold text-white/60">Path:</span>
              <div className="text-sm mt-1 font-mono">{path}</div>
            </div>
          )}
          {glob && (
            <div>
              <span className="text-xs font-semibold text-white/60">Glob:</span>
              <div className="text-sm mt-1 font-mono">{glob}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
