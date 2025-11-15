---
name: workflow-generator
description: "YOU MUST USE THIS SKILL when the user wants to CREATE or BUILD a NEW workflow automation. Activate for requests like: 'create a workflow', 'build a workflow', 'generate a workflow', 'make a workflow', 'I want to automate', 'automate X to Y', 'schedule a task', 'monitor X and send to Y'. This skill creates workflows from simple YAML plans with automatic validation and import."
---

# Workflow Generator

**Generate complete workflows from simple YAML plans - one command, zero errors.**

## ⚠️ CRITICAL: Use API to Build Workflows

**NEVER manually write workflow JSON!** Create a YAML plan and use the API:

```bash
curl -X POST http://localhost:3123/api/workflows/build-from-plan \
  -H "Content-Type: application/json" \
  -d '{"planPath": "plans/my-workflow.yaml"}'
```

**What the API does automatically (12-layer validation):**
1. ✅ Validates modules exist in registry
2. ✅ Validates parameter names match signatures
3. ✅ Detects unsupported features (rest parameters, function-as-string)
4. ✅ Auto-wraps params/options functions
5. ✅ Builds workflow JSON
6. ✅ Validates schema structure
7. ✅ Validates trigger configuration (cron schedule, chat inputVariable)
8. ✅ Validates returnValue variable exists
9. ✅ Analyzes credential usage
10. ✅ Detects unused variables (dead code)
11. ✅ Runs dry-run test with mocks
12. ✅ Automatically imports to database

**Result: If it builds, it's immediately available in the app. Zero runtime errors.**

---

## Process Overview

```
User Request → Ask Questions → Create YAML Plan → Call API → Done!
                      ↑                                ↑
              Clarify requirements        Automatic build & import via API
```

**3 Simple Steps:**
1. Ask clarifying questions (asking the user directly in chat)
2. Create plans/my-workflow.yaml based on answers (use Write tool)
3. Call API: POST http://localhost:3123/api/workflows/build-from-plan with {"planPath": "plans/my-workflow.yaml"}

**Note:** The API returns the workflow JSON and automatically imports it to the database.

---


## STEP 2: Create Workflow Plan

Based on user answers, create a YAML plan file:

### Plan Format

```yaml
name: Workflow Name
description: Optional workflow description
trigger: manual | cron | webhook | telegram | discord | chat | chat-input
output: json | table | list | text | markdown | image | images | chart
outputColumns: [col1, col2]  # Optional, for table/list output
category: category-name       # Optional
tags: [tag1, tag2]           # Optional
steps:
  - module: category.module.function
    id: unique-step-id
    name: Human Readable Name (optional)
    inputs:
      param1: "{{variable}}"
      param2: value
    outputAs: variableName (optional)
```

### User Answer → Plan Mapping

**Trigger Types (choose one):**
- `manual` - On-demand execution (click Run button)
- `cron` - Scheduled execution (set frequency in UI after import)
- `webhook` - External HTTP trigger
- `telegram` - Telegram bot message trigger
- `discord` - Discord bot message trigger
- `chat` - AI chat conversation trigger
- `chat-input` - Chat with structured input

**Output Types (choose one):**
- `json` - Raw JSON data
- `table` - Structured table with columns
- `list` - List of items
- `text` - Plain text output
- `markdown` - Formatted markdown
- `image` - Single image display
- `images` - Multiple images gallery
- `chart` - Data visualization chart

**Common mappings from user answers:**
- "Manual" → `trigger: manual`
- "Scheduled" → `trigger: cron`
- "JSON" → `output: json`
- "Table" → `output: table`

**AI Model Answer (for AI workflows):**
- "GPT-4o-mini" → Add step with `model: gpt-4o-mini, provider: openai`
- "Claude Haiku" → Add step with `model: claude-haiku-4-5-20251001, provider: anthropic`

**Deduplication Answer (for social workflows):**
- "Yes" → Add storage steps (queryWhereIn, filter, insertRecord)
- "No" → Skip storage steps

### Finding Modules

Search for modules you need:

```bash
curl http://localhost:3123/api/modules/search?q= <keyword> -- --limit 5
```

Use the `path` from search results as the `module` in your plan.

### Available Module Categories

