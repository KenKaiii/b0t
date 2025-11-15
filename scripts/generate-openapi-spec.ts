#!/usr/bin/env tsx
/**
 * Generate OpenAPI Specification from Module Registry
 *
 * Creates an OpenAPI 3.0 spec that describes all workflow modules as API operations.
 * This allows LLMs (like Claude) to understand modules using the standard OpenAPI format.
 *
 * Usage:
 *   npx tsx scripts/generate-openapi-spec.ts
 *   npx tsx scripts/generate-openapi-spec.ts --output openapi.json
 */

import { writeFile } from 'fs/promises';
import { resolve } from 'path';
import { getModuleRegistry } from '../src/lib/workflows/module-registry';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
  };
}

/**
 * Parse function signature to extract parameters
 */
function parseSignature(signature: string): Array<{ name: string; required: boolean; type: string }> {
  const params: Array<{ name: string; required: boolean; type: string }> = [];

  // Extract parameter section: functionName(params...) => params...
  const match = signature.match(/\(([^)]*)\)/);
  if (!match || !match[1]) return params;

  const paramStr = match[1].trim();
  if (!paramStr) return params;

  // Handle object destructuring: { param1, param2, param3? }
  if (paramStr.startsWith('{')) {
    const paramMatch = paramStr.match(/\{\s*([^}]+)\s*\}/);
    if (paramMatch) {
      const paramList = paramMatch[1].split(',').map(p => p.trim());
      paramList.forEach(param => {
        const required = !param.endsWith('?');
        const name = param.replace('?', '').trim();
        params.push({ name, required, type: 'string' });
      });
    }
  } else {
    // Handle regular parameters: param1, param2?, param3
    const paramList = paramStr.split(',').map(p => p.trim());
    paramList.forEach(param => {
      const required = !param.includes('?');
      const name = param.split(/[?:]/)[0].trim();
      params.push({ name, required, type: 'any' });
    });
  }

  return params;
}

/**
 * Generate OpenAPI spec from module registry
 */
function generateOpenAPISpec(): OpenAPISpec {
  const registry = getModuleRegistry();

  const spec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'b0t Workflow Modules API',
      description: 'API specification for all workflow automation modules in b0t platform. Use these modules to build workflows.',
      version: '1.0.0'
    },
    servers: [
      {
        url: 'http://localhost:3123',
        description: 'Local development server'
      }
    ],
    paths: {},
    components: {
      schemas: {
        WorkflowStep: {
          type: 'object',
          required: ['id', 'module', 'inputs'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique step identifier'
            },
            module: {
              type: 'string',
              description: 'Module path: category.module.function'
            },
            inputs: {
              type: 'object',
              description: 'Step input parameters'
            },
            outputAs: {
              type: 'string',
              description: 'Variable name to store step output'
            }
          }
        }
      }
    }
  };

  // Generate paths for each module function
  registry.forEach((category) => {
    category.modules.forEach((module) => {
      module.functions.forEach((fn) => {
        const modulePath = `${category.name}.${module.name}.${fn.name}`;
        const pathKey = `/modules/${category.name}/${module.name}/${fn.name}`;

        // Parse parameters from signature
        const params = parseSignature(fn.signature);

        // Build request body schema
        const properties: Record<string, { type: string; description?: string }> = {};
        const required: string[] = [];

        params.forEach((param) => {
          properties[param.name] = {
            type: param.type === 'any' ? 'string' : param.type,
            description: `Parameter: ${param.name}`
          };
          if (param.required) {
            required.push(param.name);
          }
        });

        // Add to paths
        spec.paths[pathKey] = {
          post: {
            summary: fn.name,
            description: fn.description,
            operationId: modulePath.replace(/\./g, '_'),
            tags: [category.name],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties,
                    required: required.length > 0 ? required : undefined
                  }
                }
              }
            },
            responses: {
              '200': {
                description: 'Successful execution',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        output: { type: 'object' }
                      }
                    }
                  }
                }
              },
              '400': {
                description: 'Invalid input parameters'
              },
              '500': {
                description: 'Execution error'
              }
            }
          }
        };

        // Add schema definition for this function
        spec.components.schemas[modulePath.replace(/\./g, '_')] = {
          type: 'object',
          description: `${fn.description}\n\nSignature: ${fn.signature}`,
          properties,
          required: required.length > 0 ? required : undefined
        };
      });
    });
  });

  return spec;
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const outputFile = args.find((arg, i) => args[i - 1] === '--output') || 'openapi.json';

  console.log('🔍 Scanning module registry...\n');

  const spec = generateOpenAPISpec();

  const pathCount = Object.keys(spec.paths).length;
  const schemaCount = Object.keys(spec.components.schemas).length - 1; // -1 for WorkflowStep

  console.log('📊 OpenAPI Specification:');
  console.log(`   Operations: ${pathCount}`);
  console.log(`   Schemas: ${schemaCount}`);
  console.log('');

  const outputPath = resolve(process.cwd(), outputFile);
  await writeFile(outputPath, JSON.stringify(spec, null, 2), 'utf-8');

  console.log(`✅ OpenAPI spec generated: ${outputFile}\n`);
  console.log('💡 Use this spec with:');
  console.log('   • Claude\'s "Tools" feature for native module understanding');
  console.log('   • Swagger UI: npx @redocly/cli preview-docs openapi.json');
  console.log('   • API clients: Generate SDKs for any language');
  console.log('');

  // Print summary by category
  const registry = getModuleRegistry();
  console.log('📦 Categories:');
  registry.forEach((category) => {
    const funcCount = category.modules.reduce((sum, m) => sum + m.functions.length, 0);
    console.log(`   ${category.name}: ${category.modules.length} modules, ${funcCount} functions`);
  });
}

main().catch(console.error);
