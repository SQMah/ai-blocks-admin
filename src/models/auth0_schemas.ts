import * as z from "zod"

export const PossilbeRoles = ["admin","managedStudent","teacher","unmanagedStudent"] as const

export const  UserRoleSchema = z.enum(PossilbeRoles)

export type UserRoleType = z.infer<typeof UserRoleSchema>

export const RoleArraySchema = z.array(UserRoleSchema)

export type RoleArrayType = z.infer<typeof RoleArraySchema>

export const role_to_roleId ={
    "admin":"rol_YHRhJdPKTdNaTEPp",
    "managedStudent":"rol_FLZfpiWTljn9jiOd",
    "teacher":"rol_tEgERFGnK2D82MFC",
    "unmanagedStudent":"rol_IBB3Y72SjYuP3tNP"
}

export const role_to_roleName= {
    "unmanagedStudent":"unmanaged student",
    "managedStudent":"student",
    "admin":"admin",
    "teacher":"teacher"
}

const IdentitySchema = z.object({
  connection: z.string(),
  user_id: z.string(),
  provider: z.string(),
  isSocial: z.boolean(),
});

const UserMetadataSchema = z.object({
  account_expiration_date: z.string().optional(),
  class_ids: z.union([z.array(z.string()), z.string()]).optional(),
});

export type UserMetadataType = z.infer<typeof UserMetadataSchema>

const AppmetadataSchema = z.object({});

export const UserCreateResponseSchema = z.object({
  created_at: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  family_name: z.string(),
  given_name: z.string(),
  identities: z.array(IdentitySchema),
  name: z.string(),
  nickname: z.string(),
  picture: z.string(),
  updated_at: z.string(),
  user_id: z.string(),
  user_metadata: UserMetadataSchema.optional(),
  app_metadata: AppmetadataSchema.optional(),
});

export type UserCreateResponseType = z.infer<typeof UserCreateResponseSchema>

export const UserCreateResponseArrayScehma = z.array(UserCreateResponseSchema)
export type UserCreateResponseArrayType = z.infer<typeof UserCreateResponseArrayScehma>

export const UserSearchResponseSchema = z.object({
  email:z.string(),
  name:z.string(),
  user_id: z.string(),
  user_metadata: UserMetadataSchema.optional(),
  app_metadata: AppmetadataSchema.optional(),
})

export type UserSearchResponseType = z.infer<typeof UserSearchResponseSchema>

export const  UserSearchResponseArraySchema = z.array(UserSearchResponseSchema)
export type UserSearchResponseArrayType =z.infer<typeof UserSearchResponseArraySchema>

export const RoledUserSchema = UserSearchResponseSchema.extend({
  roles:RoleArraySchema ,
});

export type RoledUserType = z.infer<typeof RoledUserSchema>

export const RoledUserArraySchema = z.array(RoledUserSchema)
export type RoledUserArrayType = z.infer<typeof RoledUserArraySchema>

export const UserCreationBodySchema = z.object({
  connection: z.string(),
  email: z.string(),
  password: z.string(),
  verify_email: z.boolean(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  name: z.string(),
  user_metadata: UserMetadataSchema,
  app_metadata: AppmetadataSchema,
});

export type UserCreationBodyType = z.infer<typeof UserCreationBodySchema>

const AssignRoleBodySchema = z.object({
  roles: z.array(z.string()),
});

export type AssignRoleBodyType = z.infer<typeof AssignRoleBodySchema>

export const RoleCheckResponseSchema = z.array(z.object({
  id: z.string(),
  name: UserRoleSchema,
  description: z.string(),
}));








