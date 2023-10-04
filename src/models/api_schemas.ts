import { z } from "zod";
import {
  trimedNonEmptyString,
  emailSchema,
  setExpriationSchema,
} from "./utlis_schemas";
import {
  groupSchema,
  groupTypeSchema,
  moduleSchema,
  userRoleSchema,
  userSchema,
} from "./db_schemas";
import { GroupType, UserRole } from "@prisma/client";

export type APIRoute =
  | "users"
  | "groups"
  | "modules"
  | "invitation"
  | "batch-create-users"
  | "batch-manages"
  | "batch-enrolls"
  | "batch-families"
  | "users-by-id"
  | "group-by-name"
  | "enrolls"
  | "families"
  | "manages"
  | "students-available-modules"
  | "classes-available-modules";

export const createUserInfoSchema = z.object({
  email: emailSchema,
  name: trimedNonEmptyString,
});

const createStudentSubSchema = z.object({
  role: z.literal(UserRole.student),
  expiration_date: setExpriationSchema,
  available_modules: z.array(trimedNonEmptyString).default([]),
  enrolled: trimedNonEmptyString.optional(),
  managing: z.null().optional(),
  families: z.array(trimedNonEmptyString).default([]),
});

const createTeacherSubSchema = z.object({
  role: z.literal(UserRole.teacher),
  expiration_date: setExpriationSchema,
  available_modules: z.null().optional(),
  enrolled: z.null().optional(),
  managing: z.array(trimedNonEmptyString).default([]),
  families: z.null().optional(),
});

const createParentSubSchema = z.object({
  role: z.literal(UserRole.parent),
  expiration_date: setExpriationSchema,
  available_modules: z.null().optional(),
  enrolled: z.null().optional(),
  managing: z.array(trimedNonEmptyString).default([]),
  families: z.null().optional(),
});