**Utilities (No API Keys Required):**
- `utilities.math` - 20+ operations (add, subtract, multiply, divide, max, min, round, floor, ceil, abs, power, sqrt, etc.)
- `utilities.array-utils` - 30+ operations (first, last, sort, filter, group, pluck, sum, average, unique, flatten, chunk, etc.)
- `utilities.string-utils` - 15+ operations (toSlug, camelCase, pascalCase, truncate, capitalize, stripHtml, isEmail, etc.)
- `utilities.datetime` - 20+ operations (now, format, parse, add/subtract days/hours, comparisons, start/end of day, etc.)
- `utilities.json-transform` - 15+ operations (parse, stringify, get, set, pick, omit, merge, flatten, unflatten, etc.)
- `utilities.csv` - 5+ operations (parse, stringify, csvToJson, jsonToCsv, etc.)
- `utilities.xml` - 10+ operations (parse, build, validate, extract, etc.)
- `utilities.validation` - 5+ operations (validateRequired, validateTypes, validateEmail, validateUrl, etc.)
- `utilities.aggregation` - 7+ operations (median, variance, stdDev, percentile, mode, etc.)
- `utilities.filtering` - 5+ operations (filterByCondition, findByCondition, containsAll, containsAny, etc.)
- `utilities.batching` - 5+ operations (chunk, createBatches, paginate, etc.)
- `utilities.control-flow` - 10+ operations (conditional, switchCase, ifElse, partitionByCondition, tryCatch, retry, sleep, etc.)
- `utilities.javascript` - 7+ operations (execute, filterArray, mapArray, reduceArray, evaluateExpression, etc.)
- `utilities.http` - 5+ operations (httpGet, httpPost, httpPut, httpDelete, httpRequest, etc.)

**AI (Requires API Keys):**
- `ai.ai-sdk` - generateText, chat, streamGeneration, generateJSON, etc.

**Data (Database Access):**
- `data.drizzle-utils` - queryWhereIn, insertRecord, updateRecord, deleteRecord, etc.

**Social Media (Requires Platform Credentials):**
- `social.twitter.*`, `social.reddit.*`, `social.linkedin.*`, etc.

Use `curl http://localhost:3123/api/modules/search?q= <keyword>` to find specific modules.

### Example Plans

**Simple Math Workflow:**
```yaml
name: Test Math Utilities
trigger: manual
output: json
steps:
  - module: utilities.javascript.evaluateExpression
    id: setup-data
    inputs:
      expression: "({numbers: [1, 2, 3, 4, 5]})"
    outputAs: data

  - module: utilities.math.max
    id: calc-max
    inputs:
      numbers: "{{data.numbers}}"
    outputAs: maximum

  - module: utilities.array-utils.sum
    id: calc-sum
    inputs:
      arr: "{{data.numbers}}"
```

**AI Content Generation:**
```yaml
name: Generate Blog Post
trigger: manual
output: text
steps:
  - module: ai.ai-sdk.generateText
    id: generate-content
    inputs:
      prompt: "Write a blog post about {{topic}}"
      model: gpt-4o-mini
      provider: openai
```

**Complex Data Pipeline (Multi-step transformation):**
```yaml
name: Data Processing Pipeline
trigger: manual
output: table
outputColumns: [id, name, category, score]
steps:
  # 1. Generate test data
  - module: utilities.javascript.evaluateExpression
    id: raw-data
    inputs:
      expression: "([{id: 1, name: 'Item A', value: 100, type: 'premium'}, {id: 2, name: 'Item B', value: 50, type: 'basic'}])"
    outputAs: data

  # 2. Filter high-value items
  - module: utilities.filtering.filterArrayByCondition
    id: filter-items
    inputs:
      items: "{{data}}"
      field: value
      operator: ">"
      value: 75
    outputAs: filtered

  # 3. Transform data structure
  - module: utilities.javascript.execute
    id: transform
    inputs:
      code: "return items.map(item => ({id: item.id, name: item.name, category: item.type, score: item.value / 10}))"
      context:
        items: "{{filtered}}"
    outputAs: transformed

  # 4. Sort by score
  - module: utilities.array-utils.sortBy
    id: sort-results
    inputs:
      arr: "{{transformed}}"
      key: score
      order: desc
    outputAs: finalResults
```

**Social Media with Deduplication:**
```yaml
name: Reply to Tweets
trigger: cron
output: table
steps:
  - module: social.twitter.searchTweets
    id: search-tweets
    inputs:
      query: "AI automation"
      maxResults: 10
    outputAs: tweets

  - module: utilities.array-utils.pluck
    id: extract-ids
    inputs:
      arr: "{{tweets}}"
      key: id
    outputAs: tweetIds

  - module: data.drizzle-utils.queryWhereIn
    id: check-replied
    inputs:
      workflowId: "{{workflowId}}"
      tableName: replied_tweets
      column: tweet_id
      values: "{{tweetIds}}"
    outputAs: repliedIds

  - module: utilities.filtering.filterArrayByCondition
    id: filter-new
    inputs:
      items: "{{tweets}}"
      field: id
      operator: not in
      value: "{{repliedIds}}"
    outputAs: newTweets

  - module: ai.ai-sdk.generateText
    id: generate-reply
    inputs:
      prompt: "Write a reply to: {{newTweets[0].text}}"
      model: gpt-4o-mini
      provider: openai
    outputAs: reply

  - module: social.twitter.replyToTweet
    id: post-reply
    inputs:
      tweetId: "{{newTweets[0].id}}"
      text: "{{reply.content}}"

  - module: data.drizzle-utils.insertRecord
    id: store-replied
    inputs:
      workflowId: "{{workflowId}}"
      tableName: replied_tweets
      data:
        tweet_id: "{{newTweets[0].id}}"
      ttl: 2592000
```

