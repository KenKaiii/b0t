#!/usr/bin/env tsx
/**
 * Build Workflow from Plan
 *
 * One-command workflow generation from simple YAML/JSON plan.
 * Directly builds workflow JSON with validation, no shell commands.
 *
 * Usage:
 *   npm run workflow:build <plan-file>
 *   npm run workflow:build workflow-plan.yaml
 *
 * Plan format (YAML):
 *   name: My Workflow
 *   description: Optional description
 *   trigger: manual | cron | webhook | chat
 *   output: json | table | text
 *   steps:
 *     - module: utilities.math.max
 *       id: calc-max
 *       inputs:
 *         numbers: "{{data}}"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { getModuleRegistry } from '../src/lib/workflows/module-registry';
import type { WorkflowExport } from '../src/lib/workflows/import-export';

interface WorkflowPlan {
  name: string;
  description?: string;
  trigger: 'manual' | 'cron' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input';
  output: 'json' | 'table' | 'list' | 'text' | 'markdown' | 'image' | 'images' | 'chart';
  outputColumns?: string[];
  category?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  returnValue?: string;  // Optional custom returnValue
  steps: StepPlan[];
}

interface StepPlan {
  module: string;
  id: string;
  name?: string;
  inputs?: Record<string, unknown>;  // Optional - defaults to {} for modules with no params
  outputAs?: string;
}

/**
 * Find module in registry
 */
function findModuleInRegistry(modulePath: string) {
  const [category, moduleName, functionName] = modulePath.split('.');
  const registry = getModuleRegistry();

  for (const cat of registry) {
    if (cat.name !== category) continue;
    for (const mod of cat.modules) {
      if (mod.name !== moduleName) continue;
      for (const fn of mod.functions) {
        if (fn.name === functionName) {
          return fn;
        }
      }
    }
  }
  return null;
}

/**
 * Module and parameter aliases
 */
const MODULE_ALIASES: Record<string, string> = {
  // Datetime shortcuts
  'utilities.datetime.format': 'utilities.datetime.formatDate',
  'utilities.datetime.diffDays': 'utilities.datetime.getDaysDifference',
  'utilities.datetime.diffHours': 'utilities.datetime.getHoursDifference',
  'utilities.datetime.diffMinutes': 'utilities.datetime.getMinutesDifference',
  'utilities.datetime.startOfDay': 'utilities.datetime.getStartOfDay',
  'utilities.datetime.endOfDay': 'utilities.datetime.getEndOfDay',
  'utilities.datetime.startOfWeek': 'utilities.datetime.getStartOfWeek',
  'utilities.datetime.endOfWeek': 'utilities.datetime.getEndOfWeek',
  'utilities.datetime.startOfMonth': 'utilities.datetime.getStartOfMonth',
  'utilities.datetime.endOfMonth': 'utilities.datetime.getEndOfMonth',

  // String shortcuts
  'utilities.string-utils.camelCase': 'utilities.string-utils.toCamelCase',
  'utilities.string-utils.pascalCase': 'utilities.string-utils.toPascalCase',
  'utilities.string-utils.snakeCase': 'utilities.string-utils.toSnakeCase',
  'utilities.string-utils.kebabCase': 'utilities.string-utils.toKebabCase',
  'utilities.string-utils.slug': 'utilities.string-utils.toSlug',

  // Category corrections
  'utilities.batching.chunk': 'utilities.array-utils.chunk',

  // JSON transform aliases
  'utilities.json-transform.stringify': 'utilities.json-transform.stringifyJson',
  'utilities.json-transform.parse': 'utilities.json-transform.parseJson',
  'utilities.json-transform.merge': 'utilities.json-transform.deepMerge',

  // Aggregation aliases
  'utilities.aggregation.stdDev': 'utilities.aggregation.stdDeviation',
};

const PARAMETER_ALIASES: Record<string, Record<string, string>> = {
  'utilities.string-utils.toSlug': {
    'str': 'text',
  },
  'utilities.string-utils.truncate': {
    'length': 'maxLength',
  },
  'utilities.array-utils.first': {
    'n': 'count',
  },
  'utilities.array-utils.last': {
    'n': 'count',
  },
  'utilities.aggregation.percentile': {
    'percentile': 'percent',
  },
  'utilities.math.round': {
    'num': 'value',
  },
  'utilities.math.ceil': {
    'num': 'value',
  },
  'utilities.math.floor': {
    'num': 'value',
  },
  'utilities.math.abs': {
    'num': 'value',
  },
  'utilities.math.sqrt': {
    'num': 'value',
  },
  'utilities.control-flow.conditional': {
    'trueValue': 'trueVal',
    'falseValue': 'falseVal',
  },
};

