import { pgTable, uniqueIndex, index, pgEnum, text, integer, timestamp, foreignKey, serial, boolean, varchar } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const groupType = pgEnum("GroupType", ['family', 'class'])
export const userRole = pgEnum("UserRole", ['parent', 'admin', 'teacher', 'student'])


export const groups = pgTable("Groups", {
	groupId: text("group_id").primaryKey().notNull(),
	groupName: text("group_name").notNull(),
	type: groupType("type").notNull(),
	capacity: integer("capacity").notNull(),
	studentCount: integer("student_count").notNull(),
	studentLastModifiedTime: timestamp("student_last_modified_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	moduleLastModifiedTime: timestamp("module_last_modified_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
},
(table) => {
	return {
		groupNameKey: uniqueIndex("Groups_group_name_key").on(table.groupName),
		groupNameIdx: index("Groups_group_name_idx").on(table.groupName),
	}
});

export const manages = pgTable("Manages", {
	id: serial("id").primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" } ),
	groupId: text("group_id").notNull().references(() => groups.groupId, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		groupIdIdx: index("Manages_group_id_idx").on(table.groupId),
		userIdIdx: index("Manages_user_id_idx").on(table.userId),
		userIdGroupIdKey: uniqueIndex("Manages_user_id_group_id_key").on(table.userId, table.groupId),
	}
});

export const modules = pgTable("Modules", {
	moduleId: text("module_id").primaryKey().notNull(),
	moduleName: text("module_name").notNull(),
},
(table) => {
	return {
		moduleNameKey: uniqueIndex("Modules_module_name_key").on(table.moduleName),
		moduleNameIdx: index("Modules_module_name_idx").on(table.moduleName),
	}
});

export const userAvailableModules = pgTable("UserAvailableModules", {
	id: serial("id").primaryKey().notNull(),
	moduleId: text("module_id").notNull().references(() => modules.moduleId, { onDelete: "cascade", onUpdate: "cascade" } ),
	userId: text("user_id").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		userIdIdx: index("UserAvailableModules_user_id_idx").on(table.userId),
		moduleIdUserIdKey: uniqueIndex("UserAvailableModules_module_id_user_id_key").on(table.moduleId, table.userId),
		moduleIdIdx: index("UserAvailableModules_module_id_idx").on(table.moduleId),
	}
});

export const userModuleProgress = pgTable("UserModuleProgress", {
	userId: text("user_id").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" } ),
	moduleId: text("module_id").notNull().references(() => modules.moduleId, { onDelete: "cascade", onUpdate: "cascade" } ),
	completed: boolean("completed").default(false).notNull(),
	pagesCompleted: text("pages_completed").array(),
	completedTime: timestamp("completed_time", { withTimezone: true, mode: 'string' }),
	lastModifiedTime: timestamp("last_modified_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	id: serial("id").primaryKey().notNull(),
},
(table) => {
	return {
		moduleIdIdx: index("UserModuleProgress_module_id_idx").on(table.moduleId),
		userIdIdx: index("UserModuleProgress_user_id_idx").on(table.userId),
	}
});

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar("id", { length: 36 }).primaryKey().notNull(),
	checksum: varchar("checksum", { length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text("logs"),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const groupAvailableModules = pgTable("GroupAvailableModules", {
	id: serial("id").primaryKey().notNull(),
	moduleId: text("module_id").notNull().references(() => modules.moduleId, { onDelete: "cascade", onUpdate: "cascade" } ),
	groupId: text("group_id").notNull().references(() => groups.groupId, { onDelete: "cascade", onUpdate: "cascade" } ),
	unlocked: boolean("unlocked").notNull(),
	numberOfCompletion: integer("number_of_completion").default(0).notNull(),
},
(table) => {
	return {
		moduleIdIdx: index("GroupAvailableModules_module_id_idx").on(table.moduleId),
		groupIdIdx: index("GroupAvailableModules_group_id_idx").on(table.groupId),
		moduleIdGroupIdKey: uniqueIndex("GroupAvailableModules_module_id_group_id_key").on(table.moduleId, table.groupId),
	}
});

export const users = pgTable("Users", {
	userId: text("user_id").primaryKey().notNull(),
	email: text("email").notNull(),
	name: text("name").notNull(),
	role: userRole("role").notNull(),
	expirationDate: timestamp("expiration_date", { withTimezone: true, mode: 'string' }),
},
(table) => {
	return {
		emailKey: uniqueIndex("Users_email_key").on(table.email),
		emailIdx: index("Users_email_idx").on(table.email),
	}
});

export const enrolls = pgTable("Enrolls", {
	id: serial("id").primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" } ),
	groupId: text("group_id").notNull().references(() => groups.groupId, { onDelete: "cascade", onUpdate: "cascade" } ),
},
(table) => {
	return {
		groupIdIdx: index("Enrolls_group_id_idx").on(table.groupId),
		userIdIdx: index("Enrolls_user_id_idx").on(table.userId),
		userIdGroupIdKey: uniqueIndex("Enrolls_user_id_group_id_key").on(table.userId, table.groupId),
	}
});

export const groupInvitations = pgTable("GroupInvitations", {
	invitationId: text("invitation_id").primaryKey().notNull(),
	email: text("email").notNull(),
	groupId: text("group_id").notNull().references(() => groups.groupId, { onDelete: "cascade", onUpdate: "cascade" } ),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	paginationKey: serial("pagination_key").notNull(),
},
(table) => {
	return {
		emailIdx: index("GroupInvitations_email_idx").on(table.email),
		emailGroupIdKey: uniqueIndex("GroupInvitations_email_group_id_key").on(table.email, table.groupId),
		groupIdIdx: index("GroupInvitations_group_id_idx").on(table.groupId),
		paginationKeyIdx: index("GroupInvitations_pagination_key_idx").on(table.paginationKey),
	}
});