import { z } from "zod";
import {
  emailSchema,
  trimedNonEmptyString,
  emptyArray,
  JSONDateSchema
} from "./utlis_schemas";
import { UserRole, GroupType } from "@prisma/client";

const { admin, ...nonAdminRoles } = UserRole;
const canManageRoles = {
  [UserRole.parent]:UserRole.parent,
  [UserRole.teacher]:UserRole.teacher
}


export const userRoleSchema = z.nativeEnum(UserRole);
export const groupTypeSchema = z.nativeEnum(GroupType);
export const allRoles = Object.values(UserRole);
export const allGroupsTypes = Object.values(GroupType);
export const nonAdminSchema = z.nativeEnum(nonAdminRoles);
export const canManageSchema = z.nativeEnum(canManageRoles);

const expirationDateSchema = z.date().or(JSONDateSchema)


const nonAdminInfoSchema = z.object({
  user_id: trimedNonEmptyString,
  email: emailSchema,
  name:trimedNonEmptyString,
  expiration_date: expirationDateSchema,
  available_modules: z.array(trimedNonEmptyString),
});

const adminInfoSchema = z.object({
  user_id: trimedNonEmptyString,
  name:trimedNonEmptyString,
  email: emailSchema,
  expiration_date: z.null().optional(),
  available_modules: z.array(trimedNonEmptyString),
});

const studentBaseSchema = nonAdminInfoSchema.extend({
  role: z.literal(UserRole.student),
});




const teacherBaseSchema = nonAdminInfoSchema.extend({
  role: z.literal(UserRole.teacher),
});

const parentBaseSchema = nonAdminInfoSchema.extend({
  role: z.literal(UserRole.parent),
});

const adminBaseSchema  = adminInfoSchema.extend({
  role: z.literal(UserRole.admin),
});

const userBaseSchema = z.discriminatedUnion("role", [
  studentBaseSchema,teacherBaseSchema,parentBaseSchema,adminBaseSchema
]);

const groupInfoSchema = z.object({
  group_id: trimedNonEmptyString,
  group_name: trimedNonEmptyString,
  type: groupTypeSchema,
  capacity:z.number(),
  available_modules: z.array(trimedNonEmptyString).default([]),
  unlocked_modules:z.array(trimedNonEmptyString).default([]),
});

const classBaseSchema = groupInfoSchema.extend({
  type: z.literal(GroupType.class),
});

const familyBaseSchema = groupInfoSchema.extend({
  type: z.literal(GroupType.family),
});

const studentSchema = studentBaseSchema.extend({
  enrolled: trimedNonEmptyString.optional(),
  managing: emptyArray(trimedNonEmptyString),
  families: z.array(trimedNonEmptyString),
});


const teacherSchema = teacherBaseSchema.extend({
  enrolled: z.null().optional(),
  families: emptyArray(trimedNonEmptyString),
  managing: z.array(trimedNonEmptyString),
});

const parentSchema = parentBaseSchema.extend({
  enrolled: z.null().optional(),
  families: emptyArray(trimedNonEmptyString),
  managing: z.array(trimedNonEmptyString),
});

const adminSchema  = adminBaseSchema.extend({
  enrolled: z.null().optional(),
  families: emptyArray(trimedNonEmptyString),
  managing: emptyArray(trimedNonEmptyString),
});

const classSchema = classBaseSchema.extend({
  students:z.array(trimedNonEmptyString),
  managers:z.array(trimedNonEmptyString),
  children:emptyArray(trimedNonEmptyString)
})

const familySchema = familyBaseSchema.extend({
  students:emptyArray(trimedNonEmptyString),
  managers:z.array(trimedNonEmptyString),
  children:z.array(trimedNonEmptyString)
})

export const moduleSchema = z.object({
  module_name:trimedNonEmptyString,
  module_id:trimedNonEmptyString,
})

export const userSchema = z.discriminatedUnion("role",[studentSchema,teacherSchema,parentSchema,adminSchema])

export const groupSchema = z.discriminatedUnion("type",[classSchema,familySchema])

export type User = z.infer<typeof userSchema>
export type Group = z.infer<typeof groupSchema> 
export type Module = z.infer<typeof moduleSchema>