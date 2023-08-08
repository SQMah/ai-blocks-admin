import {z} from "zod"
import { validDateString } from "@/lib/utils"

export const defaultModules:string[] = ["Module A","Module B", "Module C"]
export const modulesReady:string[] = defaultModules.concat(["Module D","Module E"])

export const PossilbeRoles = ["admin","managedStudent","teacher","unmanagedStudent"] as const
export const  UserRoleSchema = z.enum(PossilbeRoles)
export type UserRoleType = z.infer<typeof UserRoleSchema>

export const RoleArraySchema = z.array(UserRoleSchema)


export type RoleArrayType = UserRoleType[]

export const roleMapping:Record<UserRoleType,{
  name:string
  id:string
}> = {
  admin: {
    name: "admin",
    id: "rol_dhBIdUmGdNR52dha",
  },
  managedStudent: {
    name: "student",
    id: "rol_sscS5jlEm9eNoQhh",
  },
  teacher: {
    name: "teacher",
    id: "rol_2TX6jO3b0TbA1z7y",
  },
  unmanagedStudent: {
    name: "unmanaged student",
    id: "rol_JHWVsaPKEqqHno00",
  },
} as const;



const IdentitySchema = z.object({
  connection: z.string(),
  user_id: z.string(),
  provider: z.string(),
  isSocial: z.boolean(),
});

export const UserMetadataSchema = z.object({
  account_expiration_date: z.string().refine(str=>validDateString(str),
  {message:"Invalid date string,Please provide the date string in the format of YYYY-MM-DD"})
  .nullish(),
  enrolled_class_id: z.string().trim().nonempty().nullish(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).nullish(),
  available_modules:z.array(z.string().trim().nonempty()).nullish(),
}).passthrough();

export type UserMetadataType = z.infer<typeof UserMetadataSchema>

const AppmetadataSchema = z.object({}).passthrough();

export const UserSchema = z.object({
  created_at: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  family_name: z.string().optional(),
  given_name: z.string().optional(),
  identities: z.array(IdentitySchema),
  name: z.string(),
  nickname: z.string().optional(),
  picture: z.string(),
  updated_at: z.string().optional(),
  user_id: z.string(),
  user_metadata: UserMetadataSchema.optional(),
  app_metadata: AppmetadataSchema.optional(),
}).passthrough();

export type UserType = z.infer<typeof UserSchema>

export const UserArrayScehma = z.array(UserSchema)
export type UserArrayType = z.infer<typeof UserArrayScehma>



export const RoledUserSchema = UserSchema.extend({
  roles:RoleArraySchema.default([]) ,
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






