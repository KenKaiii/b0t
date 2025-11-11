export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  trigger: {
    type: 'manual' | 'cron' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input' | 'gmail' | 'outlook';
    config: Record<string, unknown>;
  };
  config: Record<string, unknown>;
  createdAt: Date | null;
  lastRun: Date | null;
  lastRunStatus: string | null;
  lastRunOutput: unknown | null;
  runCount: number;
}

export interface CredentialListItem {
  id: string;
  platform: string;
  name: string;
  type: string;
  createdAt: Date | null;
  lastUsed: Date | null;
}
