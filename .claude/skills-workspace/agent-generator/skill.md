---
name: agent-generator
description: "YOU MUST USE THIS SKILL when the user wants to create an AI agent workflow. Activate for requests like: 'create an agent', 'build an AI agent', 'make a chat agent', 'agent that can...', 'AI that does...', 'conversational workflow'. This skill creates workflows with AI agents that can use tools, have conversations, and perform complex multi-step reasoning."
---

# AI Agent Workflow Generator

**Create AI agent workflows using simple YAML plans - one command, fully validated.**

## ⚠️ CRITICAL: Use workflow:build

Create a YAML plan and use:

```bash
npm run workflow:build plans/agent-plan.yaml
```

**All validation automatic - same as regular workflows!**

---

## When to Use This Skill

Use when the user wants AI agents that can:
- Have conversations (chat workflows)
- Use tools autonomously (web search, calculations, API calls)
- Perform multi-step reasoning
- Access 1282+ available tools across 140+ modules

---

## AI Agent Plan Format

```yaml
name: Agent Name
description: What the agent does
trigger: chat | chat-input | manual
output: markdown | text | json
steps:
  - module: ai.ai-agent.runAgent
    id: agent-step
    inputs:
      prompt: "{{trigger.userMessage}}"
      model: gpt-4o-mini | claude-haiku-4-5-20251001
      maxSteps: 10
      temperature: 0.7
      systemPrompt: "You are a helpful assistant..."
      toolOptions:
        useAll: true
    outputAs: response
```

**Key differences from regular workflows:**
- Trigger usually `chat` for conversational agents
- Output usually `markdown` or `text`
- ReturnValue should access `.text` property: `{{response.text}}`
- NO apiKey needed (auto-injected based on model)

---

## Available Agent Modules

**Primary:**
- `ai.ai-agent.runAgent` - Standard agent (non-streaming)
- `ai.ai-agent-stream.streamAgent` - Streaming agent with real-time updates

**Convenience Functions:**
- `ai.ai-agent.runWebAgent` - Pre-configured for web research
- `ai.ai-agent.runCreativeAgent` - Pre-configured for creative tasks
- `ai.ai-agent.runCommunicationAgent` - Pre-configured for messaging

---

## Agent Parameters

**Required:**
- `prompt` - The user's input/request

**Optional (with smart defaults):**
- `model` - Default: `claude-haiku-4-5-20251001` (cheapest)
  - Recommended: `gpt-4o-mini` or `claude-haiku-4-5-20251001`
- `maxSteps` - Default: 10, Range: 1-50
- `temperature` - Default: 0.7, Range: 0-2
- `systemPrompt` - Defines agent behavior
- `toolOptions` - Configure which tools agent can use

**Tool Options:**

Give agent ALL tools:
```yaml
toolOptions:
  useAll: true
```

Filter by category:
```yaml
toolOptions:
  categories: [web, utilities, communication]
```

Specific tools:
```yaml
toolOptions:
  tools: [fetchWebPage, getCurrentDateTime, calculate]
```

---

## Example Plans

### Simple Chat Agent

```yaml
name: General AI Assistant
description: Chat with AI that can use tools
trigger: chat
output: markdown
steps:
  - module: ai.ai-agent.runAgent
    id: chat
    inputs:
      prompt: "{{trigger.userMessage}}"
      model: gpt-4o-mini
      maxSteps: 10
      systemPrompt: "You are a helpful AI assistant. Use tools when needed."
      toolOptions:
        useAll: true
    outputAs: response
```

### Web Research Agent

```yaml
name: Research Assistant
description: AI agent specialized in web research
trigger: chat
output: markdown
steps:
  - module: ai.ai-agent.runAgent
    id: research
    inputs:
      prompt: "{{trigger.userMessage}}"
      model: claude-haiku-4-5-20251001
      maxSteps: 15
      systemPrompt: "You are a research assistant. Search the web, analyze information, and provide comprehensive answers with sources."
      toolOptions:
        categories: [web, utilities]
    outputAs: research
```

### Agent with Data Processing

