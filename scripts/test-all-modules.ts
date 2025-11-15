#!/usr/bin/env tsx
/**
 * Test All Modules - Comprehensive Runtime Testing
 *
 * Generates and executes a workflow that tests EVERY module in the registry
 * with realistic runtime execution to verify all fixes work end-to-end.
 *
 * Usage:
 *   npx tsx scripts/test-all-modules.ts [--category=utilities] [--dry-run]
 */

import { getModuleRegistry } from '../src/lib/workflows/module-registry';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

interface TestableModule {
  path: string;
  category: string;
  moduleName: string;
  functionName: string;
  signature: string;
  description: string;
  parameters: string[];
  requiresInputs: boolean;
}

/**
 * Parse function signature to extract parameters
 */
function parseSignature(signature: string): string[] {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match || !match[1]) return [];

  return match[1]
    .split(',')
    .map(p => p.trim().split(/[?:]/)[0].trim())
    .filter(p => p && p !== 'params' && p !== 'options');
}

/**
 * Generate test inputs for a module based on its signature
 */
function generateTestInputs(mod: TestableModule): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Handle wrapper functions - provide realistic inputs that will be auto-wrapped
  if (mod.signature.includes('(options') || mod.signature.includes('(params')) {
    // Provide common wrapper inputs based on module type
    if (mod.path.includes('javascript')) {
      return { code: "1 + 1" };
    }
    if (mod.path.includes('http')) {
      return { url: "https://example.com", method: "GET" };
    }
    // Default wrapper inputs
    return { data: "test-value" };
  }

  // Generate realistic test values based on parameter names
  for (const param of mod.parameters) {
    const lowerParam = param.toLowerCase();

    // Special cases for specific modules
    if (lowerParam === 'code' || lowerParam === 'expression') {
      inputs[param] = "1 + 1"; // JavaScript code
    }
    // Numbers
    else if (lowerParam.includes('num') || lowerParam.includes('value') ||
        lowerParam.includes('count') || lowerParam.includes('amount') ||
        lowerParam.includes('percent') || lowerParam.includes('decimal')) {
      inputs[param] = 42;
    }
    // Arrays
    else if (lowerParam.includes('arr') || lowerParam.includes('array') ||
             lowerParam.includes('numbers') || lowerParam.includes('items')) {
      inputs[param] = [1, 2, 3, 4, 5];
    }
    // Strings
    else if (lowerParam.includes('str') || lowerParam.includes('text') ||
             lowerParam.includes('string') || lowerParam.includes('name') ||
             lowerParam.includes('format')) {
      inputs[param] = "test-string";
    }
    // Dates
    else if (lowerParam.includes('date')) {
      inputs[param] = "{{currentTime}}"; // Reference to datetime.now
    }
    // Booleans
    else if (lowerParam.includes('flag') || lowerParam.includes('is') ||
             lowerParam.includes('has') || lowerParam.includes('condition')) {
      inputs[param] = true;
    }
    // Objects
    else if (lowerParam.includes('obj') || lowerParam.includes('object') ||
             lowerParam.includes('data') || lowerParam.includes('target')) {
      inputs[param] = {"test": "value"};
    }
    // Default to string
    else {
      inputs[param] = "test-value";
    }
  }

  return inputs;
}

/**
 * Get all testable modules from registry
 */
function getAllTestableModules(categoryFilter?: string): TestableModule[] {
  const registry = getModuleRegistry();
  const modules: TestableModule[] = [];

  for (const category of registry) {
    if (categoryFilter && category.name !== categoryFilter) continue;

    for (const mod of category.modules) {
      for (const func of mod.functions) {
        // Skip modules with rest parameters (not supported in workflows)
        if (func.signature.includes('...')) {
          console.log(`   ⏭️  Skipping ${category.name}.${mod.name}.${func.name} (uses rest parameters)`);
          continue;
        }

        const parameters = parseSignature(func.signature);

        modules.push({
          path: `${category.name}.${mod.name}.${func.name}`,
          category: category.name,
          moduleName: mod.name,
          functionName: func.name,
          signature: func.signature,
          description: func.description,
          parameters,
          requiresInputs: parameters.length > 0,
        });
      }
    }
  }

  return modules;
}

