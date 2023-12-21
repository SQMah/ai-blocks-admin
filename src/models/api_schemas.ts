import { z } from "zod";
import {
  trimedNonEmptyString,
  emailSchema,
  setExpriationSchema,
} from "./utlis_schemas";
import {
  UserRole,
  GroupType,
  groupSchema,
  groupTypeSchema,
  moduleSchema,
  userRoleSchema,
  userSchema,
} from "./db_schemas";
// import { GroupType, UserRole } from "@prisma/client";"

// ! not yet modify
export type APIRoute =
  | "users"
  | "groups"
  | "modules"
  | "invitation"
  | "users-by-id"
  | "group-by-name"
  | 'batch-create-users'
  |"user-enrolls"
  |"group-enrolls"
  |"user-manages"
  | "group-manages"
  | "user-modules"
  | "group-modules";

export const createUserInfoSchema = z.object({
  email: emailSchema,
  name: trimedNonEmptyString,
});

const createStudentSubSchema = z.object({
  role: z.literal(UserRole.student),
  expiration_date: setExpriationSchema,
  available_modules: z.array(trimedNonEmptyString).default([]),
  enrolling: z.array(trimedNonEmptyString).default([]),
  managing: z.null().optional(),
});

const createTeacherSubSchema = z.object({
  role: z.literal(UserRole.teacher),
  expiration_date: setExpriationSchema,
  available_modules: z.null().optional(),
  enrolling: z.null().optional(),
  managing: z.array(trimedNonEmptyString).default([]),
});

const createParentSubSchema = z.object({
  role: z.literal(UserRole.parent),
  expiration_date: setExpriationSchema,
  available_modules: z.null().optional(),
  enrolling: z.null().optional(),
  managing: z.array(trimedNonEmptyString).default([]),
});

const createAdminSubSchema = z.object({
  role: z.literal(UserRole.admin),
  expiration_date: z.null().optional(),
  available_modules: z.null().optional(),
  enrolling: z.null().optional(),
  managing: z.null().optional(),
});

const createStudentSchema = createStudentSubSchema
  .merge(createUserInfoSchema)
  .strict();
const createTeacherSchema = createTeacherSubSchema
  .merge(createUserInfoSchema)
  .strict();
const createParentSchema = createParentSubSchema
  .merge(createUserInfoSchema)
  .strict();
const createAdminSchema = createAdminSubSchema
  .merge(createUserInfoSchema)
  .strict();

const createUserSchema = z.discriminatedUnion("role", [
  createAdminSchema,
  createParentSchema,
  createTeacherSchema,
  createStudentSchema,
]);

export type CreateUserPayload = z.infer<typeof createUserSchema>;
export const postUsersReqSchema = createUserSchema;

export const postUsersResSchema = userSchema;

const usersInfoSchema = z.object({ users: z.array(createUserInfoSchema) });

const batchCreateUsersSchema = z.discriminatedUnion("role", [
  createAdminSubSchema.merge(usersInfoSchema).strict(),
  createStudentSubSchema.merge(usersInfoSchema).strict(),
  createTeacherSubSchema.merge(usersInfoSchema).strict(),
  createParentSubSchema.merge(usersInfoSchema).strict(),
]);

export const postBatchCreateUsersReqSchema = batchCreateUsersSchema;
export type BatchCreateUserPaylaod = z.infer<typeof batchCreateUsersSchema>;

export const postBatchCreateUsersResSchema = z.array(userSchema);

export const batchGetUsersReqSchema = z.object({
  email: z
    .array(emailSchema)
    .or(emailSchema)
    .transform((i) => (Array.isArray(i) ? i : [i])),
});

export const batchGetUsersResSchema = z.array(userSchema);

export const batchGetUsersByIdReqSchema = z.object({
  userId: z
    .array(trimedNonEmptyString)
    .or(trimedNonEmptyString)
    .transform((i) => (Array.isArray(i) ? i : [i])),
});

export const batchGetUsersByIdResSchema = z.array(userSchema);

export const getUserReqSchema = z.object({
  email: emailSchema,
});

export const getUserResSchema = userSchema;

export const getUserByIdReqSchema = z.object({
  userId: trimedNonEmptyString,
});

export const getUserByIdResSchema = userSchema;

const userUpdateSchema = z
  .object({
    name: trimedNonEmptyString.optional(),
    expiration_date: setExpriationSchema.optional(),
  })
  .refine((input) => input.expiration_date || input.name, {
    message: "At least one update to be made",});

export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const putUsersReqSchema = z
  .object({
    email: emailSchema,
    update: userUpdateSchema,
  })
  .strict();

export const putUsersResSchema = userSchema;

