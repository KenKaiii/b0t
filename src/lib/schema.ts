import { pgTable, serial, text, timestamp, varchar, integer, index, uniqueIndex, jsonb } from 'drizzle-orm/pg-core';

// ============================================
// AUTHENTICATION TABLES
// ============================================

// User authentication tables for PostgreSQL
export const accountsTable = pgTable('accounts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  account_name: varchar('account_name', { length: 255 }),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (table) => ({
  userIdIdx: index('accounts_user_id_idx').on(table.userId),
  providerIdx: index('accounts_provider_idx').on(table.provider),
  userProviderIdx: index('accounts_user_provider_idx').on(table.userId, table.provider),
  providerAccountIdx: uniqueIndex('accounts_provider_account_idx').on(table.provider, table.providerAccountId),
}));

// OAuth state table for PostgreSQL (temporary storage during OAuth flow)
export const oauthStateTable = pgTable('oauth_state', {
  id: serial('id').primaryKey(),
  state: varchar('state', { length: 255 }).notNull().unique(),
  codeVerifier: text('code_verifier').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('oauth_state_user_id_idx').on(table.userId),
  createdAtIdx: index('oauth_state_created_at_idx').on(table.createdAt),
}));

// Users table for PostgreSQL (multi-user authentication)
export const usersTable = pgTable('users', {
  id: varchar('id', { length: 255 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  emailVerified: integer('email_verified').notNull().default(0),
  locale: varchar('locale', { length: 10 }).default('en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// Invitations table for PostgreSQL (email invitations to organizations)
export const invitationsTable = pgTable('invitations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  invitedBy: varchar('invited_by', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('invitations_token_idx').on(table.token),
  emailIdx: index('invitations_email_idx').on(table.email),
  orgIdx: index('invitations_org_idx').on(table.organizationId),
  expiresAtIdx: index('invitations_expires_at_idx').on(table.expiresAt),
}));

// ============================================
// SYSTEM TABLES
// ============================================

// App settings table for PostgreSQL (stores user preferences and configurations)
export const appSettingsTable = pgTable('app_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  keyIdx: index('app_settings_key_idx').on(table.key),
}));

// Job logs table for PostgreSQL (tracks job execution history)
export const jobLogsTable = pgTable('job_logs', {
  id: serial('id').primaryKey(),
  jobName: varchar('job_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  message: text('message').notNull(),
  details: text('details'),
  duration: integer('duration'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  jobNameIdx: index('job_logs_job_name_idx').on(table.jobName),
  statusIdx: index('job_logs_status_idx').on(table.status),
  createdAtIdx: index('job_logs_created_at_idx').on(table.createdAt),
}));

// ============================================
// MULTI-TENANCY TABLES
// ============================================

// Organizations table for PostgreSQL
export const organizationsTable = pgTable('organizations', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  ownerId: varchar('owner_id', { length: 255 }).notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  settings: text('settings').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  ownerIdIdx: index('organizations_owner_id_idx').on(table.ownerId),
  slugIdx: index('organizations_slug_idx').on(table.slug),
}));

// Organization members table for PostgreSQL
export const organizationMembersTable = pgTable('organization_members', {
  id: varchar('id', { length: 255 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('member'),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index('organization_members_org_id_idx').on(table.organizationId),
  userIdIdx: index('organization_members_user_id_idx').on(table.userId),
  orgUserIdx: index('organization_members_org_user_idx').on(table.organizationId, table.userId),
}));

// ============================================
// WORKFLOW SYSTEM TABLES
// ============================================

// Workflows table for PostgreSQL
export const workflowsTable = pgTable('workflows', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  prompt: text('prompt').notNull(),
  config: text('config').notNull().$type<{
    steps: Array<{
      id: string;
      module: string;
      inputs: Record<string, unknown>;
      outputAs?: string;
    }>;
    returnValue?: string;
    outputDisplay?: {
      type: string;
      columns?: Array<{
        key: string;
        label: string;
        type?: string;
      }>;
    };
  }>(),
  trigger: text('trigger').notNull().$type<{
    type: 'cron' | 'manual' | 'webhook' | 'telegram' | 'discord' | 'chat' | 'chat-input';
    config: Record<string, unknown>;
  }>(),
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastRun: timestamp('last_run'),
  lastRunStatus: varchar('last_run_status', { length: 50 }),
  lastRunError: text('last_run_error'),
  lastRunOutput: jsonb('last_run_output'),
  runCount: integer('run_count').notNull().default(0),
}, (table) => ({
  userIdIdx: index('workflows_user_id_idx').on(table.userId),
  organizationIdIdx: index('workflows_organization_id_idx').on(table.organizationId),
  statusIdx: index('workflows_status_idx').on(table.status),
}));

