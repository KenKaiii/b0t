"use client";

import React, { useState } from 'react';

interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface TodoWriteToolProps {
  todos: TodoItem[];
}

export function TodoWriteTool({ todos }: TodoWriteToolProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
  const pendingCount = todos.filter((t) => t.status === 'pending').length;

  return (
    <div className="w-full border border-white/10 rounded-xl my-3 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between px-4 py-2 w-full text-xs bg-[#0C0E10] border-b border-white/10">
        <div className="flex overflow-hidden flex-1 gap-2 items-center whitespace-nowrap">
          <svg className="w-4 h-4" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" strokeWidth="1.5">
            <path d="M266.304 104.544l-105.408 105.92-41.408-41.6a31.904 31.904 0 0 0-54.496 13.888c-2.88 11.424 0.672 23.552 9.28 31.552l64 64.32a31.904 31.904 0 0 0 45.216 0l128-128.64a32.256 32.256 0 0 0-0.864-44.576 31.904 31.904 0 0 0-44.352-0.864h0.032zM176 384a112 112 0 1 1 0 224 112 112 0 0 1 0-224z m9.376 64.8a48.064 48.064 0 1 0 24.416 81.216 48.064 48.064 0 0 0-24.416-81.216zM928.064 160H416a32 32 0 0 0 0 64h512.064a32 32 0 0 0 0-64zM928.064 480H416a32 32 0 0 0 0 64h512.064a32 32 0 0 0 0-64zM176 720a112 112 0 1 1 0 224 112 112 0 0 1 0-224z m9.376 64.8a48.064 48.064 0 1 0 24.416 81.216 48.064 48.064 0 0 0-24.416-81.216zM928.064 800H416a32 32 0 0 0 0 64h512.064a32 32 0 0 0 0-64z" fill="currentColor" stroke="currentColor"/>
          </svg>
          <span className="text-sm font-medium leading-6 text-white">Task List</span>
          <div className="bg-gray-700 shrink-0 min-h-4 w-[1px] h-4" role="separator" aria-orientation="vertical" />
          <span className="flex-1 min-w-0 text-xs truncate text-white/60">
            {completedCount}/{todos.length} completed
            {inProgressCount > 0 && ` · ${inProgressCount} in progress`}
            {pendingCount > 0 && ` · ${pendingCount} pending`}
          </span>
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

      {/* Content */}
      {isExpanded && (
        <div className="p-4 bg-black/30 text-sm">
          <div className="space-y-1">
            {todos.map((todo, i) => (
              <div
                key={i}
                className="flex gap-2 items-center py-1.5 px-2 rounded hover:bg-white/5 transition-colors"
              >
                {/* Status indicator */}
                <div className="flex items-center justify-center w-5 h-5 shrink-0">
                  {todo.status === 'completed' ? (
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : todo.status === 'in_progress' ? (
                    <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </div>

                {/* Task text */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white/40 mr-1">{i + 1}.</span>
                  <span
                    className={`${
                      todo.status === 'completed'
                        ? 'text-white/40 line-through'
                        : todo.status === 'in_progress'
                        ? 'font-medium text-blue-400'
                        : 'text-white/70'
                    }`}
                  >
                    {todo.status === 'in_progress' ? todo.activeForm : todo.content}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