/**
 * Validate date-fns format strings
 */
function validateDateFormat(formatString: string, stepId: string): string[] {
  const errors: string[] = [];

  const invalidPatterns = [
    { pattern: /YYYY/, correct: 'yyyy', desc: 'year' },
    { pattern: /DD(?!D)/, correct: 'dd', desc: 'day of month' },
    { pattern: /D(?!D)/, correct: 'd', desc: 'day of month' },
  ];

  for (const { pattern, correct, desc } of invalidPatterns) {
    if (pattern.test(formatString)) {
      errors.push(
        `Step "${stepId}": Invalid date format string "${formatString}"`,
        `   Use "${correct}" for ${desc}, not the uppercase version`,
        `   See: https://date-fns.org/docs/format`
      );
    }
  }

  return errors;
}

/**
 * Normalize inputs using parameter aliases
 */
function normalizeInputs(modulePath: string, inputs: Record<string, unknown>): Record<string, unknown> {
  const aliases = PARAMETER_ALIASES[modulePath];
  if (!aliases) return inputs;

  const normalized = { ...inputs };
  let hasChanges = false;

  for (const [alias, realName] of Object.entries(aliases)) {
    if (alias in normalized && !(realName in normalized)) {
      normalized[realName] = normalized[alias];
      delete normalized[alias];
      hasChanges = true;
    }
  }

  if (hasChanges) {
    console.log(`   ℹ️  Applied parameter aliases for ${modulePath}`);
  }

  return normalized;
}

/**
 * Validate step against module registry
 */
function validateStep(step: StepPlan, stepIndex: number): string[] {
  const errors: string[] = [];

  // Resolve module aliases
  const originalModule = step.module;
  const resolvedModule = MODULE_ALIASES[step.module] || step.module;

  if (resolvedModule !== originalModule) {
    console.log(`   ℹ️  Step ${stepIndex + 1} ("${step.id}"): Using alias "${originalModule}" → "${resolvedModule}"`);
    step.module = resolvedModule;
  }

  // Check module exists
  const moduleInfo = findModuleInRegistry(step.module);
  if (!moduleInfo) {
    errors.push(`Step ${stepIndex + 1} ("${step.id}"): Module "${step.module}" not found in registry`);
    return errors;
  }

  // Normalize parameter names using aliases
  step.inputs = normalizeInputs(step.module, step.inputs || {});

  // Validate format strings for date-fns modules
  if (step.module === 'utilities.datetime.formatDate') {
    const formatString = step.inputs.formatString;
    if (formatString && typeof formatString === 'string') {
      const formatErrors = validateDateFormat(formatString, step.id);
      if (formatErrors.length > 0) {
        errors.push(...formatErrors);
      }
    }
  }

  const providedParams = Object.keys(step.inputs);
  const allParams = moduleInfo.signature.match(/\(([^)]*)\)/)?.[1] || '';

  // Skip validation for wrapper functions (params/options)
  // These will be auto-wrapped during workflow build
  const usesOptionsWrapper = (allParams === 'options' || allParams.startsWith('options:') || allParams.startsWith('options?'));
  const usesParamsWrapper = (allParams === 'params' || allParams.startsWith('params:') || allParams.startsWith('params?'));

  if (usesOptionsWrapper || usesParamsWrapper) {
    console.log(`   ℹ️  Step ${stepIndex + 1} ("${step.id}") uses wrapper - inputs will be auto-wrapped`);
    return errors; // Return any format errors but skip param validation
  }

  // For direct parameter functions, validate
  const expectedParamNames = allParams
    ?.split(',')
    .map(p => p.trim().split(/[?:]/)[0].trim())
    .filter(p => p && p !== 'params' && p !== 'options') || [];

  const requiredParamNames = expectedParamNames.filter(name =>
    !allParams.includes(`${name}?`)
  );

  // Check missing params
  const missingParams = requiredParamNames.filter(p => !providedParams.includes(p));
  if (missingParams.length > 0) {
    errors.push(`Step ${stepIndex + 1} ("${step.id}"): Missing parameters: ${missingParams.join(', ')}`);
    errors.push(`   Expected: [${expectedParamNames.join(', ')}]`);
    errors.push(`   Provided: [${providedParams.join(', ')}]`);
    errors.push(`   Signature: ${moduleInfo.signature}`);
  }

  // Check unexpected params
  const unexpectedParams = providedParams.filter(p => !expectedParamNames.includes(p));
  if (unexpectedParams.length > 0) {
    errors.push(`Step ${stepIndex + 1} ("${step.id}"): Unexpected parameters: ${unexpectedParams.join(', ')}`);
    errors.push(`   Expected: [${expectedParamNames.join(', ')}]`);
  }

  return errors;
}

