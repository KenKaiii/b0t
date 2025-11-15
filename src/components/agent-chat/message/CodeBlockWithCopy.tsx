"use client";

import React, { useState, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { toast } from 'sonner';

interface CodeBlockWithCopyProps {
  code: string;
  language: string;
}

const CodeBlockWithCopyComponent = ({ code, language }: CodeBlockWithCopyProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="flex flex-col bg-card border border-border rounded-lg overflow-hidden my-3">
      {/* Title bar */}
      <div className="flex justify-between items-center px-4 py-2 w-full text-xs border-b border-border bg-muted/50">
        <div className="flex gap-2 items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4 text-foreground/80"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
          </svg>
          <div className="text-sm font-medium text-foreground">{language}</div>
        </div>

        <button
          onClick={handleCopy}
          className="px-2 py-1 rounded-md hover:bg-gray-alpha-200 transition text-xs text-foreground"
          aria-label={copied ? "Copied!" : "Copy code"}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code content */}
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          background: 'transparent',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export const CodeBlockWithCopy = memo(CodeBlockWithCopyComponent);
