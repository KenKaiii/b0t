"use client";

import React, { useState } from 'react';

interface ReadToolProps {
  filePath: string;
  offset?: number;
  limit?: number;
}

export function ReadTool({ filePath, offset, limit }: ReadToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="w-full border border-white/10 rounded-xl my-3 overflow-hidden">
      <div className="flex justify-between px-4 py-2 w-full text-xs bg-[#0C0E10] border-b border-white/10">
        <div className="flex overflow-hidden flex-1 gap-2 items-center whitespace-nowrap">
          <svg className="w-4 h-4" strokeWidth="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-sm font-medium leading-6 text-white">Read</span>
          <div className="bg-gray-700 shrink-0 min-h-4 w-[1px] h-4" role="separator" aria-orientation="vertical" />
          <span className="flex-1 min-w-0 text-xs truncate text-white/60">{filePath}</span>
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
            <span className="text-xs font-semibold text-white/60">File Path:</span>
            <div className="text-sm mt-1 font-mono">{filePath}</div>
          </div>
          {offset !== undefined && (
            <div>
              <span className="text-xs font-semibold text-white/60">Offset:</span>
              <div className="text-sm mt-1">{offset} lines</div>
            </div>
          )}
          {limit !== undefined && (
            <div>
              <span className="text-xs font-semibold text-white/60">Limit:</span>
              <div className="text-sm mt-1">{limit} lines</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
