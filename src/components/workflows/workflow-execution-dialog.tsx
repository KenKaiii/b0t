'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { ChatTriggerConfig } from './trigger-configs/chat-trigger-config';
import { WebhookTriggerConfig } from './trigger-configs/webhook-trigger-config';
import { ChatInputExecute } from './trigger-configs/chat-input-execute';
import { InputField } from './trigger-configs/chat-input-trigger-config';
import { RunOutputModal } from './run-output-modal';
import { useWorkflowProgress } from '@/hooks/useWorkflowProgress';
import { WorkflowProgress } from '@/components/workflow/WorkflowProgress';

interface WorkflowExecutionDialogProps {
  workflowId: string;
  workflowName: string;
  workflowDescription?: string;
  workflowConfig?: Record<string, unknown>;
  triggerType: 'manual' | 'cron' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input' | 'gmail' | 'outlook';
  triggerConfig?: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecuted?: () => void;
}

interface ExecutionResult {
  id: string;
  status: 'success' | 'error' | 'running';
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  output: unknown;
  error: string | null;
  errorStep: string | null;
  triggerType: string;
}

export function WorkflowExecutionDialog({
  workflowId,
  workflowName,
  workflowDescription,
  workflowConfig,
  triggerType,
  triggerConfig,
  open,
  onOpenChange,
  onExecuted,
}: WorkflowExecutionDialogProps) {
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTriggerData, setCurrentTriggerData] = useState<Record<string, unknown> | undefined>();
  const chatInputExecuteRef = useRef<(() => void) | null>(null);

  // Use the workflow progress hook for real-time updates
  const { state: progressState, reset: resetProgress} = useWorkflowProgress(
    executing ? workflowId : null,
    executing,
    triggerType,
    currentTriggerData
  );

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setExecutionResult(null);
      setShowOutputModal(false);
      setExecuting(false);
      resetProgress();
    }
  }, [open, resetProgress]);

  // Update execution result when progress completes
  useEffect(() => {
    if (progressState.status === 'completed') {
      setExecutionResult({
        id: 'completed',
        status: 'success',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: progressState.duration || 0,
        output: progressState.output,
        error: null,
        errorStep: null,
        triggerType: 'manual',
      });
      setExecuting(false);
      toast.success('Workflow executed successfully');
      onExecuted?.();
    } else if (progressState.status === 'failed') {
      const errorMessage = progressState.error || 'Workflow execution failed';
      setExecutionResult({
        id: 'failed',
        status: 'error',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
        output: null,
        error: errorMessage,
        errorStep: null,
        triggerType: 'manual',
      });
      setExecuting(false);
      toast.error(errorMessage);
    }
  }, [progressState.status, progressState.duration, progressState.output, progressState.error, onExecuted]);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    setExecutionResult(null);
    resetProgress();
  }, [resetProgress]);

  const getTriggerDescription = () => {
    switch (triggerType) {
      case 'chat':
        return 'Chat with this workflow to trigger execution with conversational context.';
      case 'webhook':
        return 'Test webhook triggers for this workflow.';
      case 'chat-input':
        return 'Fill in the input fields below to execute this workflow.';
      default:
        return 'Execute this workflow now.';
    }
  };

  const handleExecuteWrapper = async () => {
    await handleExecute();
    return { success: true };
  };

  const handleChatInputExecute = useCallback(async (inputData: Record<string, unknown>) => {
    // Set trigger data and start execution
    // This will cause the useWorkflowProgress hook to connect to SSE stream with the trigger data
    setCurrentTriggerData(inputData);
    setExecutionResult(null);
    resetProgress();
    setExecuting(true);
  }, [resetProgress]);

  const renderTriggerConfig = () => {
    switch (triggerType) {
      case 'chat':
        return (
          <ChatTriggerConfig
            workflowId={workflowId}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            onConfigChange={() => {}} // Not needed for SSE streaming
            onExecute={handleExecuteWrapper}
            onFullscreenChange={setIsFullscreen}
          />
        );
      case 'webhook':
        return (
          <WebhookTriggerConfig
            workflowId={workflowId}
            onConfigChange={() => {}} // Not needed for SSE streaming
            onExecute={handleExecuteWrapper}
          />
        );
      case 'chat-input':
        const fields = (triggerConfig?.fields as InputField[]) || [];
        return (
          <ChatInputExecute
            workflowId={workflowId}
            fields={fields}
            onExecute={handleChatInputExecute}
            executing={executing}
            onReady={(executeFunc) => {
              chatInputExecuteRef.current = executeFunc;
            }}
          />
        );
      default:
        return null; // Manual and other triggers just show the execute button
    }
  };

  const handleViewResults = () => {
    setShowOutputModal(true);
  };

  // Handle Enter key for manual trigger
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !executing && !executionResult && triggerType === 'manual') {
      e.preventDefault();
      handleExecute();
    }
  }, [executing, executionResult, triggerType, handleExecute]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={
            triggerType === 'chat' && !isFullscreen
              ? 'sm:max-w-4xl w-full h-[85vh] flex flex-col p-0 border-0 rounded-lg gap-0 outline-0 ring-0'
              : isFullscreen
                ? '!max-w-none w-screen h-screen flex flex-col p-0 rounded-none border-0 gap-0 outline-0 ring-0'
                : 'sm:max-w-md'
          }
          onOpenAutoFocus={triggerType === 'chat' ? (e) => e.preventDefault() : undefined}
          onKeyDown={handleKeyDown}
        >
          {triggerType === 'chat' && !isFullscreen ? (
            <DialogHeader>
              <DialogTitle className="sr-only">{workflowName}</DialogTitle>
              <DialogDescription className="sr-only">
                {getTriggerDescription()}
              </DialogDescription>
            </DialogHeader>
          ) : triggerType !== 'chat' ? (
            <DialogHeader>
              <DialogTitle>{workflowName}</DialogTitle>
              <DialogDescription className="text-xs">
                {getTriggerDescription()}
              </DialogDescription>
            </DialogHeader>
          ) : null}

          <div className={triggerType === 'chat' ? 'flex-1 min-h-0 overflow-hidden' : 'py-4 space-y-4'}>
            {/* Show real-time progress when executing */}
            {executing && progressState.status !== 'idle' && (
              <div className="px-6">
                <WorkflowProgress state={progressState} mode="expanded" />
              </div>
            )}

            {/* Render trigger-specific configuration when not executing */}
            {!executing && renderTriggerConfig()}
          </div>

          {triggerType !== 'chat' && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={executing}
                className="flex-1 sm:flex-none"
              >
                Close
              </Button>
              {/* Show Execute button for all triggers except webhook and chat */}
              {triggerType !== 'webhook' && !executionResult && (
                <Button
                  onClick={() => {
                    if (triggerType === 'chat-input' && chatInputExecuteRef.current) {
                      chatInputExecuteRef.current();
                    } else {
                      handleExecute();
                    }
                  }}
                  disabled={executing}
                  className="flex-1 sm:flex-auto"
                  size="lg"
                >
                  {executing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Execute
                    </>
                  )}
                </Button>
              )}
              {executionResult && (
                <>
                  {executionResult.status === 'error' && executionResult.error && (
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(executionResult.error || '');
                        toast.success('Error copied to clipboard');
                      }}
                      variant="outline"
                      size="lg"
                      className="flex-1 sm:flex-auto"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Error
                    </Button>
                  )}
                  <Button
                    onClick={handleViewResults}
                    className="flex-1 sm:flex-auto"
                    size="lg"
                    variant={executionResult.status === 'error' ? 'destructive' : 'default'}
                  >
                    {executionResult.status === 'success' ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        View Results
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        View Error
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <RunOutputModal
        run={executionResult}
        modulePath={getLastStepModule(workflowConfig)}
        workflowConfig={workflowConfig}
        open={showOutputModal}
        onOpenChange={setShowOutputModal}
      />
    </>
  );
}

/**
 * Helper to get the module path of the last step (most likely to produce final output)
 */
function getLastStepModule(config: Record<string, unknown> | undefined): string {
  if (!config?.steps || !Array.isArray(config.steps)) return '';
  const lastStep = config.steps[config.steps.length - 1];
  if (lastStep && typeof lastStep === 'object' && 'module' in lastStep) {
    return String(lastStep.module);
  }
  return '';
}
