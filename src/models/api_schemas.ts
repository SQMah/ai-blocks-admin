import * as z from "zod"
import { UserRoleSchema,UserMetadataSchema } from "./auth0_schemas"

export const UserCreateSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  classId:z.string().trim().nonempty({message:"Required"}),
  expiration:z.string().trim().nonempty({message:"Required"}),
})

export type UserCreateType = z.infer<typeof UserCreateSchema>

export const PostUsersReqSchema = z.object({
  users: z.array(UserCreateSchema),
});


export type PostUsersReqType = z.infer<typeof PostUsersReqSchema>;

export const PostUsersResSchema = z.object({
  messages:z.array(z.string())
});

export type PostUsersResType = z.infer<typeof PostUsersResSchema>;

export const PatchUsersReqSchema = z.object({
  userId: z.string().trim().nonempty(),
  classIds: z.string().trim().optional().nullable()
})

export type PatchUsersReqType = z.infer<typeof PatchUsersReqSchema>
