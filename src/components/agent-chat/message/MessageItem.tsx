"use client";

import React, { memo } from 'react';
import { MarkdownContent } from './MarkdownContent';
import { ToolDisplay } from './ToolDisplay';

interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp: string;
}

interface MessageItemProps {
  message: Message;
}

const MessageItemComponent = ({ message }: MessageItemProps) => {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-muted text-foreground rounded-xl px-4 py-3 max-w-[90%]">
          <p className="whitespace-pre-wrap text-14">{typeof message.content === 'string' ? message.content : ''}</p>
        </div>
      </div>
    );
  }

  // Assistant message with content blocks
  const contentBlocks = Array.isArray(message.content) ? message.content : [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-foreground font-semibold text-14">b0t</span>
        <span className="text-12 text-muted-foreground">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Render content blocks in order */}
      <div className="space-y-0">
        {contentBlocks.map((block, idx) => {
          if (block.type === 'text') {
            return (
              <div key={idx} className="text-foreground prose prose-invert max-w-none">
                <MarkdownContent content={block.text || ''} />
              </div>
            );
          } else if (block.type === 'tool_use') {
            return (
              <ToolDisplay
                key={block.id || idx}
                toolName={block.name || 'unknown'}
                toolInput={block.input || {}}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export const MessageItem = memo(MessageItemComponent);
