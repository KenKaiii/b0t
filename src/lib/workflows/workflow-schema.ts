/**
 * JSON Schema for Workflow Validation
 *
 * Used by both ajv (runtime) and LLMs (for generation guidance)
 */

export const workflowSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['version', 'name', 'description', 'config'],
  properties: {
    version: {
      type: 'string',
      const: '1.0',
      description: 'Schema version for compatibility'
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Workflow name'
    },
    description: {
      type: 'string',
      minLength: 1,
      maxLength: 500,
      description: 'Workflow description'
    },
    trigger: {
      type: 'object',
      required: ['type', 'config'],
      properties: {
        type: {
          type: 'string',
          enum: ['manual', 'cron', 'webhook', 'telegram', 'discord', 'chat', 'chat-input'],
          description: 'Trigger type'
        },
        config: {
          type: 'object',
          description: 'Trigger-specific configuration'
        }
      }
    },
    config: {
      type: 'object',
      required: ['steps'],
      properties: {
        steps: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['id', 'module', 'inputs'],
            properties: {
              id: {
                type: 'string',
                pattern: '^[a-zA-Z0-9_-]+$',
                description: 'Step identifier'
              },
              module: {
                type: 'string',
                pattern: '^[a-z][a-z0-9-]*\\.[a-z][a-z0-9-]*\\.[a-z][a-zA-Z0-9]*$',
                description: 'Module path: category.module.function (function name can be camelCase)'
              },
              inputs: {
                type: 'object',
                description: 'Step inputs'
              },
              outputAs: {
                type: 'string',
                pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
                description: 'Variable name for step output'
              }
            }
          }
        },
        returnValue: {
          type: 'string',
          pattern: '^\\{\\{[^}]+\\}\\}$',
          description: 'Variable to return from workflow'
        },
        outputDisplay: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              enum: ['table', 'list', 'text', 'markdown', 'json', 'image', 'images', 'chart'],
              description: 'Output display format'
            },
            columns: {
              type: 'array',
              description: 'Table columns (required for type=table)',
              items: {
                type: 'object',
                required: ['key', 'label'],
                properties: {
                  key: {
                    type: 'string',
                    description: 'Column data key'
                  },
                  label: {
                    type: 'string',
                    description: 'Column display label'
                  },
                  type: {
                    type: 'string',
                    enum: ['text', 'link', 'date', 'number', 'boolean'],
                    description: 'Column data type'
                  }
                }
              }
            }
          }
        }
      }
    },
    metadata: {
      type: 'object',
      properties: {
        author: {
          type: 'string',
          description: 'Workflow author'
        },
        created: {
          type: 'string',
          format: 'date-time',
          description: 'Creation timestamp'
        },
        tags: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Workflow tags'
        },
        category: {
          type: 'string',
          description: 'Workflow category'
        },
        requiresCredentials: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Required credential providers'
        }
      }
    }
  }
} as const;

/**
 * Chat-input trigger specific schema
 */
export const chatInputTriggerSchema = {
  type: 'object',
  required: ['fields'],
  properties: {
    fields: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'label', 'key', 'type', 'required'],
        properties: {
          id: {
            type: 'string'
          },
          label: {
            type: 'string',
            minLength: 1
          },
          key: {
            type: 'string',
            pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
          },
          type: {
            type: 'string',
            enum: ['text', 'textarea', 'number', 'date', 'select', 'checkbox']
          },
          required: {
            type: 'boolean'
          },
          placeholder: {
            type: 'string'
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'value'],
              properties: {
                label: { type: 'string' },
                value: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
} as const;

/**
 * Cron trigger specific schema
 */
export const cronTriggerSchema = {
  type: 'object',
  required: ['schedule'],
  properties: {
    schedule: {
      type: 'string',
      pattern: '^(\\*|[0-5]?[0-9])\\s+(\\*|[01]?[0-9]|2[0-3])\\s+(\\*|[1-2]?[0-9]|3[01])\\s+(\\*|[1-9]|1[0-2])\\s+(\\*|[0-6])$',
      description: 'Cron schedule expression'
    }
  }
} as const;

/**
 * Chat trigger specific schema
 */
export const chatTriggerSchema = {
  type: 'object',
  required: ['inputVariable'],
  properties: {
    inputVariable: {
      type: 'string',
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
      description: 'Variable name for user input'
    }
  }
} as const;
