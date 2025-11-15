#!/usr/bin/env tsx
/**
 * Import Workflow Script
 *
 * Imports a workflow JSON file into the database via the API.
 * Makes workflow creation from CLI/scripts much easier.
 *
 * Usage:
 *   npx tsx scripts/import-workflow.ts <workflow-file.json>
 *   npx tsx scripts/import-workflow.ts --stdin < workflow.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { type WorkflowExport } from '../src/lib/workflows/import-export';

const API_URL = process.env.API_URL || 'http://localhost:3123';

async function importWorkflow(workflowJson: string): Promise<void> {
  try {
    // Validate JSON
    const workflow = JSON.parse(workflowJson) as WorkflowExport;

    console.log(`📦 Importing workflow: ${workflow.name}`);
    console.log(`📝 Description: ${workflow.description}`);
    console.log(`🔧 Steps: ${workflow.config.steps.length}`);

    if (workflow.metadata?.requiresCredentials?.length) {
      console.log(`🔑 Required credentials: ${workflow.metadata.requiresCredentials.join(', ')}`);
    }

    // Import via API (use test endpoint in development for no-auth import)
    const importEndpoint = process.env.NODE_ENV === 'production'
      ? `${API_URL}/api/workflows/import`
      : `${API_URL}/api/workflows/import-test`;

    const response = await fetch(importEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowJson }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Import failed:', error.error);
      if (error.details) {
        console.error('   Details:', error.details);
      }
      process.exit(1);
    }

    const result = await response.json();
    console.log('\n✅ Workflow imported successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Name: ${result.name}`);
    console.log(`\n🌐 View at: ${API_URL}/dashboard/workflows`);

    if (result.requiredCredentials?.length) {
      console.log(`\n⚠️  Configure credentials for: ${result.requiredCredentials.join(', ')}`);
      console.log(`   Go to: ${API_URL}/settings/credentials`);
    }
  } catch (error) {
    console.error('❌ Failed to import workflow:', error);
    process.exit(1);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage:
  npx tsx scripts/import-workflow.ts <workflow-file.json>
  npx tsx scripts/import-workflow.ts --stdin < workflow.json

Options:
  --stdin    Read workflow JSON from stdin
  --help     Show this help message

Environment:
  API_URL    API base URL (default: http://localhost:3123)
  `);
  process.exit(0);
}

let workflowJson: string;

if (args[0] === '--stdin') {
  // Read from stdin
  const chunks: Buffer[] = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => {
    workflowJson = Buffer.concat(chunks).toString('utf-8');
    importWorkflow(workflowJson);
  });
} else {
  // Read from file
  const filePath = resolve(process.cwd(), args[0]);
  try {
    workflowJson = readFileSync(filePath, 'utf-8');
    importWorkflow(workflowJson);
  } catch (error) {
    console.error(`❌ Failed to read file: ${filePath}`);
    console.error(error);
    process.exit(1);
  }
}
