import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, cpSync, readdirSync, copyFileSync, writeFileSync } from 'fs';

const PROJECT_ROOT = process.cwd();

// Only these commands should be available in agent chat
const ALLOWED_COMMANDS = ['workflow.md', 'new-module.md', 'agent-builder.md'];

/**
 * Get the agent workspace directory (~/Documents/b0t)
 */
export function getAgentWorkspaceDir(): string {
  const homeDir = homedir();
  return join(homeDir, 'Documents', 'b0t');
}

/**
 * Initialize agent workspace by copying necessary folders
 * Copies: scripts/, plans/, .claude/, workflows/
 */
export function initializeAgentWorkspace(): void {
  const workspaceDir = getAgentWorkspaceDir();

  // Ensure workspace directory exists
  if (!existsSync(workspaceDir)) {
    mkdirSync(workspaceDir, { recursive: true });
    console.log(`📁 Created agent workspace: ${workspaceDir}`);
  }

  // Create plans directory with example plans
  const plansDir = join(workspaceDir, 'plans');
  if (!existsSync(plansDir)) {
    mkdirSync(plansDir, { recursive: true });
    const srcPlansDir = join(PROJECT_ROOT, 'plans');
    if (existsSync(srcPlansDir)) {
      try {
        cpSync(srcPlansDir, plansDir, { recursive: true });
        console.log(`📋 Copied example plans to workspace`);
      } catch (error) {
        console.error('Failed to copy plans:', error);
      }
    }
  }

  // Create workflows directory for generated JSON
  const workflowsDir = join(workspaceDir, 'workflows');
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
    console.log(`📁 Created workflows directory in workspace`);
  }

  // Copy only allowed commands from .claude/commands
  const srcCommandsDir = join(PROJECT_ROOT, '.claude', 'commands');
  const destCommandsDir = join(workspaceDir, '.claude', 'commands');

  if (existsSync(srcCommandsDir)) {
    // Ensure destination commands directory exists
    if (!existsSync(destCommandsDir)) {
      mkdirSync(destCommandsDir, { recursive: true });
    }

    // Copy only allowed commands
    for (const cmdFile of ALLOWED_COMMANDS) {
      const srcFile = join(srcCommandsDir, cmdFile);
      const destFile = join(destCommandsDir, cmdFile);

      if (existsSync(srcFile) && !existsSync(destFile)) {
        try {
          copyFileSync(srcFile, destFile);
          console.log(`📋 Copied command: ${cmdFile}`);
        } catch (error) {
          console.error(`Failed to copy ${cmdFile}:`, error);
        }
      }
    }
  }

  // Copy workspace-specific skills (different from main project skills)
  const srcSkillsDir = join(PROJECT_ROOT, '.claude', 'skills-workspace');
  const destSkillsDir = join(workspaceDir, '.claude', 'skills');

  if (existsSync(srcSkillsDir)) {
    const shouldCopy = !existsSync(destSkillsDir) || readdirSync(destSkillsDir).length === 0;

    if (shouldCopy) {
      try {
        cpSync(srcSkillsDir, destSkillsDir, { recursive: true });
        console.log(`📋 Copied workspace skills to agent workspace`);
      } catch (error) {
        console.error('Failed to copy skills:', error);
      }
    }
  }

  // Create README explaining the workspace
  const readmePath = join(workspaceDir, 'README.md');
  if (!existsSync(readmePath)) {
    const readme = `# b0t Agent Workspace

This directory is used by the b0t Build agent.

## Directory Structure

- \`plans/\` - YAML workflow plans (examples and agent-created)
- \`workflows/\` - Generated workflow JSON files (agent creates these)
- \`.claude/commands/\` - Slash commands (/workflow, /new-module, /agent-builder)
- \`.claude/skills/\` - AI agent skills (workflow-generator, workflow-builder, agent-generator)

## How It Works

The agent creates workflow plans (YAML) in the plans/ folder, then uses the b0t API
to build and import them directly to your application. No manual setup required.
`;
    writeFileSync(readmePath, readme);
    console.log(`📝 Created README in workspace`);
  }
}

/**
 * Check if agent workspace is initialized
 */
export function isAgentWorkspaceInitialized(): boolean {
  const workspaceDir = getAgentWorkspaceDir();

  if (!existsSync(workspaceDir)) {
    return false;
  }

  // Check if key folders exist
  const commandsDir = join(workspaceDir, '.claude', 'commands');
  const skillsDir = join(workspaceDir, '.claude', 'skills');

  return existsSync(commandsDir) && existsSync(skillsDir);
}