/**
 * Generate YAML workflow that tests all modules
 */
function generateTestWorkflow(modules: TestableModule[]): string {
  const steps: string[] = [];

  // Add a few base variables that other steps can reference
  steps.push(`  # Base test data (used by other steps)`);
  steps.push(`  - module: utilities.datetime.now`);
  steps.push(`    id: base-current-time`);
  steps.push(`    outputAs: currentTime`);
  steps.push(``);

  steps.push(`  - module: utilities.datetime.timestamp`);
  steps.push(`    id: base-timestamp`);
  steps.push(`    outputAs: currentTimestamp`);
  steps.push(``);

  // Generate test for each module
  let stepNum = 3;
  for (const mod of modules) {
    const stepId = `test-${stepNum}-${mod.category}-${mod.moduleName}-${mod.functionName}`
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');

    steps.push(`  # Test ${stepNum}: ${mod.path}`);
    steps.push(`  # Signature: ${mod.signature}`);
    steps.push(`  - module: ${mod.path}`);
    steps.push(`    id: ${stepId}`);

    if (mod.requiresInputs || Object.keys(generateTestInputs(mod)).length > 0) {
      const inputs = generateTestInputs(mod);
      steps.push(`    inputs:`);

      for (const [key, value] of Object.entries(inputs)) {
        const valueStr = typeof value === 'string' ?
          (value.startsWith('{{') ? value : `"${value}"`) :
          JSON.stringify(value);
        steps.push(`      ${key}: ${valueStr}`);
      }
    }

    steps.push(`    outputAs: ${stepId.replace(/-/g, '_')}`);
    steps.push(``);

    stepNum++;
  }

  const yaml = `name: Exhaustive Module Test - All ${modules.length} Modules
description: Automatically generated test for all modules in the registry
trigger: manual
output: json

steps:
${steps.join('\n')}`;

  return yaml;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const categoryFilter = args.find(a => a.startsWith('--category='))?.split('=')[1];
  const dryRunOnly = args.includes('--dry-run');

  console.log('\n🧪 Exhaustive Module Testing\n');

  // Get all testable modules
  console.log('📦 Scanning module registry...\n');
  const modules = getAllTestableModules(categoryFilter);

  console.log(`✅ Found ${modules.length} modules to test`);
  if (categoryFilter) {
    console.log(`   Filtered to category: ${categoryFilter}`);
  }

  // Group by category for summary
  const byCategory = modules.reduce((acc, mod) => {
    acc[mod.category] = (acc[mod.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📊 Modules by category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat}: ${count} modules`);
  }

  // Generate workflow
  console.log('\n📝 Generating test workflow...\n');
  const yaml = generateTestWorkflow(modules);
  const yamlPath = resolve(process.cwd(), 'plans', 'exhaustive-module-test.yaml');
  writeFileSync(yamlPath, yaml, 'utf-8');
  console.log(`✅ Workflow written to: ${yamlPath}`);

  // Build and test
  console.log('\n🔨 Building workflow...\n');
  try {
    const skipImport = dryRunOnly ? '--skip-import' : '';
    execSync(
      `npx tsx scripts/build-workflow-from-plan.ts "${yamlPath}" ${skipImport}`,
      { stdio: 'inherit' }
    );

    console.log('\n\n🎉 SUCCESS! All modules tested successfully!\n');
    console.log(`📊 Results:`);
    console.log(`   Total modules: ${modules.length}`);
    console.log(`   Categories: ${Object.keys(byCategory).length}`);
    console.log(`   Status: ✅ All passed\n`);

  } catch {
    console.error('\n\n❌ Testing failed! See errors above.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