const createAdminSubSchema = z.object({
  role: z.literal(UserRole.admin),
  expiration_date: z.null().optional(),
  available_modules: z.null().optional(),
  enrolled: z.null().optional(),
  managing: z.null().optional(),
  families: z.null().optional(),
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

export const postBatchCreateUsersResSchema = z.array(userSchema);

export const getUsersReqSchema = z
  .object({
    email: emailSchema,
    roles: userRoleSchema
      .or(z.array(userRoleSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional(),
  })
  .strict();

export const getUsersResSchema = userSchema;

export const batchGetUsersReqSchema = z
  .object({
    email: emailSchema
      .or(z.array(emailSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional()
      .default([]),
    user_id: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional()
      .default([]),
    roles: userRoleSchema
      .or(z.array(userRoleSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional(),
    exact: z
      .string()
      .transform((s) => (s.toLocaleLowerCase() === "false" ? false : true))
      .default("true"),
  })
  .strict();

export const batchGetUsersResSchema = z.array(userSchema);

export const putUsersReqSchema = z
  .object({
    email: emailSchema,
    name: trimedNonEmptyString.optional(),
    expiration_date: setExpriationSchema.optional(),
  })
  .strict();

export const putUsersResSchema = userSchema;

export const batchPutUsersReqSchema = z
  .object({
    emails: emailSchema
      .or(z.array(emailSchema))
      .transform((input) => (Array.isArray(input) ? input : [input])),
    // name: trimedNonEmptyString.optional(),
    expiration_date: setExpriationSchema.optional(),
  })
  .strict();

export const batchPutUsersResSchema = z.array(userSchema);

export const deleteUserReqSchema = z.object({ email: emailSchema }).strict();

const createGroupBaseSchema = z
  .object({
    group_name: trimedNonEmptyString,
    manager_emails: z.array(trimedNonEmptyString).default([]),
  })
  .strict();

const createClassSchema = createGroupBaseSchema
  .extend({
    type: z.literal(GroupType.class),
    available_modules: z.array(trimedNonEmptyString).default([]),
    unlocked_modules: z.array(trimedNonEmptyString).default([]),
    student_emails: z.array(trimedNonEmptyString).default([]),
    children_emails: z.null().optional(),
    capacity: z.number().gt(0, { message: "Capacity must greater than 0" }),
  })
  .strict();

const createFamilySchema = createGroupBaseSchema
  .extend({
    type: z.literal(GroupType.family),
    student_emails: z.null().optional(),
    children_emails: z.array(trimedNonEmptyString).default([]),
    capacity: z.null().optional(),
    available_modules: z.null().optional(),
    unlocked_modules: z.null().optional(),
  })
  .strict();

const createGroupSchema = z.discriminatedUnion("type", [
  createClassSchema,
  createFamilySchema,
]);

export const postGroupsReqSchema = createGroupSchema;

export const postGroupsResSchema = groupSchema;

export const getGroupsReqSechema = z
  .object({
    group_id: trimedNonEmptyString,
    type: groupTypeSchema
      .or(z.array(groupTypeSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional(),
  })
  .strict();

export const getGroupsResSechema = groupSchema;

export const batchGetGroupsReqSchema = z
  .object({
    group_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional()
      .default([]),
    type: groupTypeSchema
      .or(z.array(groupTypeSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional(),
    exact: z
      .string()
      .transform((s) => (s.toLocaleLowerCase() === "false" ? false : true))
      .default("true"),
  })
  .strict();

export const batchGetGroupsResSchema = z.array(groupSchema);

export const putGroupsReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
    group_name: trimedNonEmptyString.optional(),
    available_modules: z.array(trimedNonEmptyString).optional(),
    capacity: z
      .number()
      .gt(0, { message: "Capacity must greater than 0" })
      .optional(),
  })
  .strict();

export const putGroupsResSchema = groupSchema;

export const deleteGroupsSchema = z
  .object({
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postEnrollsReqSchema = z
  .object({
    email: emailSchema,
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postEnrollsResSchema = userSchema;

export const putEnrollsReqSchema = z
  .object({
    email: emailSchema,
    group_id: trimedNonEmptyString,
  })
  .strict();

export const putEnrollsResSchema = userSchema;

export const deleteEnrollsReqSchema = z
  .object({
    email: emailSchema,
    group_id: trimedNonEmptyString,
  })
  .strict();

export const deleteEnrollsResSchema = userSchema;

export const postManagesReqSchema = z
  .object({
    email: emailSchema,
    group_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
  })
  .strict();

export const postManagesResSchema = userSchema;

export const putManagesReqSchema = z
  .object({
    email: emailSchema,
    toAdd: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
    toRemove: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
  })
  .strict();

export const putManagesResSchema = userSchema;

export const deleteManagesReqSchema = z
  .object({
    email: emailSchema,
    group_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
  })
  .strict();

export const deleteManagesResSchema = userSchema;

export const postFamiliesReqSchema = z
  .object({
    email: emailSchema,
    group_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
  })
  .strict();

export const postFamiliesResSchema = userSchema;

export const putFamiliesReqSchema = z
  .object({
    email: emailSchema,
    toAdd: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
    toRemove: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
  })
  .strict();

export const putFamiliesResSchema = userSchema;

export const deleteFamiliesReqSchema = z
  .object({
    email: emailSchema,
    group_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
  })
  .strict();

export const deleteFamiliesResSchema = userSchema;

export const postModulesReqSchema = z
  .object({
    module_name: trimedNonEmptyString,
  })
  .strict();

export const postModulesResSchema = moduleSchema;

export const getModulesReqSchema = z
  .object({
    module_id: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional()
      .default([]),
    exact: z
      .string()
      .transform((s) => (s.toLocaleLowerCase() === "false" ? false : true))
      .default("true"),
  })
  .strict();

export const getModulesResSchema = z.array(moduleSchema);

export const putModulesReqSchema = z
  .object({
    module_id: trimedNonEmptyString,
    module_name: trimedNonEmptyString,
  })
  .strict();

export const putModulesResSchema = moduleSchema;
export const deleteModulesReqSchema = z
  .object({
    module_id: trimedNonEmptyString,
  })
  .strict();

export const deleteModulesResSchema = moduleSchema;

export const postStudentModulesReqSchema = z
  .object({
    module_ids: z.array(trimedNonEmptyString),
    email: emailSchema,
  })
  .strict();

export const postStudentModulesResSchema = userSchema;

export const putStudentModulesReqSchema = z
  .object({
    email: emailSchema,
    toAdd: z.array(trimedNonEmptyString).optional().default([]),
    toRemove: z.array(trimedNonEmptyString).optional().default([]),
  })
  .strict();

export const putStudentModulesResSchema = userSchema;

export const deleteStudentModulesReqSchema = z
  .object({
    module_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
    email: emailSchema,
  })
  .strict();

export const deleteStudentModulesResSchema = userSchema;

export const postClassesModulesReqSchema = z
  .object({
    module_ids: z.array(trimedNonEmptyString),
    unlocked_ids: z.array(trimedNonEmptyString).optional().default([]),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postClassesModulesResSchema = groupSchema;

export const putClassesModulesReqSchema = z
  .object({
    group_id: trimedNonEmptyString,
    toAdd: z.array(trimedNonEmptyString).optional().default([]),
    toRemove: z.array(trimedNonEmptyString).optional().default([]),
    toLock: z.array(trimedNonEmptyString).optional().default([]),
    toUnlock: z.array(trimedNonEmptyString).optional().default([]),
  })
  .strict();

export const putClassesModulesResSchema = groupSchema;

export const deleteClassesModulesReqSchema = z
  .object({
    module_ids: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input])),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const deleteClassesModulesResSchema = groupSchema;

export const getUsersByIdReqSchema = z
  .object({
    user_id: trimedNonEmptyString
      .or(z.array(trimedNonEmptyString))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional()
      .default([]),
    roles: userRoleSchema
      .or(z.array(userRoleSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional(),
    exact: z
      .string()
      .transform((s) => (s.toLocaleLowerCase() === "false" ? false : true))
      .default("true"),
  })
  .strict();

export const getUsersByIdResSchema = z.array(userSchema);

export const getGroupByNameReqSchema = z
  .object({
    group_name: trimedNonEmptyString,
    type: groupTypeSchema
      .or(z.array(groupTypeSchema))
      .transform((input) => (Array.isArray(input) ? input : [input]))
      .optional(),
  })
  .strict();

export const getGroupByNameResSchema = groupSchema;

export const postBatchManagesReqSchema = z
  .object({
    emails: z.array(emailSchema),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postBatchManagesResSchema = groupSchema;

export const postBatchEnrollsReqSchema = z
  .object({
    emails: z.array(emailSchema),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postBatchEnrollsResSchema = groupSchema;

export const postBatchFamiliesReqSchema = z
  .object({
    emails: z.array(emailSchema),
    group_id: trimedNonEmptyString,
  })
  .strict();

export const postBatchFamiliesResSchema = groupSchema;

export const postInvitationReqSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type PostUsersReq = z.infer<typeof postUsersReqSchema>;
export type PostUsersRes = z.infer<typeof postUsersResSchema>;
export type PostBatchCreateUsersReq = z.infer<
  typeof postBatchCreateUsersReqSchema
>;
export type PostBatchCreateUsersRes = z.infer<
  typeof postBatchCreateUsersResSchema
>;
export type GetUsersReq = z.infer<typeof getUsersReqSchema>;
export type GetUsersRes = z.infer<typeof getUsersResSchema>;
export type BatchGetUsersReq = z.infer<typeof batchGetUsersReqSchema>;
export type BatchGetUsersRes = z.infer<typeof batchGetUsersResSchema>;
export type PutUsersReq = z.infer<typeof putUsersReqSchema>;
export type PutUsersRes = z.infer<typeof putUsersResSchema>;
export type BatchPutUsersReq = z.infer<typeof batchPutUsersReqSchema>;
export type BatchPutUsersRes = z.infer<typeof batchPutUsersResSchema>;
export type DeleteUserReq = z.infer<typeof deleteUserReqSchema>;
export type PostGroupsReq = z.infer<typeof postGroupsReqSchema>;
export type PostGroupsRes = z.infer<typeof postGroupsResSchema>;
export type GetGroupsReq = z.infer<typeof getGroupsReqSechema>;
export type GetGroupsRes = z.infer<typeof getGroupsResSechema>;
export type BatchGetGroupsReq = z.infer<typeof batchGetGroupsReqSchema>;
export type BatchGetGroupsRes = z.infer<typeof batchGetGroupsResSchema>;
export type PutGroupsReq = z.infer<typeof putGroupsReqSchema>;
export type PutGroupsRes = z.infer<typeof putGroupsResSchema>;
export type DeleteGroupsReq = z.infer<typeof deleteGroupsSchema>;
export type PostEnrollsReq = z.infer<typeof postEnrollsReqSchema>;
export type PostEnrollsRes = z.infer<typeof postEnrollsResSchema>;
export type PutEnrollsReq = z.infer<typeof putEnrollsReqSchema>;
export type PutEnrollsRes = z.infer<typeof putEnrollsResSchema>;
export type DeleteEnrollsReq = z.infer<typeof deleteEnrollsReqSchema>;
export type DeleteEnrollsRes = z.infer<typeof deleteEnrollsResSchema>;
export type PostManagesReq = z.infer<typeof postManagesReqSchema>;
export type PostManagesRes = z.infer<typeof postManagesResSchema>;
export type PutManagesReq = z.infer<typeof putManagesReqSchema>;
export type PutManagesRes = z.infer<typeof putManagesResSchema>;
export type DeleteManagesReq = z.infer<typeof deleteManagesReqSchema>;
export type DeleteManagesRes = z.infer<typeof deleteManagesResSchema>;
export type PostFamiliesReq = z.infer<typeof postFamiliesReqSchema>;
export type PostFamiliesRes = z.infer<typeof postFamiliesResSchema>;
export type PutFamiliesReq = z.infer<typeof putFamiliesReqSchema>;
export type PutFamiliesRes = z.infer<typeof putFamiliesResSchema>;
export type DeleteFamiliesReq = z.infer<typeof deleteFamiliesReqSchema>;
export type DeleteFamiliesRes = z.infer<typeof deleteFamiliesResSchema>;
export type PostModulesReq = z.infer<typeof postModulesReqSchema>;
export type PostModulesRes = z.infer<typeof postModulesResSchema>;
export type GetModulesReq = z.infer<typeof getModulesReqSchema>;
export type GetModulesRes = z.infer<typeof getModulesResSchema>;
export type PutModulesReq = z.infer<typeof putModulesReqSchema>;
export type PutModulesRes = z.infer<typeof putModulesResSchema>;
export type DeleteModulesReq = z.infer<typeof deleteModulesReqSchema>;
export type DeleteModulesRes = z.infer<typeof deleteModulesResSchema>;
export type PostStudentModulesReq = z.infer<typeof postStudentModulesReqSchema>;
export type PostStudentModulesRes = z.infer<typeof postStudentModulesResSchema>;
export type PutStudentModulesReq = z.infer<typeof putStudentModulesReqSchema>;
export type PutStudentModulesRes = z.infer<typeof putStudentModulesResSchema>;
export type DeleteStudentModulesReq = z.infer<
  typeof deleteStudentModulesReqSchema
>;
export type DeleteStudentModulesRes = z.infer<
  typeof deleteStudentModulesResSchema
>;
export type PostClassesModulesReq = z.infer<typeof postClassesModulesReqSchema>;
export type PostClassesModulesRes = z.infer<typeof postClassesModulesResSchema>;
export type PutClassesModulesReq = z.infer<typeof putClassesModulesReqSchema>;
export type PutClassesModulesRes = z.infer<typeof putClassesModulesResSchema>;
export type DeleteClassesModulesReq = z.infer<
  typeof deleteClassesModulesReqSchema
>;
export type DeleteClassesModulesRes = z.infer<
  typeof deleteClassesModulesResSchema
>;
export type GetUsersByIdReq = z.infer<typeof getUsersByIdReqSchema>;
export type GetUsersByIdRes = z.infer<typeof getUsersByIdResSchema>;
export type GetGroupBynameReq = z.infer<typeof getGroupByNameReqSchema>;
export type GetGroupBynameRes = z.infer<typeof getGroupByNameResSchema>;

export type PostBatchManagesReq = z.infer<typeof postBatchManagesReqSchema>;
export type PostBatchManagesRes = z.infer<typeof postBatchManagesResSchema>;
export type PostBatchEnrollsReq = z.infer<typeof postBatchEnrollsReqSchema>;
export type PostBatchEnrollsRes = z.infer<typeof postBatchEnrollsResSchema>;
export type PostBatchFamiliesReq = z.infer<typeof postBatchFamiliesReqSchema>;
export type PostBatchFamiliesRes = z.infer<typeof postBatchFamiliesResSchema>;

export type PostInvitationReq = z.infer<typeof postInvitationReqSchema>;