export const batchPutUsersReqSchema = z
  .object({
    emails: z.array(emailSchema),
    update:z.object({
      expiration_date: setExpriationSchema
    }),
  })
  .strict();

export const batchPutUsersResSchema = z.array(userSchema);

export const deleteUserReqSchema = z.object({
  email: emailSchema,
});

export const deleteUserResSchema = userSchema;

export const deleteUserByIdReqSchema = z.object({
  userId: trimedNonEmptyString,
});

export const deleteUserByIdResSchema = userSchema;

const createGroupSchema = z
  .object({
    group_name: trimedNonEmptyString,
    type: groupTypeSchema,
    manager_emails: z.array(trimedNonEmptyString).default([]),
    student_emails: z.array(trimedNonEmptyString).default([]),
    available_modules: z.array(trimedNonEmptyString).default([]),
    unlocked_modules: z.array(trimedNonEmptyString).default([]),
    capacity: z.number(),
  })
  .strict()
  .refine((input) => input.type === "family" || input.capacity > 0, {
    message: "Capacity must greater than 0",
  });

export type CreateGroupPayload = z.infer<typeof createGroupSchema>;

export const postGroupsReqSchema = createGroupSchema;

export const postGroupsResSchema = groupSchema;

export const batchGetGroupsReqSchema = z.object({
  groupName: z
    .array(trimedNonEmptyString)
    .or(trimedNonEmptyString)
    .transform((i) => (Array.isArray(i) ? i : [i])),
});

export const batchGetGroupsResSchema = z.array(groupSchema);

export const batchGetGroupsByIdReqSchema = z.object({
  group_id: z
    .array(trimedNonEmptyString)
    .or(trimedNonEmptyString)
    .transform((i) => (Array.isArray(i) ? i : [i])),
});

export const batchGetGroupsByIdResSchema = z.array(groupSchema);

export const getGroupReqSchema = z.object({
  group_name: trimedNonEmptyString,
});

export const getGroupResSchema = groupSchema;

export const getGroupByIdReqSchema = z.object({
  group_id: trimedNonEmptyString,
});

export const getGroupByIdResSchema = groupSchema;

const groupUpdateSchema = z
  .object({
    groupName: trimedNonEmptyString.optional(),
    available_modules: z.array(trimedNonEmptyString).optional(),
    capacity: z
      .number()
      .gt(0, { message: "Capacity must greater than 0" })
      .optional(),
  })
  .refine(
    (input) => input.groupName || input.available_modules || input.capacity,
    { message: "At least one update to be made" }
  );

export type GroupUpdatePayload = z.infer<typeof groupUpdateSchema>;

export const putGroupsReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
    update: groupUpdateSchema,
  })
  .strict();

export const putGroupsResSchema = groupSchema;

export const deleteGroupsReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
  })
  .strict();

export const deleteGroupsResSchema = groupSchema;

export const postUserEnrollsReqSchema = z
  .object({
    email: emailSchema,
    group_id: z.array(trimedNonEmptyString),
  })
  .strict();

export const postUserEnrollsResSchema = z.array(groupSchema);

export const putUserEnrollsReqSchema = z
  .object({
    email: emailSchema,
    add: z.array(trimedNonEmptyString).default([]),
    remove: z.array(trimedNonEmptyString).default([]),
  })
  .strict();

//added groups
export const putUserEnrollsResSchema = z.array(groupSchema);

export const getUserEnrollsReqSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const getUserEnrollsResSchema = z.array(groupSchema);

export const deleteUserEnrollsReqSchema = z
  .object({
    email: emailSchema,
    group_id: z
      .array(trimedNonEmptyString)
      .or(trimedNonEmptyString)
      .transform((i) => (Array.isArray(i) ? i : [i])),
  })
  .strict();

export const deleteUserEnrollsResSchema = z.undefined();

export const postGroupEnrollsReqSchema = z
  .object({
    emails: z.array(emailSchema),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postGroupEnrollsResSchema = z.array(userSchema);

export const getGroupEnrollsReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
  })
  .strict();

export const getGroupEnrollsResSchema = z.array(userSchema);

