'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OutlookTriggerConfigProps {
  initialConfig?: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
}

export function OutlookTriggerConfig({ initialConfig, onConfigChange }: OutlookTriggerConfigProps) {
  const initialFilters = (initialConfig?.filters as Record<string, unknown>) || {};

  const [folder, setFolder] = useState((initialFilters.folder as string) || '');
  const [isUnread, setIsUnread] = useState((initialFilters.isUnread as boolean) || false);
  const [hasNoCategories, setHasNoCategories] = useState((initialFilters.hasNoCategories as boolean) || false);
  const [from, setFrom] = useState((initialFilters.from as string) || '');
  const [subject, setSubject] = useState((initialFilters.subject as string) || '');
  const [importance, setImportance] = useState((initialFilters.importance as string) || '');
  const [pollInterval, setPollInterval] = useState(
    (initialConfig?.pollInterval as number) || 60
  );

  useEffect(() => {
    const filters: Record<string, unknown> = {};

    if (folder) filters.folder = folder;
    if (isUnread) filters.isUnread = true;
    if (hasNoCategories) filters.hasNoCategories = true;
    if (from) filters.from = from;
    if (subject) filters.subject = subject;
    if (importance) filters.importance = importance;

    onConfigChange({
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      pollInterval,
    });
  }, [folder, isUnread, hasNoCategories, from, subject, importance, pollInterval, onConfigChange]);

  const commonFolders = [
    { value: '', label: 'Any folder' },
    { value: 'inbox', label: 'Inbox' },
    { value: 'sentitems', label: 'Sent Items' },
    { value: 'drafts', label: 'Drafts' },
    { value: 'deleteditems', label: 'Deleted Items' },
    { value: 'junkemail', label: 'Junk Email' },
    { value: 'archive', label: 'Archive' },
  ];

  const importanceLevels = [
    { value: '', label: 'Any importance' },
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
  ];

  const pollIntervals = [
    { value: 30, label: 'Every 30 seconds' },
    { value: 60, label: 'Every minute (recommended)' },
    { value: 300, label: 'Every 5 minutes' },
    { value: 600, label: 'Every 10 minutes' },
    { value: 900, label: 'Every 15 minutes' },
    { value: 1800, label: 'Every 30 minutes' },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
        <h4 className="text-sm font-medium">Email Filters</h4>
        <p className="text-xs text-muted-foreground">
          Configure which emails should trigger this workflow
        </p>

        <div className="space-y-2">
          <Label htmlFor="outlook-folder" className="text-sm">Outlook Folder</Label>
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger id="outlook-folder" className="text-sm">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {commonFolders.map((f) => (
                <SelectItem key={f.value} value={f.value} className="text-sm">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="outlook-importance" className="text-sm">Importance Level</Label>
          <Select value={importance} onValueChange={setImportance}>
            <SelectTrigger id="outlook-importance" className="text-sm">
              <SelectValue placeholder="Select importance" />
            </SelectTrigger>
            <SelectContent>
              {importanceLevels.map((level) => (
                <SelectItem key={level.value} value={level.value} className="text-sm">
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="outlook-unread"
              checked={isUnread}
              onChange={(e) => setIsUnread(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label
              htmlFor="outlook-unread"
              className="text-sm font-normal cursor-pointer"
            >
              Only unread emails
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="outlook-no-categories"
              checked={hasNoCategories}
              onChange={(e) => setHasNoCategories(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label
              htmlFor="outlook-no-categories"
              className="text-sm font-normal cursor-pointer"
            >
              Only emails without categories
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="outlook-from" className="text-sm">From (sender email)</Label>
          <Input
            id="outlook-from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="sender@example.com"
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="outlook-subject" className="text-sm">Subject contains</Label>
          <Input
            id="outlook-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Invoice, Newsletter"
            className="text-sm"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
        <h4 className="text-sm font-medium">Polling Settings</h4>

        <div className="space-y-2">
          <Label htmlFor="outlook-interval" className="text-sm">Check for new emails</Label>
          <Select
            value={pollInterval.toString()}
            onValueChange={(value) => setPollInterval(parseInt(value, 10))}
          >
            <SelectTrigger id="outlook-interval" className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pollIntervals.map((interval) => (
                <SelectItem
                  key={interval.value}
                  value={interval.value.toString()}
                  className="text-sm"
                >
                  {interval.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How often to check Outlook for matching emails
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950 p-3">
        <p className="text-xs text-blue-900 dark:text-blue-100">
          <strong>Note:</strong> Requires Microsoft OAuth connection. Go to Settings → Credentials to connect your Outlook account.
        </p>
      </div>

      <div className="rounded-lg border border-border/50 bg-muted/50 p-3 space-y-2">
        <h4 className="text-sm font-medium">Available Trigger Data</h4>
        <div className="text-xs text-muted-foreground space-y-1">
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.id}}'}</code> - Email ID</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.from}}'}</code> - Sender address</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.to}}'}</code> - Recipient address</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.subject}}'}</code> - Email subject</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.body.text}}'}</code> - Plain text body</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.body.html}}'}</code> - HTML body</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.categories}}'}</code> - Array of categories</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.importance}}'}</code> - Importance level</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.date}}'}</code> - Email date</div>
          <div><code className="bg-muted px-1 rounded">{'{{trigger.email.isUnread}}'}</code> - Read status</div>
        </div>
      </div>
    </div>
  );
}
