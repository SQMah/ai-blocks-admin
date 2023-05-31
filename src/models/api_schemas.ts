import * as z from "zod"
import { UserRoleSchema,dateRegex } from "./auth0_schemas"

export const UserCreateFormSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  account_expiration_date: z.string().regex(dateRegex,{message:"Invalid date format, YYYY-MM-DD is supported"}).optional()
  .refine(dateStr=>{
    if(!dateStr) return true
    const today = new Date ()
    const input = new Date(dateStr)
    return input > today
  },{message:"Expiration date is at least after the current date"}),
  enrolled_class_id: z.string().optional(),
  teaching_class_ids_str:z.string().optional(),  
})
.refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
).refine(input=>{
  if(input.role!=="admin"){
    return input.account_expiration_date?.length
  }else return true
},{path:["account_expiration_date"],message:`Expiration is required for non-admin account`})

export type UserCreateFormType = z.infer<typeof UserCreateFormSchema>

export const UserCreateDataSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  account_expiration_date: z.string().regex(dateRegex,{message:"Invalid date format, YYYY-MM-DD is supported"}).optional()
  .refine(dateStr=>{
    if(!dateStr) return true
    const today = new Date()
    const input = new Date(dateStr)
    return input > today
  },{message:"Expiration date is at least after the current date"}),
  enrolled_class_id: z.string().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional()
})
.refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
).refine(input=>{
  if(input.role!=="admin"){
    return input.account_expiration_date?.length
  }else return true
},{path:["account_expiration_date"],message:`Expiration is required for non-admin account`})

export type UserCreateDataType = z.infer<typeof UserCreateDataSchema>


export const PostUsersReqSchema = z.object({
  users: z.array(UserCreateDataSchema),
});


export type PostUsersReqType = z.infer<typeof PostUsersReqSchema>;

export const PostUsersResSchema = z.object({
  messages:z.array(z.string().optional())
});

export type PostUsersResType = z.infer<typeof PostUsersResSchema>;

export const PutUsersReqSchema = z.object({
  userId: z.string().trim().nonempty(),
  enrolled_class_id: z.string().trim().optional().nullable()
})

export type PutUsersReqType = z.infer<typeof PutUsersReqSchema>
