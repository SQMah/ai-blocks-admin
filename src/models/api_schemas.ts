import * as z from "zod"
import { UserRoleSchema } from "./auth0_schemas"

export const UserCreateSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  classId:z.string().trim().nonempty({message:"Required"}),
  expiration:z.string().trim().nonempty({message:"Required"}),
})

export type UserCreateType = z.infer<typeof UserCreateSchema>