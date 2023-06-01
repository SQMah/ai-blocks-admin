import {z}from "zod"
import { UserMetadataSchema, UserRoleSchema,dateRegex } from "./auth0_schemas"

export const UserCreateFormSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().optional(),
  teaching_class_ids_str:z.string().optional(),  
  available_modules:z.array(z.string()).optional(),
  account_expiration_date: z.string().regex(dateRegex,{message:"Invalid date format, YYYY-MM-DD is supported"}).optional()
  .refine(dateStr=>{
    if(!dateStr) return true
    const today = new Date ()
    const input = new Date(dateStr)
    return input > today
  },{message:"Expiration date is at least after the current date"}),
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
},{path:["account_expiration_date"],message:`Expiration date is required`})

export type UserCreateFormType = z.infer<typeof UserCreateFormSchema>

export const UserCreateCSVSchema = z.object({
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),  
})

export type UserCreateCSVType = z.infer<typeof UserCreateCSVSchema>


export const UserCreateDataSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string()).optional(),
  account_expiration_date: z.string().regex(dateRegex,{message:"Invalid date format, YYYY-MM-DD is supported"}).optional()
  .refine(dateStr=>{
    if(!dateStr) return true
    const today = new Date()
    const input = new Date(dateStr)
    return input > today
  },{message:"Expiration date is at least after the current date"}),
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
},{path:["account_expiration_date"],message:`Expiration date is required`})

export type UserCreateDataType = z.infer<typeof UserCreateDataSchema>


export const PostUsersReqSchema = z.object({
  user:UserCreateDataSchema.optional(),
  users: z.array(UserCreateCSVSchema).optional(),
  role: UserRoleSchema.optional() ,
  enrolled_class_id: z.string().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string()).optional(),
  account_expiration_date: z.string().regex(dateRegex,{message:"Invalid date format, YYYY-MM-DD is supported"}).optional()
  .refine(dateStr=>{
    if(!dateStr) return true
    const today = new Date()
    const input = new Date(dateStr)
    return input > today
  },{message:"Expiration date is at least after the current date"}),
}).refine(input=>{
  if(input.users?.length) return input.role
  else return true
},{path:["role"],message:"Role is required for batch create."}
).refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
).refine(input=>{
  if(input.role&&input.role!=="admin"){
    return input.account_expiration_date?.length
  }else return true
},{path:["account_expiration_date"],message:`Expiration date is required`})


export type PostUsersReqType = z.infer<typeof PostUsersReqSchema>;

export const PostUsersResSchema = z.object({
  messages:z.array(z.string())
});

export type PostUsersResType = z.infer<typeof PostUsersResSchema>;

export const PutUsersReqSchema = UserMetadataSchema.extend({
  userId: z.string().trim().nonempty(),
})

export type PutUsersReqType = z.infer<typeof PutUsersReqSchema>
