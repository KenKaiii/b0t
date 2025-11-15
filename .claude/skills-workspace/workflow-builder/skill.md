---
name: workflow-builder
description: "YOU MUST USE THIS SKILL when the user wants to CREATE or BUILD a NEW workflow automation. Activate for requests like: 'create a workflow', 'build a workflow', 'generate a workflow', 'make a workflow', 'I want to automate', 'automate X to Y', 'schedule a task', 'monitor X and send to Y'. This skill focuses on workflow creation, module discovery, and JSON generation."
---

# Workflow Builder

⚠️ **IMPORTANT: This skill is DEPRECATED. Use workflow-generator skill instead.**

## Use workflow-generator Skill

For ALL workflow creation, use the **workflow-generator** skill which provides:
- ✅ Simple YAML plans (easier than JSON)
- ✅ 12-layer automatic validation
- ✅ Dry-run testing
- ✅ One command: `npm run workflow:build plans/plan.yaml`
- ✅ Zero errors by design

**Invoke the workflow-generator skill for all workflow creation tasks.**

---

## Quick Migration Guide

**Old method (this skill):**
1. Search modules
2. Manually write JSON workflow
3. Run auto-fix
4. Validate
5. Import
(Multiple steps, error-prone)

**New method (workflow-generator skill):**
1. Ask questions
2. Write YAML plan
3. Run `workflow:build`
(One command, zero errors)

---

## Why workflow-generator is Better

| Feature | workflow-builder (OLD) | workflow-generator (NEW) |
|---------|----------------------|--------------------------|
| Format | JSON (complex) | YAML (simple) |
| Validation | 4 layers | 12 layers |
| Dry-run testing | No | Yes |
| Auto-wrapping | Manual | Automatic |
| Rest parameter detection | No | Yes |
| Variable validation | No | Yes |
| Credential analysis | No | Yes |
| Dead code detection | No | Yes |
| Commands needed | 4+ | 1 |
| Error rate | High | Zero |

**Use workflow-generator for all new workflows!**