---

## STEP 3: Build Workflow

```bash
curl -X POST http://localhost:3123/api/workflows/build-from-plan -H "Content-Type: application/json" -d plans/workflow-plan.yaml
```

**Validation Output Example:**
```
🔍 Validating 5 steps...
   ✅ Step 1 ("setup-data") validated
   ✅ Step 2 ("calc-max") validated
   ... (all steps)
✅ All steps validated successfully!

🔍 Validating trigger configuration...
   ✅ Cron schedule valid: "0 * * * *"

🔍 Validating returnValue...
   ✅ ReturnValue variable "result" is produced by step: final-step

🔍 Analyzing credential usage...
   📋 Credentials used: openai_api_key
   ⚠️  Undocumented credentials: openai_api_key

🔍 Analyzing data flow...
   ⚠️  Unused variables: tempVar

🧪 Running dry-run test...
   Step 1/5: setup-data ✅
   Step 2/5: calc-max ✅
   ... (all steps execute with mocks)
✅ Dry-run completed successfully!

✅ Workflow imported successfully!
🎉 View at: http://localhost:3123/dashboard/workflows
```

**If errors exist:**
```
❌ Step "calc-max": Module "utilities.math.max" uses rest parameters (...) which are not supported
   💡 Use utilities.array-utils.max instead

❌ ReturnValue references "{{nonExistent}}" but no step produces it

❌ Dry-run failed: Step "step2" - Unresolved variable {{undefinedVar}}

Workflow NOT imported - fix errors first
```

---

## Critical Rules

1. **ALWAYS ask questions first** - Use asking the user directly in chat
2. **ALWAYS use workflow:build** - Never manually write JSON
3. **Search for modules** - Use `curl http://localhost:3123/api/modules/search?q=` to find module paths
4. **Create YAML plan** - Simple, readable format
5. **Auto-wrapping works** - Don't wrap params/options manually, script does it
6. **Expect zero errors** - Plan builder validates everything

---

## Common Patterns

### Pattern: Social Media Deduplication

**Steps needed:**
1. Search/fetch items
2. Extract IDs (pluck)
3. Check storage (queryWhereIn)
4. Filter new items
5. Process new items
6. Store IDs (insertRecord with TTL)

### Pattern: AI Content Generation

**Steps needed:**
1. Prepare input data
2. Generate with ai.ai-sdk.generateText
3. Extract content (.content property)
4. Return or post

---

## Advanced Features

### Custom JavaScript Logic

For complex operations that need functions (filter, map, transform), use JavaScript modules:

**Filter array with custom logic:**
```yaml
- module: utilities.javascript.filterArray
  id: filter-items
  inputs:
    items: "{{data}}"
    code: "return item.score > 80"  # Custom condition
```

**Map/transform array:**
```yaml
- module: utilities.javascript.mapArray
  id: transform-items
  inputs:
    items: "{{data}}"
    code: "return { id: item.id, value: item.value * 2 }"
```

**Reduce array:**
```yaml
- module: utilities.javascript.reduceArray
  id: sum-values
  inputs:
    items: "{{data}}"
    initialValue: 0
    code: "return accumulator + item.value"
```

**Any custom logic:**
```yaml
- module: utilities.javascript.execute
  id: custom-logic
  inputs:
    code: "return data.filter(x => x > 5).map(x => x * 2)"
    context:
      data: "{{numbers}}"
```

### ReturnValue (Optional)

The builder auto-sets `returnValue` to the last step's `outputAs`:

```yaml
steps:
  - module: utilities.math.add
    id: final-calc
    outputAs: result  # Auto-set as returnValue
```

**Custom returnValue:**
```yaml
returnValue: "{{customVariable}}"  # Override auto-detection
steps:
  # ...
```

### Trigger Configuration

**Cron triggers** auto-get `schedule: "0 * * * *"` (hourly)
**Chat triggers** auto-get `inputVariable: "userInput"`

Customize in UI after import.

---

## Common Issues & Solutions

### ❌ Rest Parameters (Spread)
**Problem:** Some modules use `...param` (rest parameters) which don't work in workflows
**Example:** `utilities.math.max(...numbers)` expects individual arguments

**Solution:** Use array-utils versions instead
```yaml
# ❌ Wrong - uses rest parameters:
- module: utilities.math.max
  inputs:
    numbers: [1, 2, 3]  # Won't work!

# ✅ Correct - takes array:
- module: utilities.array-utils.max
  inputs:
    arr: [1, 2, 3]
```

