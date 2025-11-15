#!/usr/bin/env tsx
/**
 * Generate Parameter Mappings from Module Registry
 *
 * Automatically discovers parameter name patterns across all modules
 * and generates intelligent mappings for common variations.
 */

import { getModuleRegistry } from '../src/lib/workflows/module-registry';

interface ParamMapping {
  module: string;
  mappings: Record<string, string>;
  reason: string;
}

/**
 * Common parameter name variations that should be mapped
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
 * Parse function signature to extract parameter names
 */
function parseSignature(signature: string): string[] {
  const match = signature.match(/\(([^)]*)\)/);
  if (!match) return [];

  const paramsString = match[1];
  return paramsString
    .split(',')
    .map(p => p.trim())
    .filter(p => p && p !== 'options' && p !== 'params')
    .map(p => {
      // Remove optional marker, type annotations, rest operator
      return p
        .replace(/\.\.\./g, '')
        .replace(/\?/g, '')
        .split(/[:\s]/)[0]
        .trim();
    })
    .filter(p => p);
}

/**
 * Generate parameter mappings for a module
 */
function generateMappingsForModule(
  modulePath: string,
  params: string[]
): ParamMapping | null {
  const mappings: Record<string, string> = {};

  for (const actualParam of params) {
    // Check if this parameter has common variations
    const variations = COMMON_VARIATIONS[actualParam];
    if (variations) {
      for (const variation of variations) {
        mappings[variation] = actualParam;
      }
    }
  }

  if (Object.keys(mappings).length > 0) {
    return {
      module: modulePath,
      mappings,
      reason: `Auto-generated from parameter names: [${params.join(', ')}]`
    };
  }

  return null;
}

/**
 * Generate all parameter mappings
 */
function generateAllMappings() {
  console.log('\n📊 Generating parameter mappings from module registry...\n');

  const registry = getModuleRegistry();
  const allMappings: Record<string, Record<string, string>> = {};
  const stats = {
    totalModules: 0,
    modulesWithMappings: 0,
    totalMappings: 0,
  };

  for (const category of registry) {
    for (const mod of category.modules) {
      for (const fn of mod.functions) {
        stats.totalModules++;

        const modulePath = `${category.name}.${mod.name}.${fn.name}`;
        const params = parseSignature(fn.signature);

        const mapping = generateMappingsForModule(modulePath, params);
        if (mapping) {
          allMappings[modulePath] = mapping.mappings;
          stats.modulesWithMappings++;
          stats.totalMappings += Object.keys(mapping.mappings).length;

          console.log(`✅ ${modulePath}`);
          console.log(`   Params: [${params.join(', ')}]`);
          console.log(`   Mappings: ${Object.entries(mapping.mappings).map(([k, v]) => `${k}→${v}`).join(', ')}`);
          console.log();
        }
      }
    }
  }

  console.log('\n📊 Statistics:');
  console.log(`   Total modules analyzed: ${stats.totalModules}`);
  console.log(`   Modules with mappings: ${stats.modulesWithMappings}`);
  console.log(`   Total parameter mappings: ${stats.totalMappings}`);
  console.log();

  return allMappings;
}

/**
 * Generate TypeScript code for parameter mappings
 */
function generateTypeScriptCode(mappings: Record<string, Record<string, string>>): string {
  const entries = Object.entries(mappings)
    .map(([module, maps]) => {
      const mapEntries = Object.entries(maps)
        .map(([from, to]) => `    '${from}': '${to}',`)
        .join('\n');

      return `  '${module}': {\n${mapEntries}\n  },`;
    })
    .join('\n');

  return `/**
 * Auto-generated parameter mappings
 * Generated on: ${new Date().toISOString()}
 *
 * Maps common parameter name variations to actual module parameter names.
 */
export const PARAMETER_MAPPINGS: Record<string, Record<string, string>> = {
${entries}
};
`;
}

// Main
const mappings = generateAllMappings();

console.log('\n📝 Generated TypeScript code:');
console.log('─'.repeat(80));
console.log(generateTypeScriptCode(mappings));
console.log('─'.repeat(80));

console.log('\n💡 Copy the code above and paste it into:');
console.log('   scripts/auto-fix-workflow-plan.ts');
console.log('   (Replace the existing PARAMETER_MAPPINGS constant)\n');
