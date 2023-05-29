import * as z from "zod"
import { PossilbeRoles } from "./auth0_interfaces"

export const userSchema = z.object({
  role: z.enum(PossilbeRoles),
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  classId:z.string().trim().nonempty({message:"Required"}),
  expiration:z.string().trim().nonempty({message:"Required"}),
})

export type userCraeteType = z.infer<typeof userSchema>