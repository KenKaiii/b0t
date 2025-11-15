#!/usr/bin/env tsx
/**
 * Auto-Fix Workflow Plan
 *
 * Intelligently fixes common workflow plan errors:
 * - Parameter name mismatches (maps to correct names)
 * - Rest parameter issues (converts to array format or suggests alternatives)
 * - Missing required parameters (injects defaults)
 * - Missing API keys (auto-injects credential references)
 * - Module name typos (fuzzy matching & aliases)
 * - Invalid variable references (fixes template syntax)
 *
 * Usage:
 *   npm run workflow:fix <plan-file.yaml>
 *   npm run workflow:fix --in-place <plan-file.yaml>  # Overwrites original
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import YAML from 'yaml';
import { getModuleRegistry } from '../src/lib/workflows/module-registry';

interface WorkflowPlan {
  name: string;
  description?: string;
  trigger: string;
  output: string;
  outputColumns?: string[];
  category?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  returnValue?: string;
  steps: StepPlan[];
}

interface StepPlan {
  module: string;
  id: string;
  name?: string;
  inputs?: Record<string, unknown>;
  outputAs?: string;
}

interface ModuleInfo {
  signature: string;
  parameters: ParameterInfo[];
  usesWrapper: 'options' | 'params' | null;
  usesRestParams: boolean;
}

interface ParameterInfo {
  name: string;
  required: boolean;
  isRest: boolean;
}

interface FixResult {
  fixed: boolean;
  changes: string[];
  warnings: string[];
}

/**
 * Module aliases (from build-workflow-from-plan.ts)
 */
const MODULE_ALIASES: Record<string, string> = {
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
  'utilities.string-utils.camelCase': 'utilities.string-utils.toCamelCase',
  'utilities.string-utils.pascalCase': 'utilities.string-utils.toPascalCase',
  'utilities.string-utils.snakeCase': 'utilities.string-utils.toSnakeCase',
  'utilities.string-utils.kebabCase': 'utilities.string-utils.toKebabCase',
  'utilities.string-utils.slug': 'utilities.string-utils.toSlug',
  'utilities.batching.chunk': 'utilities.array-utils.chunk',
  'utilities.json-transform.stringify': 'utilities.json-transform.stringifyJson',
  'utilities.json-transform.parse': 'utilities.json-transform.parseJson',
  'utilities.json-transform.merge': 'utilities.json-transform.deepMerge',
  'utilities.aggregation.stdDev': 'utilities.aggregation.stdDeviation',
};

/**
 * Common parameter name variations for auto-mapping
 */
const COMMON_VARIATIONS: Record<string, string[]> = {
  // Data/Object variations
  'data': ['obj', 'object', 'value', 'input'],
  'obj': ['object', 'data'],
  'object': ['obj', 'data'],

  // String variations
  'text': ['str', 'string', 'content'],
  'str': ['string', 'text'],
  'string': ['str', 'text'],

  // Number variations
  'value': ['num', 'number', 'val'],
  'num': ['number', 'value'],
  'number': ['num', 'value'],

  // Array variations
  'array': ['arr', 'items', 'list'],
  'arr': ['array', 'items'],
  'items': ['array', 'arr'],

  // Count/Size variations
  'count': ['n', 'num', 'size', 'length', 'limit'],
  'maxLength': ['length', 'max', 'limit'],

  // JSON variations
  'jsonString': ['str', 'string', 'json'],

  // Boolean variations
  'condition': ['cond', 'test', 'predicate'],
  'trueVal': ['trueValue', 'ifTrue'],
  'falseVal': ['falseValue', 'ifFalse'],

  // Key/Field variations
  'key': ['field', 'prop', 'property'],
  'keys': ['fields', 'props', 'properties'],

  // Percent variations
  'percent': ['percentile', 'p'],
};

/**
 * Generate parameter mappings dynamically for a module
 */