```yaml
name: Data Analysis Agent
description: Fetch data and analyze with AI
trigger: manual
output: markdown
steps:
  - module: utilities.http.httpGet
    id: fetch-data
    inputs:
      url: "https://api.example.com/data"
    outputAs: apiData

  - module: ai.ai-agent.runAgent
    id: analyze
    inputs:
      prompt: "Analyze this data: {{apiData.data}}"
      model: gpt-4o-mini
      temperature: 0.3
      systemPrompt: "You are a data analyst. Analyze the data and provide insights."
      toolOptions:
        categories: [utilities]
    outputAs: analysis
```

### Multi-Step Research Agent

```yaml
name: Research and Summarize
description: Research topic then create summary
trigger: chat-input
output: markdown
steps:
  - module: ai.ai-agent.runAgent
    id: research
    inputs:
      prompt: "Research this topic thoroughly: {{trigger.topic}}"
      model: claude-haiku-4-5-20251001
      maxSteps: 20
      systemPrompt: "You are a researcher. Use web search to gather comprehensive information."
      toolOptions:
        useAll: true
    outputAs: researchResults

  - module: ai.ai-sdk.generateText
    id: summarize
    inputs:
      prompt: "Create a concise summary:\n{{researchResults.text}}"
      model: gpt-4o-mini
      maxTokens: 500
    outputAs: summary
```

---

## Building Agent Workflows

**Same process as regular workflows:**

1. Create YAML plan in `plans/` directory
2. Run: `npm run workflow:build plans/agent-plan.yaml`
3. Done!

**All 12 validation layers apply:**
- ✅ Module validation
- ✅ Parameter validation
- ✅ Auto-wrapping (options wrapper automatic)
- ✅ Trigger validation
- ✅ ReturnValue validation
- ✅ Credential analysis
- ✅ Dry-run testing
- ✅ Everything validated before import

---

## Common Agent Issues

### ❌ Including API Key
```yaml
# ❌ Wrong - don't include apiKey:
inputs:
  prompt: "..."
  model: gpt-4o-mini
  apiKey: "{{credential.openai_api_key}}"  # Remove this!
```

**Fix:** Remove apiKey - it's auto-injected based on model name

### ❌ Wrong ReturnValue
```yaml
# ❌ Wrong:
returnValue: "{{response}}"  # Returns whole object

# ✅ Correct:
returnValue: "{{response.text}}"  # Returns just the text
```

### ❌ Missing Chat Trigger Config
```yaml
# ❌ Wrong:
trigger: chat

# ✅ Correct (auto-added by builder):
trigger: chat
# Builder adds: config.inputVariable = "userMessage"
```

---

## Tips

- **No apiKey needed** - Auto-injected based on model
- **Use .text for returnValue** - `{{response.text}}` not `{{response}}`
- **Chat triggers** - Auto-configured with inputVariable
- **Tool selection** - Start with `useAll: true`
- **System prompts** - Define role and when to use tools
- **Temperature** - 0.7 is good default
- **maxSteps** - 10-15 for most tasks

---

## Model Selection Guide

**Cheap & Fast (Recommended):**
- `gpt-4o-mini` - OpenAI, fast, cost-effective
- `claude-haiku-4-5-20251001` - Anthropic, cheapest

**Better Quality:**
- `claude-sonnet-4-5-20250929` - Best balance of quality/cost

**Choose based on:**
- Budget: Use Haiku or gpt-4o-mini
- Quality needs: Use Sonnet for complex reasoning
- Speed: All cheap models are fast

---

## Complete Example

```yaml
# plans/universal-assistant.yaml
name: Universal AI Assistant
description: General purpose AI with full tool access
trigger: chat
output: markdown
category: ai-agents
tags: [chat, ai, tools]
steps:
  - module: ai.ai-agent.runAgent
    id: agent
    inputs:
      prompt: "{{trigger.userMessage}}"
      model: gpt-4o-mini
      maxSteps: 15
      temperature: 0.7
      systemPrompt: |
        You are a helpful AI assistant with access to various tools.
        Use tools when needed to provide accurate, up-to-date information.
        Be concise but thorough in your responses.
      toolOptions:
        useAll: true
    outputAs: agentResponse
```

**Build it:**
```bash
npm run workflow:build plans/universal-assistant.yaml
```

**Result:**
- ✅ All validations pass
- ✅ Dry-run succeeds
- ✅ Imported to database
- ✅ Ready to use!

**Use workflow:build for all agent creation - simple, validated, perfect!**
