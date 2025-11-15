#!/usr/bin/env tsx
/**
 * Test Workflow Script
 *
 * Execute a workflow and get detailed debugging information.
 * Helps identify issues and provides actionable feedback.
 *
 * Usage:
 *   npx tsx scripts/test-workflow.ts <workflow-id>
 *   npx tsx scripts/test-workflow.ts <workflow-file.json>
 *   npx tsx scripts/test-workflow.ts <workflow-file.json> --dry-run
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { type WorkflowExport } from '../src/lib/workflows/import-export';

const API_URL = process.env.API_URL || 'http://localhost:3123';

/**
 * Check if server is running
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/workflows`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000)
    });
    return response.status !== 500;
  } catch {
    return false;
  }
}

/**
 * Start development server
 */
function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🚀 Server not running. Starting development server...');

    const serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'ignore',
      detached: true,
    });

    serverProcess.unref();

    // Wait for server to be ready
    let attempts = 0;
    const maxAttempts = 30;

    const checkInterval = setInterval(async () => {
      attempts++;

      if (await isServerRunning()) {
        clearInterval(checkInterval);
        console.log('✅ Server started successfully\n');
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 1000);
  });
}

interface ExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  errorStep?: string;
  duration?: number;
}

/**
 * Check if output matches the configured display type
 */
function checkOutputCompatibility(
  output: unknown,
  displayConfig?: WorkflowExport['config']['outputDisplay']
): string[] {
  const warnings: string[] = [];

  if (!displayConfig) {
    return warnings; // Auto-detection will be used
  }

  const outputType = Array.isArray(output) ? 'array' : typeof output;
  const displayType = displayConfig.type;

  switch (displayType) {
    case 'table':
      if (!Array.isArray(output)) {
        warnings.push(
          `❌ Output type mismatch: Display expects "table" (array) but workflow output is ${outputType}`
        );
        warnings.push(`   💡 Fix: Change the final step to return an array, or change outputDisplay.type to "${outputType === 'object' ? 'json' : 'text'}"`);
      } else if (output.length > 0 && typeof output[0] !== 'object') {
        warnings.push(`⚠️  Table display expects array of objects, but got array of ${typeof output[0]}`);
      }
      break;

    case 'list':
      if (!Array.isArray(output)) {
        warnings.push(`❌ Output type mismatch: Display expects "list" (array) but workflow output is ${outputType}`);
      }
      break;

    case 'text':
    case 'markdown':
      if (typeof output !== 'string') {
        warnings.push(`❌ Output type mismatch: Display expects "${displayType}" (string) but workflow output is ${outputType}`);
        warnings.push(`   💡 Fix: Change the final step to return a string, or change outputDisplay.type to "json"`);
      }
      break;

    case 'chart':
      // Chart type accepts various data formats
      break;

    case 'image':
      if (typeof output !== 'string' && !Buffer.isBuffer(output)) {
        warnings.push(`⚠️  Image display expects a URL string or Buffer`);
      }
      break;

    case 'images':
      if (!Array.isArray(output)) {
        warnings.push(`❌ Output type mismatch: Display expects "images" (array) but workflow output is ${outputType}`);
      }
      break;

    case 'json':
      // JSON accepts any type
      break;
  }

  return warnings;
}

/**
 * Analyze error and provide actionable feedback
 */
