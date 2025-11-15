import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BUILT_IN_COMMANDS = new Set(['clear', 'compact']);

function parseFrontmatter(content: string): {
  description?: string;
  argumentHint?: string;
  body: string;
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { body: content };
  }

  const [, frontmatter, body] = match;
  const parsed: Record<string, string> = {};

  frontmatter.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const trimmedKey = key.trim().replace(/-/g, '_');
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      parsed[trimmedKey] = value;
    }
  });

  return {
    description: parsed.description,
    argumentHint: parsed.argument_hint,
    body: body.trim(),
  };
}

export function expandSlashCommand(message: string, workingDir: string): string | null {
  const commandMatch = message.match(/^\/([a-z-]+)(\s+(.*))?$/);
  if (!commandMatch) {
    return null;
  }

  const [, commandName, , commandArgs = ''] = commandMatch;

  // Built-in commands pass through to SDK
  if (BUILT_IN_COMMANDS.has(commandName)) {
    console.log(`✨ Built-in command: /${commandName}`);
    return message;
  }

  // Look for custom command file
  const commandFile = join(workingDir, '.claude', 'commands', `${commandName}.md`);

  if (!existsSync(commandFile)) {
    console.warn(`⚠️  Slash command not found: /${commandName}`);
    return null;
  }

  try {
    const commandContent = readFileSync(commandFile, 'utf-8');
    const { body } = parseFrontmatter(commandContent);

    // Replace $ARGUMENTS with actual arguments
    const expandedPrompt = body.replace(/\$ARGUMENTS/g, commandArgs.trim());
    console.log(`📝 Expanded /${commandName} to prompt`);
    return expandedPrompt;
  } catch (error) {
    console.error(`❌ Error expanding /${commandName}:`, error);
    return null;
  }
}
