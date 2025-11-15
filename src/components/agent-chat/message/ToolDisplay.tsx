"use client";

import React, { memo } from 'react';
import { TodoWriteTool } from './tools/TodoWriteTool';
import { EditWriteTool } from './tools/EditWriteTool';
import { BashTool } from './tools/BashTool';
import { ReadTool } from './tools/ReadTool';
import { GrepTool } from './tools/GrepTool';
import { DefaultTool } from './tools/DefaultTool';

interface TodoItem {
  content: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ToolDisplayProps {
  toolName: string;
  toolInput: Record<string, unknown>;
}

const ToolDisplayComponent = ({ toolName, toolInput }: ToolDisplayProps) => {
  // Route to specialized tool components
  switch (toolName) {
    case 'TodoWrite':
      if (toolInput.todos) {
        return <TodoWriteTool todos={toolInput.todos as TodoItem[]} />;
      }
      break;

    case 'Edit':
    case 'Write':
      if (toolInput.file_path) {
        return (
          <EditWriteTool
            toolName={toolName as 'Edit' | 'Write'}
            filePath={toolInput.file_path as string}
            oldString={toolInput.old_string as string | undefined}
            newString={toolInput.new_string as string | undefined}
            content={toolInput.content as string | undefined}
          />
        );
      }
      break;

    case 'Bash':
      if (toolInput.command) {
        return (
          <BashTool
            command={toolInput.command as string}
            description={toolInput.description as string | undefined}
          />
        );
      }
      break;

    case 'Read':
      if (toolInput.file_path) {
        return (
          <ReadTool
            filePath={toolInput.file_path as string}
            offset={toolInput.offset as number | undefined}
            limit={toolInput.limit as number | undefined}
          />
        );
      }
      break;

    case 'Grep':
      if (toolInput.pattern) {
        return (
          <GrepTool
            pattern={toolInput.pattern as string}
            path={toolInput.path as string | undefined}
            glob={toolInput.glob as string | undefined}
          />
        );
      }
      break;
  }

  // Default display for all other tools
  return <DefaultTool toolName={toolName} toolInput={toolInput} />;
}

export const ToolDisplay = memo(ToolDisplayComponent);
