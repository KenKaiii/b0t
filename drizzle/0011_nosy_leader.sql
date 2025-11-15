CREATE TABLE "agent_chat_messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_chat_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"organization_id" varchar(255),
	"title" varchar(500),
	"model" varchar(50) DEFAULT 'sonnet' NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_chat_messages_session_id_idx" ON "agent_chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agent_chat_messages_created_at_idx" ON "agent_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_chat_sessions_user_id_idx" ON "agent_chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_chat_sessions_organization_id_idx" ON "agent_chat_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "agent_chat_sessions_created_at_idx" ON "agent_chat_sessions" USING btree ("created_at");