function analyzeError(error: string): {
  category: string;
  suggestion: string;
  fixable: 'claude' | 'user' | 'both';
} {
  const errorLower = error.toLowerCase();

  // Missing credentials
  if (
    errorLower.includes('api key') ||
    errorLower.includes('api_key') ||
    errorLower.includes('apikey') ||
    errorLower.includes('unauthorized') ||
    errorLower.includes('authentication') ||
    errorLower.includes('credentials')
  ) {
    return {
      category: 'Missing Credentials',
      suggestion: `Configure API credentials at ${API_URL}/settings/credentials`,
      fixable: 'user',
    };
  }

  // Module not found
  if (
    errorLower.includes('module not found') ||
    errorLower.includes('cannot find module') ||
    errorLower.includes('function does not exist')
  ) {
    return {
      category: 'Invalid Module Path',
      suggestion: 'Check module path format. Use: npx tsx scripts/search-modules.ts to find valid modules',
      fixable: 'claude',
    };
  }

  // Variable reference error
  if (
    errorLower.includes('undefined') &&
    (errorLower.includes('variable') || errorLower.includes('reference'))
  ) {
    return {
      category: 'Variable Reference Error',
      suggestion: 'Variable may not be declared or step may have failed. Check outputAs in previous steps.',
      fixable: 'claude',
    };
  }

  // Type error
  if (errorLower.includes('type') && errorLower.includes('expected')) {
    return {
      category: 'Type Mismatch',
      suggestion: 'Input parameter has wrong type. Check function signature and input values.',
      fixable: 'claude',
    };
  }

  // Rate limit
  if (
    errorLower.includes('rate limit') ||
    errorLower.includes('too many requests') ||
    errorLower.includes('429')
  ) {
    return {
      category: 'Rate Limit',
      suggestion: 'API rate limit exceeded. Wait and retry, or add rate limiting to workflow.',
      fixable: 'both',
    };
  }

  // Network error
  if (
    errorLower.includes('network') ||
    errorLower.includes('timeout') ||
    errorLower.includes('econnrefused') ||
    errorLower.includes('fetch failed')
  ) {
    return {
      category: 'Network Error',
      suggestion: 'Check internet connection or API endpoint availability.',
      fixable: 'user',
    };
  }

  // Invalid input
  if (
    errorLower.includes('invalid') ||
    errorLower.includes('malformed') ||
    errorLower.includes('validation')
  ) {
    return {
      category: 'Invalid Input',
      suggestion: 'Input parameters do not match expected format. Check function signature.',
      fixable: 'claude',
    };
  }

  // Permission error
  if (errorLower.includes('permission') || errorLower.includes('forbidden')) {
    return {
      category: 'Permission Error',
      suggestion: 'API credentials may lack required permissions. Check API key scopes.',
      fixable: 'user',
    };
  }

  // Generic error
  return {
    category: 'Unknown Error',
    suggestion: 'Review error message and workflow logic. May need manual debugging.',
    fixable: 'both',
  };
}

/**
 * Execute workflow from JSON (without importing to DB)
 */