function generateParameterMappings(
  expectedParams: string[]
): Record<string, string> {
  const mappings: Record<string, string> = {};

  for (const actualParam of expectedParams) {
    // Check if this parameter has common variations
    const variations = COMMON_VARIATIONS[actualParam];
    if (variations) {
      for (const variation of variations) {
        mappings[variation] = actualParam;
      }
    }
  }

  return mappings;
}

/**
 * Manual parameter mappings for edge cases (rarely needed - most are auto-discovered)
 * Only add here if the auto-discovery doesn't work for a specific case
 */
const MANUAL_PARAMETER_MAPPINGS: Record<string, Record<string, string>> = {
  // Currently empty - auto-discovery handles everything!
  // Add manual overrides here only if absolutely necessary
};

/**
 * Rest parameter alternatives - suggest array-based versions
 */
const REST_PARAM_ALTERNATIVES: Record<string, string> = {
  'utilities.json-transform.deepMerge': 'utilities.javascript.execute (with spread syntax)',
  'utilities.math.max': 'utilities.array-utils.max',
  'utilities.math.min': 'utilities.array-utils.min',
  'utilities.array-utils.intersection': 'utilities.javascript.execute (with spread syntax)',
  'utilities.array-utils.union': 'utilities.javascript.execute (with spread syntax)',
  'utilities.control-flow.coalesce': 'utilities.javascript.execute (with ?? operator)',
};

/**
 * AI SDK credential mapping
 */
const AI_PROVIDER_CREDENTIALS: Record<string, string> = {
  'openai': 'openai_api_key',
  'anthropic': 'anthropic_api_key',
  'google': 'google_api_key',
  'groq': 'groq_api_key',
};

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
 * Parse module signature to extract parameter info
 */
function parseModuleSignature(signature: string): ModuleInfo {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) {
    return {
      signature,
      parameters: [],
      usesWrapper: null,
      usesRestParams: false,
    };
  }

  const paramsString = match[1];

  // Check for wrapper patterns
  const usesOptions = paramsString === 'options' || paramsString.startsWith('options:') || paramsString.startsWith('options?');
  const usesParams = paramsString === 'params' || paramsString.startsWith('params:') || paramsString.startsWith('params?');

  const usesWrapper = usesOptions ? 'options' : usesParams ? 'params' : null;

  // Parse parameters
  const parameters: ParameterInfo[] = [];
  let usesRestParams = false;

  const paramParts = paramsString.split(',').map(p => p.trim()).filter(p => p);

  for (const part of paramParts) {
    const isRest = part.startsWith('...');
    if (isRest) usesRestParams = true;

    const cleanPart = part.replace('...', '');
    const required = !cleanPart.includes('?');
    const name = cleanPart.split(/[?:]/)[0].trim();

    if (name && name !== 'options' && name !== 'params') {
      parameters.push({ name, required, isRest });
    }
  }

  return {
    signature,
    parameters,
    usesWrapper,
    usesRestParams,
  };
}

/**
 * Auto-fix a step
 */