// Workflow run history table for PostgreSQL
export const workflowRunsTable = pgTable('workflow_runs', {
  id: varchar('id', { length: 255 }).primaryKey(),
  workflowId: varchar('workflow_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerData: text('trigger_data'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  duration: integer('duration'),
  output: text('output'),
  error: text('error'),
  errorStep: varchar('error_step', { length: 255 }),
}, (table) => ({
  workflowIdIdx: index('workflow_runs_workflow_id_idx').on(table.workflowId),
  userIdIdx: index('workflow_runs_user_id_idx').on(table.userId),
  organizationIdIdx: index('workflow_runs_organization_id_idx').on(table.organizationId),
  statusIdx: index('workflow_runs_status_idx').on(table.status),
  startedAtIdx: index('workflow_runs_started_at_idx').on(table.startedAt),
}));

// User credentials table for PostgreSQL (encrypted API keys, tokens, secrets)
export const userCredentialsTable = pgTable('user_credentials', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }),
  platform: varchar('platform', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  metadata: text('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastUsed: timestamp('last_used'),
}, (table) => ({
  userIdIdx: index('user_credentials_user_id_idx').on(table.userId),
  organizationIdIdx: index('user_credentials_organization_id_idx').on(table.organizationId),
  platformIdx: index('user_credentials_platform_idx').on(table.platform),
  userPlatformIdx: index('user_credentials_user_platform_idx').on(table.userId, table.platform),
}));

// ============================================
// WORKFLOW DATA TRACKING TABLES
// ============================================

// Tweet replies tracking table (for reply-to-tweets workflow deduplication)
export const tweetRepliesTable = pgTable('tweet_replies', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }),
  organizationId: varchar('organization_id', { length: 255 }),
  originalTweetId: varchar('original_tweet_id', { length: 255 }).notNull(),
  originalTweetText: text('original_tweet_text').notNull(),
  originalTweetAuthor: varchar('original_tweet_author', { length: 255 }).notNull(),
  originalTweetAuthorName: varchar('original_tweet_author_name', { length: 255 }),
  originalTweetLikes: integer('original_tweet_likes').notNull().default(0),
  originalTweetRetweets: integer('original_tweet_retweets').notNull().default(0),
  originalTweetReplies: integer('original_tweet_replies').notNull().default(0),
  originalTweetViews: integer('original_tweet_views').notNull().default(0),
  ourReplyText: text('our_reply_text').notNull(),
  ourReplyTweetId: varchar('our_reply_tweet_id', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  repliedAt: timestamp('replied_at'),
}, (table) => ({
  originalTweetIdIdx: index('tweet_replies_original_tweet_id_idx').on(table.originalTweetId),
  userIdIdx: index('tweet_replies_user_id_idx').on(table.userId),
  organizationIdIdx: index('tweet_replies_organization_id_idx').on(table.organizationId),
  statusIdx: index('tweet_replies_status_idx').on(table.status),
  createdAtIdx: index('tweet_replies_created_at_idx').on(table.createdAt),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;
export type OAuthState = typeof oauthStateTable.$inferSelect;
export type NewOAuthState = typeof oauthStateTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Invitation = typeof invitationsTable.$inferSelect;
export type NewInvitation = typeof invitationsTable.$inferInsert;
export type AppSetting = typeof appSettingsTable.$inferSelect;
export type NewAppSetting = typeof appSettingsTable.$inferInsert;
export type JobLog = typeof jobLogsTable.$inferSelect;
export type NewJobLog = typeof jobLogsTable.$inferInsert;
export type Organization = typeof organizationsTable.$inferSelect;
export type NewOrganization = typeof organizationsTable.$inferInsert;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;
export type NewOrganizationMember = typeof organizationMembersTable.$inferInsert;
export type Workflow = typeof workflowsTable.$inferSelect;
export type NewWorkflow = typeof workflowsTable.$inferInsert;
export type WorkflowRun = typeof workflowRunsTable.$inferSelect;
export type NewWorkflowRun = typeof workflowRunsTable.$inferInsert;
export type UserCredential = typeof userCredentialsTable.$inferSelect;
export type NewUserCredential = typeof userCredentialsTable.$inferInsert;
export type TweetReply = typeof tweetRepliesTable.$inferSelect;
export type NewTweetReply = typeof tweetRepliesTable.$inferInsert;