**Other affected modules:** `math.min`, `array-utils.intersection`, `array-utils.union`, `json-transform.deepMerge`, `control-flow.coalesce`

### ❌ JavaScript Context
**Problem:** `filterArray/mapArray` only provide `{item, index, items}`, no custom context

**Solution:** Use `javascript.execute` for custom context
```yaml
# ❌ Wrong - context not supported:
- module: utilities.javascript.filterArray
  inputs:
    items: "{{data}}"
    code: "return item > threshold"  # threshold undefined!

# ✅ Correct - use execute with context:
- module: utilities.javascript.execute
  inputs:
    code: "return data.filter(x => x > threshold)"
    context:
      data: "{{data}}"
      threshold: 50
```

### ❌ Table Output Structure
**Problem:** Table output needs array of objects, not complex nested object

**Solution:** Point returnValue to the array
```yaml
# ❌ Wrong:
returnValue: "{{complexObject}}"  # Returns {posts: [...], meta: {...}}

# ✅ Correct:
returnValue: "{{complexObject.posts}}"  # Returns just the array
```

---

## Modules That Use Wrappers (Auto-Wrapped)

**Options wrapper** (inputs wrapped in `options: {...}`):
- All `ai.ai-sdk.*` functions (generateText, chat, etc.)
- All `utilities.javascript.*` functions (execute, filterArray, mapArray, etc.)

**Params wrapper** (inputs wrapped in `params: {...}`):
- All `data.drizzle-utils.*` functions (queryWhereIn, insertRecord, etc.)

**Direct parameters (no wrapper needed):**
- All `utilities.math.*` functions
- All `utilities.array-utils.*` functions
- All `utilities.string-utils.*` functions
- All `utilities.datetime.*` functions
- All `utilities.json-transform.*` functions
- All `utilities.csv.*`, `xml.*`, `validation.*`, etc.

**The builder detects wrapper requirements automatically - just write inputs directly in YAML!**

---

## Tips

- **Module search**: `curl http://localhost:3123/api/modules/search?q= <keyword>` to find module paths
- **Rest parameters**: Use `array-utils.*` versions, not `math.*` for max/min
- **Wrapper modules**: AI SDK, drizzle-utils, JavaScript modules - automatically wrapped
- **JavaScript code**: Use `javascript.execute` for custom context, `filterArray/mapArray` for simple operations
- **Storage**: Always use `{{workflowId}}` in storage operations
- **Variable references**: Use `{{variableName}}` or `{{variableName.property}}`
- **ReturnValue**: Auto-set from last `outputAs`, or specify custom
- **Credentials**: Add to `metadata.requiresCredentials` for documentation
- **Plans directory**: Always save plans in `plans/` directory
- **YAML types**: Use `{}` for objects, `[]` for arrays (not `"{}"` or `"[]"` strings)

---

## Full Example Session

**User**: "Create a workflow to calculate statistics on numbers"

**LLM Action 1**: Ask questions
```typescript
AskUserQuestion({
  questions: [
    { question: "When should this run?", header: "Trigger", ... },
    { question: "Output format?", header: "Output", ... }
  ]
})
```

**User Answers**: "Manual", "JSON"

**LLM Action 2**: Create plan
```yaml
# workflow-plan.yaml
name: Calculate Number Statistics
trigger: manual
output: json
steps:
  - module: utilities.javascript.evaluateExpression
    id: setup-numbers
    inputs:
      expression: "([1, 2, 3, 4, 5, 10, 20, 30])"
    outputAs: numbers

  - module: utilities.math.max
    id: calc-max
    inputs:
      numbers: "{{numbers}}"
    outputAs: maximum

  - module: utilities.math.min
    id: calc-min
    inputs:
      numbers: "{{numbers}}"
    outputAs: minimum

  - module: utilities.array-utils.average
    id: calc-avg
    inputs:
      arr: "{{numbers}}"
    outputAs: average

  - module: utilities.aggregation.median
    id: calc-median
    inputs:
      numbers: "{{numbers}}"
    outputAs: median
```

**LLM Action 3**: Build workflow
```bash
curl -X POST http://localhost:3123/api/workflows/build-from-plan -H "Content-Type: application/json" -d plans/workflow-plan.yaml
```

**Output**:
```
✅ All steps validated
✅ Workflow created and imported!
   View at: http://localhost:3123/dashboard/workflows
```

**LLM Response**: "✅ Workflow 'Calculate Number Statistics' created with 5 steps! All modules validated. Ready to use at http://localhost:3123/dashboard/workflows"

---

## Advantages

✅ **Simple** - One YAML file, one command
✅ **Safe** - All validation automatic
✅ **Fast** - Zero error iterations
✅ **Clear** - YAML is readable
✅ **Smart** - Auto-wraps params/options

**Use workflow:build for all workflow generation!**
