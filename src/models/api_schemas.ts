import {z}from "zod"
import { RoledUserArraySchema, RoledUserArrayType, RoledUserSchema, UserMetadataSchema, UserRoleSchema, UserSchema } from "./auth0_schemas"
import { validDateString,afterToday} from "@/lib/utils"

export const SetExpriationSchema = z.string().nonempty({message:"Required"}).refine(str=>{
    if(str) return validDateString(str)
    return true
  },
{message:"Invalid date string,Please provide the date string in the format of YYYY-MM-DD"}
).refine(str=>{
  if(str) return afterToday(str)
  return true
},{message:"Expiration date is required to be set after today"})

export const UserCreateFormSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().optional(),
  teaching_class_ids_str:z.string().optional(),  
  available_modules:z.array(z.string()).optional(),
  account_expiration_date: SetExpriationSchema.or(z.literal("")).optional(),
})
.refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
)
.refine(input=>{
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


export const SeachUsersSchema = RoledUserArraySchema
export type SearchUsersType = z.infer<typeof SeachUsersSchema>

export const GetUserResSchema = RoledUserSchema
export type GetUserResType = z.infer<typeof GetUserResSchema>


export const PostUsersReqSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string()).optional(),
  account_expiration_date: SetExpriationSchema.or(z.literal("")).optional(),
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


export type PostUsersReqType = z.infer<typeof PostUsersReqSchema>;

export const PostUsersResSchema = UserSchema

export type PostUsersResType = z.infer<typeof PostUsersResSchema>;

export const  BatchCreateUsersReqSchema = z.object({
  users: z.array(UserCreateCSVSchema),
  role: UserRoleSchema,
  enrolled_class_id: z.string().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string()).optional(),
  account_expiration_date:  SetExpriationSchema.or(z.literal("")).optional(),
}).refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
).refine(input=>{
  if(input.role&&input.role!=="admin"){
    return input.account_expiration_date?.length
  }else return true
},{path:["account_expiration_date"],message:`Expiration date is required`})

export const PutUsersReqSchema = z.object({
  userId: z.string().trim().nonempty(),
  content:UserMetadataSchema.extend({
  })
})

export type BatchCreateUserReqType = z.infer<typeof BatchCreateUsersReqSchema>

export const BathCraeteUserResSchema = z.object({
  created: z.array(UserSchema),
  failed: z.array(UserCreateCSVSchema.extend({
    reason:z.string()
  })),
  message:z.string()
})

export type BatchCreateUsersResType = z.infer<typeof BathCraeteUserResSchema>

export type PutUsersReqType = z.infer<typeof PutUsersReqSchema>


export const GetClassResSchema = z.object({
  class_id:z.string(),
  class_name:z.string(),
  teacher_ids:z.array(z.string()),
  student_ids:z.array(z.string()),
  capacity:z.number().nonnegative(),
  available_modules:z.array(z.string())
})

export type GetClassesResType = z.infer<typeof GetClassResSchema>

export const PostClassesReqSchema=z.object({
  class_name:z.string().nonempty({message:"Required"}),
  teacher_ids:z.array(z.string().email().trim().nonempty()),
  capacity:z.number().min(1,{message:"Capacity must greater than 0"}),
  available_modules:z.array(z.string())
})

export const BatchGetClassResSchema = z.array(GetClassResSchema)
export type BatchGetClassType = z.infer<typeof BatchGetClassResSchema>

export type  PostClassesReqType = z.infer<typeof  PostClassesReqSchema>

export const PostClassesResSchema = GetClassResSchema
export type PostClassesResType = z.infer<typeof PostClassesResSchema>

export const PutClassesReqSchema=z.object({
  class_id:z.string().nonempty({message:"Required"}),
  class_name:z.string().nonempty().optional(),
  capacity:z.number().min(1,{message:"Capacity must greater than 0"}).optional(),
  available_modules:z.array(z.string()).optional(),
}).refine(e=>false,{message:"test"})



export type  PutClassesReqType = z.infer<typeof  PutClassesReqSchema>