function autoFixStep(step: StepPlan): FixResult {
  const changes: string[] = [];
  const warnings: string[] = [];
  let fixed = false;

  // 1. Fix module aliases
  const originalModule = step.module;
  const resolvedModule = MODULE_ALIASES[step.module] || step.module;

  if (resolvedModule !== originalModule) {
    step.module = resolvedModule;
    changes.push(`Resolved module alias: "${originalModule}" → "${resolvedModule}"`);
    fixed = true;
  }

  // 2. Check module exists
  const moduleInfo = findModuleInRegistry(step.module);
  if (!moduleInfo) {
    warnings.push(`Module not found: "${step.module}" - Try fuzzy search or check spelling`);
    return { fixed, changes, warnings };
  }

  const parsedModule = parseModuleSignature(moduleInfo.signature);

  // 3. Handle rest parameters
  if (parsedModule.usesRestParams) {
    const alternative = REST_PARAM_ALTERNATIVES[step.module];
    if (alternative) {
      warnings.push(
        `Module "${step.module}" uses rest parameters (...args) which aren't fully supported`,
        `  Suggested alternative: ${alternative}`,
        `  Or use utilities.javascript.execute with spread syntax`
      );
    } else {
      warnings.push(
        `Module "${step.module}" uses rest parameters (...args) which may not work in workflows`,
        `  Consider using utilities.javascript.execute as a workaround`
      );
    }
  }

  // 4. Skip parameter fixing for wrapper modules (auto-wrapped later)
  if (parsedModule.usesWrapper) {
    // Special handling for AI SDK modules - ensure apiKey is present
    if (step.module.startsWith('ai.ai-sdk.')) {
      const inputs = step.inputs || {};
      const provider = inputs.provider as string;

      if (provider && !inputs.apiKey) {
        const credentialName = AI_PROVIDER_CREDENTIALS[provider];
        if (credentialName) {
          inputs.apiKey = `{{credential.${credentialName}}}`;
          step.inputs = inputs;
          changes.push(`Auto-injected API key: {{credential.${credentialName}}}`);
          fixed = true;
        }
      }
    }
    return { fixed, changes, warnings };
  }

  // 5. Fix parameter names
  const inputs = step.inputs || {};
  const expectedParams = parsedModule.parameters.map(p => p.name);
  const requiredParams = parsedModule.parameters.filter(p => p.required).map(p => p.name);

  // Generate parameter mappings dynamically based on expected parameters
  const autoMappings = generateParameterMappings(expectedParams);
  const manualMappings = MANUAL_PARAMETER_MAPPINGS[step.module] || {};
  const paramMappings = { ...autoMappings, ...manualMappings }; // Manual overrides auto

  const fixedInputs: Record<string, unknown> = {};
  const mappedParams: string[] = [];

  // Map incorrect parameter names to correct ones
  for (const [providedName, value] of Object.entries(inputs)) {
    // First, check if parameter is already correct (don't rename correct params!)
    if (expectedParams.includes(providedName)) {
      // Already correct - keep it
      fixedInputs[providedName] = value;
    }
    // Then check if this is a known incorrect name that needs mapping
    else if (paramMappings[providedName]) {
      const correctName = paramMappings[providedName];
      // Only set if not already present (avoid duplicates)
      if (!fixedInputs[correctName]) {
        fixedInputs[correctName] = value;
        mappedParams.push(`"${providedName}" → "${correctName}"`);
        fixed = true;
      }
    }
    // Finally, try fuzzy matching for typos
    else {
      const closestMatch = findClosestMatch(providedName, expectedParams);
      if (closestMatch && levenshteinDistance(providedName, closestMatch) <= 2) {
        // Only set if not already present (avoid duplicates)
        if (!fixedInputs[closestMatch]) {
          fixedInputs[closestMatch] = value;
          mappedParams.push(`"${providedName}" → "${closestMatch}" (fuzzy match)`);
          fixed = true;
        }
      } else {
        // Keep as-is, will fail validation
        fixedInputs[providedName] = value;
        warnings.push(`Unknown parameter: "${providedName}" - Expected: [${expectedParams.join(', ')}]`);
      }
    }
  }

  if (mappedParams.length > 0) {
    changes.push(`Fixed parameter names: ${mappedParams.join(', ')}`);
  }

  // 6. Add missing required parameters with placeholders
  const currentParams = Object.keys(fixedInputs);
  const missingRequired = requiredParams.filter(p => !currentParams.includes(p));

  if (missingRequired.length > 0) {
    for (const param of missingRequired) {
      fixedInputs[param] = `{{FIXME_${param}}}`;
      changes.push(`Added missing required parameter: "${param}" (placeholder added)`);
      fixed = true;
    }
    warnings.push(`Missing required parameters filled with placeholders - replace {{FIXME_*}} values`);
  }

  step.inputs = fixedInputs;

  return { fixed, changes, warnings };
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find closest matching string
 */
function findClosestMatch(target: string, options: string[]): string | null {
  if (options.length === 0) return null;

  let closest = options[0];
  let minDistance = levenshteinDistance(target, closest);

  for (const option of options.slice(1)) {
    const distance = levenshteinDistance(target, option);
    if (distance < minDistance) {
      minDistance = distance;
      closest = option;
    }
  }

  return closest;
}

/**
 * Auto-fix workflow plan
 */
async function autoFixWorkflowPlan(planFile: string, inPlace: boolean): Promise<void> {
  console.log(`\n🔧 Auto-fixing workflow plan: ${planFile}\n`);

  // Read and parse plan
  const planPath = resolve(process.cwd(), planFile);
  const planContent = readFileSync(planPath, 'utf-8');
  const isYaml = planPath.endsWith('.yaml') || planPath.endsWith('.yml');

  let plan: WorkflowPlan;
  try {
    plan = isYaml ? YAML.parse(planContent) : JSON.parse(planContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse plan: ${message}`);
  }

  console.log(`📝 Plan: ${plan.name}`);
  console.log(`   Steps: ${plan.steps.length}\n`);

  // Auto-fix all steps
  let totalChanges = 0;
  let totalWarnings = 0;

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    console.log(`🔍 Step ${i + 1} ("${step.id}"): ${step.module}`);

    const result = autoFixStep(step);

    if (result.changes.length > 0) {
      console.log(`   ✅ Fixed:`);
      result.changes.forEach(change => console.log(`      - ${change}`));
      totalChanges += result.changes.length;
    } else {
      console.log(`   ✓ No changes needed`);
    }

    if (result.warnings.length > 0) {
      console.log(`   ⚠️  Warnings:`);
      result.warnings.forEach(warning => console.log(`      - ${warning}`));
      totalWarnings += result.warnings.length;
    }

    console.log();
  }

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Total changes: ${totalChanges}`);
  console.log(`   Total warnings: ${totalWarnings}\n`);

  if (totalChanges === 0 && totalWarnings === 0) {
    console.log('✅ Plan looks good - no fixes needed!\n');
    return;
  }

  // Write fixed plan
  const outputContent = isYaml
    ? YAML.stringify(plan, { lineWidth: 0 })
    : JSON.stringify(plan, null, 2);

  if (inPlace) {
    writeFileSync(planPath, outputContent, 'utf-8');
    console.log(`✅ Fixed plan written to: ${planPath}\n`);
  } else {
    const outputPath = planPath.replace(/\.(yaml|yml|json)$/, '.fixed.$1');
    writeFileSync(outputPath, outputContent, 'utf-8');
    console.log(`✅ Fixed plan written to: ${outputPath}\n`);
    console.log(`   Review changes and use --in-place to overwrite original\n`);
  }

  if (totalWarnings > 0) {
    console.log(`⚠️  ${totalWarnings} warnings need manual review before building\n`);
  }
}

// Main
const args = process.argv.slice(2);
const inPlace = args.includes('--in-place');
const planFile = args.find(arg => !arg.startsWith('--'));

if (!planFile || args.includes('--help') || args.includes('-h')) {
  console.log(`
Auto-Fix Workflow Plan - Intelligently fixes common workflow errors

Usage:
  npm run workflow:fix <plan-file.yaml>
  npm run workflow:fix --in-place <plan-file.yaml>

What it fixes:
  ✅ Parameter name mismatches (obj → data, str → jsonString, etc.)
  ✅ Module name aliases (format → formatDate, merge → deepMerge, etc.)
  ✅ Missing required parameters (adds placeholders)
  ✅ Missing AI API keys (auto-injects credential references)
  ✅ Fuzzy parameter matching (similiar → similar, etc.)

What it warns about:
  ⚠️  Rest parameter modules (suggests alternatives)
  ⚠️  Unknown modules (check spelling)
  ⚠️  Unrecognized parameters (manual review needed)

Flags:
  --in-place    Overwrite original file instead of creating .fixed version
  --help        Show this help message

Example:
  npm run workflow:fix plans/my-workflow.yaml
  # Creates: plans/my-workflow.fixed.yaml

  npm run workflow:fix --in-place plans/my-workflow.yaml
  # Overwrites: plans/my-workflow.yaml
  `);
  process.exit(0);
}

autoFixWorkflowPlan(planFile, inPlace).catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
