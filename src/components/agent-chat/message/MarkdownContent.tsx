"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlockWithCopy } from './CodeBlockWithCopy';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const codeString = String(children).replace(/\n$/, '');

          // Handle mermaid diagrams
          if (language === 'mermaid') {
            return <MermaidDiagram chart={codeString} />;
          }

          // Code blocks with language
          if (language) {
            return <CodeBlockWithCopy code={codeString} language={language} />;
          }

          // Inline code
          return (
            <code
              className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground"
              {...props}
            >
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-4 last:mb-0 text-14 text-foreground leading-relaxed">{children}</p>;
        },
        h1({ children }) {
          return <h1 className="text-2xl font-semibold mb-4 mt-6 first:mt-0 text-foreground">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-xl font-semibold mb-3 mt-5 first:mt-0 text-foreground">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-foreground">{children}</h3>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside mb-4 space-y-1 text-foreground">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-4 space-y-1 text-foreground">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-14 text-foreground">{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-border pl-4 my-4 italic text-muted-foreground">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 underline"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4 border border-border rounded-lg">
              <table className="min-w-full border-collapse">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted/50">{children}</thead>;
        },
        tbody({ children }) {
          return <tbody>{children}</tbody>;
        },
        tr({ children }) {
          return <tr className="border-b border-border last:border-b-0">{children}</tr>;
        },
        th({ children }) {
          return (
            <th className="px-4 py-3 text-left text-14 font-semibold text-foreground first:pl-6 last:pr-6">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="px-4 py-3 text-14 text-foreground first:pl-6 last:pr-6">
              {children}
            </td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