export const putGroupEnrollsReqSchema = z
  .object({
    add: z.array(emailSchema).default([]),
    remove: z.array(emailSchema).default([]),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const putGroupEnrollsResSchema = z.array(userSchema);

export const deleteGroupEnrollsReqSchema = z
  .object({
    email: z
      .array(emailSchema)
      .or(trimedNonEmptyString)
      .transform((i) => (Array.isArray(i) ? i : [i])),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const deleteGroupEnrollsResSchema = z.undefined();

export const postUserManagesReqSchema = z
  .object({
    email: emailSchema,
    group_id: z.array(trimedNonEmptyString),
  })
  .strict();

export const postUserManagesResSchema = z.array(groupSchema);

export const putUserManagesReqSchema = z
  .object({
    email: emailSchema,
    add: z.array(trimedNonEmptyString).default([]),
    remove: z.array(trimedNonEmptyString).default([]),
  })
  .strict();

//added groups
export const putUserManagesResSchema = z.array(groupSchema);

export const getUserManagesReqSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const getUserManagesResSchema = z.array(groupSchema);

export const deleteUserManagesReqSchema = z
  .object({
    email: emailSchema,
    group_id: z.array(trimedNonEmptyString)
    .or(trimedNonEmptyString)
    .transform((i) => (Array.isArray(i) ? i : [i])),
  })
  .strict();

export const deleteUserManagesResSchema = z.undefined();

export const postGroupManagesReqSchema = z
  .object({
    emails: z.array(emailSchema),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postGroupManagesResSchema = z.array(userSchema);

export const getGroupManagesReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
  })
  .strict();

export const getGroupManagesResSchema = z.array(userSchema);

export const putGroupManagesReqSchema = z
  .object({
    add: z.array(emailSchema).default([]),
    remove: z.array(emailSchema).default([]),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const putGroupManagesResSchema = z.array(userSchema);

export const deleteGroupManagesReqSchema = z
  .object({
    emails: z.array(emailSchema)
    .or(trimedNonEmptyString)
    .transform((i) => (Array.isArray(i) ? i : [i])),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const deleteGroupManagesResSchema = z.undefined();

export const createModuleSchema = z
  .object({
    module_name: trimedNonEmptyString,
  })
  .strict();

export type CreateModulePayload = z.infer<typeof createModuleSchema>;

export const postModulesReqSchema = createModuleSchema;

export const postModulesResSchema = moduleSchema;

export const getModulesReqSchema = z
  .object({
    module_id: z
      .array(trimedNonEmptyString)
      .or(trimedNonEmptyString)
      .default([])
      .transform((i) => (Array.isArray(i) ? i : [i])),
  })
  .strict();

export const getModulesResSchema = z.array(moduleSchema);

export const UpdateModuleSchema = z
  .object({
    module_id: trimedNonEmptyString,
    module_name: trimedNonEmptyString,
  })
  .strict();

export type UpdateModulePayload = z.infer<typeof UpdateModuleSchema>;

export const putModulesReqSchema = UpdateModuleSchema;

export const putModulesResSchema = moduleSchema;
export const deleteModulesReqSchema = z
  .object({
    module_id: trimedNonEmptyString,
  })
  .strict();

export const deleteModulesResSchema = moduleSchema;

export const getUserModulesReqSchema = z.object({ email: emailSchema });

export const getUserModulesResSchema = z.array(trimedNonEmptyString);

export const putUserModulesReqSchema = z
  .object({
    email: emailSchema,
    add: z.array(trimedNonEmptyString).optional().default([]),
    remove: z.array(trimedNonEmptyString).optional().default([]),
  })
  .strict();

export const putUserModulesResSchema = z.array(moduleSchema);

//checkpoint
const groupAvailbaleModulesResponseSchema = z.array(
  z.object({
    moduleId: trimedNonEmptyString,
    unlocked: z.boolean(),
    numberOfCompletion: z.number(),
  })
);
export const getGroupModulesReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
  })
  .strict();

export const getGroupModulesResSchema = groupAvailbaleModulesResponseSchema;

export const putGroupModulesReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
    add: z.array(trimedNonEmptyString).default([]),
    remove: z.array(trimedNonEmptyString).default([]),
    lock: z.array(trimedNonEmptyString).default([]),
    unlock: z.array(trimedNonEmptyString).default([]),
  })
  .strict();

export const putGroupModulesResSchema = groupAvailbaleModulesResponseSchema;

//////

export const postInvitationReqSchema = z
  .object({
    email: emailSchema,
  })
  .strict();


//types

export type PostUsersReq = z.infer<typeof postUsersReqSchema>
export type  PostBatchCreateUsersReq = z.infer<typeof postBatchCreateUsersReqSchema>
export type PutUsersReq = z.infer<typeof putUsersReqSchema>
export type DeleteUserByIdReq =z.infer<typeof deleteUserByIdReqSchema>
export type DeleteUserReq =z.infer<typeof deleteUserReqSchema>

export type PutGroupsReq = z.infer<typeof putGroupsReqSchema>

export type GetGroupModulesRes = z.infer<typeof getGroupModulesResSchema>

export type PutGroupModulesReq = z.infer<typeof putGroupModulesReqSchema>

export type PutUserEnrollsReq = z.infer<typeof putUserEnrollsReqSchema>

export type PutUserModulesReq = z.infer<typeof putUserModulesReqSchema>

export type PutUserManagesReq = z.infer<typeof putUserManagesReqSchema>