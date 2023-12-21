-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
DO $$ BEGIN
 CREATE TYPE "GroupType" AS ENUM('class', 'family');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "UserRole" AS ENUM('student', 'teacher', 'admin', 'parent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserAvailableModules" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"finished_at" timestamp with time zone,
	"migration_name" varchar(255) NOT NULL,
	"logs" text,
	"rolled_back_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_steps_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Groups" (
	"group_id" text PRIMARY KEY NOT NULL,
	"group_name" text NOT NULL,
	"type" "GroupType" NOT NULL,
	"capacity" integer NOT NULL,
	"student_count" integer NOT NULL,
	"student_last_modified_time" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"module_last_modified_time" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "GroupAvailableModules" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"group_id" text NOT NULL,
	"unlocked" boolean NOT NULL,
	"number_of_completion" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Modules" (
	"module_id" text PRIMARY KEY NOT NULL,
	"module_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "UserRole" NOT NULL,
	"expiration_date" timestamp(3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Enrolls" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"group_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Manages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"group_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserModuleProgress" (
	"user_id" text NOT NULL,
	"module_id" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"pages_completed" text[] DEFAULT 'RRAY[',
	"completed_time" timestamp(3),
	"last_modified_time" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT UserModuleProgress_pkey PRIMARY KEY("user_id","module_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserAvailableModules_user_id_idx" ON "UserAvailableModules" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserAvailableModules_module_id_user_id_key" ON "UserAvailableModules" ("module_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Groups_group_name_key" ON "Groups" ("group_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Groups_group_name_idx" ON "Groups" ("group_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "GroupAvailableModules_module_id_idx" ON "GroupAvailableModules" ("module_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "GroupAvailableModules_group_id_idx" ON "GroupAvailableModules" ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "GroupAvailableModules_module_id_group_id_key" ON "GroupAvailableModules" ("module_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Modules_module_name_key" ON "Modules" ("module_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Modules_module_name_idx" ON "Modules" ("module_name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Users_email_idx" ON "Users" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Enrolls_user_id_key" ON "Enrolls" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Enrolls_group_id_idx" ON "Enrolls" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Enrolls_id_idx" ON "Enrolls" ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Enrolls_user_id_idx" ON "Enrolls" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Enrolls_user_id_group_id_key" ON "Enrolls" ("user_id","group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Manages_group_id_idx" ON "Manages" ("group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Manages_id_idx" ON "Manages" ("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Manages_user_id_idx" ON "Manages" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Manages_user_id_group_id_key" ON "Manages" ("user_id","group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserModuleProgress_module_id_idx" ON "UserModuleProgress" ("module_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserModuleProgress_user_id_idx" ON "UserModuleProgress" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserAvailableModules" ADD CONSTRAINT "UserAvailableModules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserAvailableModules" ADD CONSTRAINT "UserAvailableModules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "GroupAvailableModules" ADD CONSTRAINT "GroupAvailableModules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "GroupAvailableModules" ADD CONSTRAINT "GroupAvailableModules_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Enrolls" ADD CONSTRAINT "Enrolls_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Enrolls" ADD CONSTRAINT "Enrolls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Manages" ADD CONSTRAINT "Manages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Groups"("group_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Manages" ADD CONSTRAINT "Manages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserModuleProgress" ADD CONSTRAINT "UserModuleProgress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "Modules"("module_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserModuleProgress" ADD CONSTRAINT "UserModuleProgress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Users"("user_id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

*/