/**
 * Generate filename from name
 */
function generateFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build workflow from plan
 */
async function buildWorkflowFromPlan(planFile: string, autoFix: boolean = true): Promise<void> {
  console.log(`\n🔨 Building workflow from plan: ${planFile}\n`);

  // Auto-fix by default (disable with --no-auto-fix)
  if (autoFix) {
    console.log('🔧 Running auto-fixer...\n');
    try {
      execSync(`npx tsx scripts/auto-fix-workflow-plan.ts --in-place "${planFile}"`, {
        stdio: 'inherit',
      });
      console.log('\n✅ Auto-fix completed\n');
    } catch {
      console.error('\n⚠️  Auto-fix had warnings but continuing...\n');
    }
  }

  // Read and parse plan
  const planPath = resolve(process.cwd(), planFile);
  if (!existsSync(planPath)) {
    throw new Error(`Plan file not found: ${planPath}`);
  }

  const planContent = readFileSync(planPath, 'utf-8');
  const isYaml = planPath.endsWith('.yaml') || planPath.endsWith('.yml');

  let plan: WorkflowPlan;
  try {
    plan = isYaml ? YAML.parse(planContent) : JSON.parse(planContent);
    console.log(`✅ ${isYaml ? 'YAML' : 'JSON'} plan parsed successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse plan: ${message}`);
  }

  // Validate plan
  if (!plan.name || !plan.trigger || !plan.output || !plan.steps) {
    throw new Error('Plan missing required fields: name, trigger, output, steps');
  }

  if (plan.steps.length === 0) {
    throw new Error('Plan must have at least one step');
  }

  console.log(`📝 Plan: ${plan.name}`);
  console.log(`   Trigger: ${plan.trigger}`);
  console.log(`   Output: ${plan.output}`);
  console.log(`   Steps: ${plan.steps.length}\n`);

  // Validate all steps first
  console.log(`🔍 Validating ${plan.steps.length} steps...\n`);
  const allErrors: string[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    const stepErrors = validateStep(plan.steps[i], i);
    if (stepErrors.length > 0) {
      allErrors.push(...stepErrors);
    } else {
      console.log(`   ✅ Step ${i + 1} ("${plan.steps[i].id}") validated`);
    }
  }

  if (allErrors.length > 0) {
    console.error('\n❌ Validation failed:\n');
    allErrors.forEach(err => console.error(`   ${err}`));
    throw new Error('Plan validation failed');
  }

  console.log('\n✅ All steps validated successfully!\n');

  // Build workflow JSON directly
  console.log('📦 Building workflow JSON...\n');

  const filename = generateFilename(plan.name);
  const workflowFile = resolve(process.cwd(), 'workflow', `${filename}.json`);

  // Create directory if needed
  const dir = dirname(workflowFile);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true});
  }

  // Check if file exists
  if (existsSync(workflowFile)) {
    throw new Error(`Workflow file already exists: ${workflowFile}\n   Delete it first or choose a different name`);
  }

  // Build trigger config based on type
  const triggerConfig: Record<string, unknown> = {};
  if (plan.trigger === 'cron') {
    // Add placeholder schedule for cron triggers (user configures in UI)
    triggerConfig.schedule = '0 * * * *'; // Default: every hour
  } else if (plan.trigger === 'chat' || plan.trigger === 'chat-input') {
    // Add required inputVariable for chat triggers
    triggerConfig.inputVariable = 'userInput';
  }

  const workflow: WorkflowExport = {
    version: '1.0',
    name: plan.name,
    description: plan.description || `Workflow: ${plan.name}`,
    trigger: {
      type: plan.trigger,
      config: triggerConfig,
    },
    config: {
      timeout: plan.timeout || 300000,
      retries: plan.retries || 0,
      returnValue: plan.returnValue,
      steps: plan.steps.map(step => {
        // Default inputs to empty object if not provided
        const inputsWithDefaults = step.inputs || {};

        // Check if module uses wrapper (options/params)
        const moduleInfo = findModuleInRegistry(step.module);
        const allParams = moduleInfo?.signature.match(/\(([^)]*)\)/)?.[1] || '';
        const usesOptionsWrapper = (allParams === 'options' || allParams.startsWith('options:') || allParams.startsWith('options?'));
        const usesParamsWrapper = (allParams === 'params' || allParams.startsWith('params:') || allParams.startsWith('params?'));

        // Auto-wrap inputs if module uses options/params wrapper
        let finalInputs = inputsWithDefaults;
        if (usesOptionsWrapper) {
          finalInputs = { options: inputsWithDefaults };
        } else if (usesParamsWrapper) {
          finalInputs = { params: inputsWithDefaults };
        }

        return {
          id: step.id,
          ...(step.name && { name: step.name }),
          module: step.module,
          inputs: finalInputs,
          ...(step.outputAs && { outputAs: step.outputAs }),
        };
      }),
      outputDisplay: {
        type: plan.output,
        ...(plan.output === 'table' && plan.outputColumns && {
          columns: plan.outputColumns.map(col => ({
            key: col,
            label: col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' '),
          })),
        }),
      },
    },
    ...(plan.category || plan.tags ? {
      metadata: {
        ...(plan.category && { category: plan.category }),
        ...(plan.tags && { tags: plan.tags }),
      },
    } : {}),
  };

  // Auto-set returnValue if not specified and last step has outputAs
  if (!workflow.config.returnValue) {
    const lastStep = plan.steps[plan.steps.length - 1];
    if (lastStep.outputAs) {
      workflow.config.returnValue = `{{${lastStep.outputAs}}}`;
      console.log(`   ℹ️  Auto-set returnValue to: {{${lastStep.outputAs}}}`);
    }
  }

  // Write workflow file
  writeFileSync(workflowFile, JSON.stringify(workflow, null, 2), 'utf-8');
  console.log(`✅ Workflow JSON created: ${workflowFile}\n`);

  // Validate with official validator
  console.log('🔍 Running workflow validator...\n');
  try {
    execSync(`npx tsx scripts/validate-workflow-new.ts "${workflowFile}"`, {
      stdio: 'inherit',
    });
  } catch {
    throw new Error('Workflow validation failed');
  }

  console.log('\n✅ Workflow validation passed!\n');

  // Optional: Dry-run test (can be disabled with --skip-dry-run)
  const skipDryRun = process.argv.includes('--skip-dry-run');
  if (!skipDryRun) {
    console.log('🧪 Running dry-run test...\n');
    try {
      execSync(`npx tsx scripts/dry-run-workflow.ts "${workflowFile}"`, {
        stdio: 'inherit',
      });
      console.log('\n✅ Dry-run passed!\n');
    } catch {
      console.error('\n⚠️  Dry-run failed! Workflow has runtime issues.');
      console.error('   You can still import with --skip-dry-run flag');
      console.error('   Or fix the issues above first.\n');
      throw new Error('Dry-run test failed');
    }
  }

  // Import to database (can be disabled with --skip-import)
  const skipImport = process.argv.includes('--skip-import');
  if (!skipImport) {
    console.log('📦 Importing to database...\n');
    try {
      execSync(`npx tsx scripts/import-workflow.ts "${workflowFile}"`, {
        stdio: 'inherit',
      });
    } catch {
      throw new Error('Workflow import failed');
    }

    console.log('\n🎉 SUCCESS! Workflow built and imported!\n');
    console.log(`   View at: http://localhost:3123/dashboard/workflows\n`);
  } else {
    console.log('\n✅ Workflow JSON created successfully!\n');
    console.log(`   File: ${workflowFile}\n`);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Build Workflow from Plan - One-command workflow generation

Usage:
  npm run workflow:build <plan-file.yaml>
  npm run workflow:build <plan-file.json>

Flags:
  --no-auto-fix    Disable automatic error fixing (auto-fix runs by default)
  --skip-dry-run   Skip dry-run test
  --skip-import    Skip database import (just create JSON)

Plan Format (YAML):
  name: Workflow Name
  description: Optional description
  trigger: manual | cron | webhook | chat
  output: json | table | text
  steps:
    - module: utilities.math.max
      id: calc-max
      name: Calculate Maximum (optional)
      inputs:
        numbers: "{{data}}"
      outputAs: maxValue (optional)

Example:
  name: Test Math
  trigger: manual
  output: json
  steps:
    - module: utilities.math.max
      id: calc-max
      inputs:
        numbers: "{{data}}"
    - module: utilities.array-utils.sum
      id: calc-sum
      inputs:
        arr: "{{data}}"

Benefits:
  ✅ One YAML file → Complete workflow
  ✅ Auto-fixes common errors (parameter names, module aliases, etc.)
  ✅ All validation automatic
  ✅ Imports to database automatically

Note: Auto-fix runs automatically to correct common mistakes.
      Use --no-auto-fix to disable if needed.
  `);
  process.exit(0);
}

const noAutoFix = args.includes('--no-auto-fix');
const autoFix = !noAutoFix; // Auto-fix enabled by default
const planFile = args.find(arg => !arg.startsWith('--'));

if (!planFile) {
  console.error('Error: No plan file specified');
  process.exit(1);
}

buildWorkflowFromPlan(planFile, autoFix).catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