async function testWorkflowFromJSON(
  workflowJson: string,
  dryRun: boolean
): Promise<void> {
  const workflow = JSON.parse(workflowJson) as WorkflowExport;

  console.log(`\n🧪 Testing workflow: ${workflow.name}`);
  console.log(`📝 Description: ${workflow.description}`);
  console.log(`🔧 Steps: ${workflow.config.steps.length}`);

  if (dryRun) {
    console.log('\n🏃 DRY RUN MODE - No actual execution\n');
    workflow.config.steps.forEach((step, index) => {
      console.log(`Step ${index + 1}: ${step.id}`);
      console.log(`  Module: ${step.module}`);
      console.log(`  Inputs:`, JSON.stringify(step.inputs, null, 2));
      if (step.outputAs) {
        console.log(`  Output as: ${step.outputAs}`);
      }
      console.log();
    });
    console.log('✅ Dry run complete - workflow structure looks good');
    return;
  }

  // Check if server is running, start if needed
  if (!(await isServerRunning())) {
    await startServer();
  }

  // Import and execute via test endpoint (no auth required in dev)
  console.log('\n▶️  Executing workflow...\n');

  const testResponse = await fetch(`${API_URL}/api/workflows/execute-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowJson }),
  });

  const result = await testResponse.json();

  if (!testResponse.ok || result.error) {
    console.error('\n❌ Test failed:', result.error);
    if (result.details) {
      console.error('   Details:', result.details);
    }
    process.exit(1);
  }

  const duration = result.duration || 0;

  // Display results
  if (result.success) {
    console.log('✅ Workflow executed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);

    // Check output compatibility with display config
    const compatibilityWarnings = checkOutputCompatibility(result.output, workflow.config.outputDisplay);
    if (compatibilityWarnings.length > 0) {
      console.log('\n⚠️  Output Display Compatibility:\n');
      compatibilityWarnings.forEach(warning => console.log(warning));
    }

    console.log('\n📊 Output:');
    console.log(JSON.stringify(result.output, null, 2));
    console.log('\n🧹 Test workflow automatically cleaned up');
  } else {
    console.log('❌ Workflow execution failed');
    console.log(`⏱️  Duration: ${duration}ms`);

    if (result.errorStep) {
      console.log(`\n💥 Failed at step: ${result.errorStep}`);
    }

    console.log('\n📋 Error:');
    console.log(result.error);

    // Analyze error
    const analysis = analyzeError(result.error || '');
    console.log(`\n🔍 Error Analysis:`);
    console.log(`   Category: ${analysis.category}`);
    console.log(`   Suggestion: ${analysis.suggestion}`);

    if (analysis.fixable === 'claude') {
      console.log('   ✅ Claude can fix this automatically');
    } else if (analysis.fixable === 'user') {
      console.log('   ⚠️  User action required');
    } else {
      console.log('   🤝 May require both Claude and user');
    }

    console.log('\n🧹 Test workflow automatically cleaned up');

    process.exit(1);
  }
}

/**
 * Execute workflow by ID
 */
async function testWorkflowById(workflowId: string): Promise<void> {
  console.log(`\n🧪 Testing workflow: ${workflowId}\n`);

  // Get workflow info
  const workflowResponse = await fetch(`${API_URL}/api/workflows`);
  const { workflows } = await workflowResponse.json();
  const workflow = workflows.find((w: { id: string }) => w.id === workflowId);

  if (!workflow) {
    console.error('❌ Workflow not found');
    process.exit(1);
  }

  console.log(`📦 Name: ${workflow.name}`);
  console.log(`📝 Description: ${workflow.description}`);
  console.log(`🔧 Steps: ${workflow.config.steps.length}`);

  // Execute workflow
  console.log('\n▶️  Executing workflow...\n');
  const startTime = Date.now();

  const runResponse = await fetch(`${API_URL}/api/workflows/${workflowId}/run`, {
    method: 'POST',
  });

  const duration = Date.now() - startTime;
  const result: ExecutionResult = await runResponse.json();

  // Display results
  if (result.success) {
    console.log('✅ Workflow executed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log('\n📊 Output:');
    console.log(JSON.stringify(result.output, null, 2));
  } else {
    console.log('❌ Workflow execution failed');
    console.log(`⏱️  Duration: ${duration}ms`);

    if (result.errorStep) {
      console.log(`\n💥 Failed at step: ${result.errorStep}`);
    }

    console.log('\n📋 Error:');
    console.log(result.error);

    // Analyze error
    const analysis = analyzeError(result.error || '');
    console.log(`\n🔍 Error Analysis:`);
    console.log(`   Category: ${analysis.category}`);
    console.log(`   Suggestion: ${analysis.suggestion}`);

    if (analysis.fixable === 'claude') {
      console.log('   ✅ Claude can fix this automatically');
    } else if (analysis.fixable === 'user') {
      console.log('   ⚠️  User action required');
    } else {
      console.log('   🤝 May require both Claude and user');
    }

    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage:
  npx tsx scripts/test-workflow.ts <workflow-id>
  npx tsx scripts/test-workflow.ts <workflow-file.json>
  npx tsx scripts/test-workflow.ts <workflow-file.json> --dry-run

Arguments:
  workflow-id        UUID of existing workflow in database
  workflow-file.json Path to workflow JSON file

Options:
  --dry-run          Show workflow structure without executing
  --help             Show this help message

Environment:
  API_URL            API base URL (default: http://localhost:3123)

Examples:
  # Test existing workflow
  npx tsx scripts/test-workflow.ts abc-123-def-456

  # Test workflow from file
  npx tsx scripts/test-workflow.ts workflow.json

  # Dry run (no execution)
  npx tsx scripts/test-workflow.ts workflow.json --dry-run
  `);
  process.exit(0);
}

const input = args[0];
const dryRun = args.includes('--dry-run');

// Check if input is a file or workflow ID
if (input.endsWith('.json')) {
  // It's a file
  const filePath = resolve(process.cwd(), input);
  try {
    const workflowJson = readFileSync(filePath, 'utf-8');
    testWorkflowFromJSON(workflowJson, dryRun);
  } catch (error) {
    console.error(`❌ Failed to read file: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
} else {
  // It's a workflow ID
  if (dryRun) {
    console.error('❌ --dry-run only works with workflow files, not IDs');
    process.exit(1);
  }
  testWorkflowById(input);
}
