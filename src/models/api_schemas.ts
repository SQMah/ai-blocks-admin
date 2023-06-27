import {z}from "zod"
import { RoledUserArraySchema, RoledUserArrayType, RoledUserSchema, UserMetadataSchema, UserRoleSchema, UserSchema } from "./auth0_schemas"
import { validDateString,afterToday} from "@/lib/utils"

export const SetExpriationSchema = z.string().trim().nonempty({message:"Required"}).refine(str=>{
    if(str) return validDateString(str)
    return true
  },
{message:"Invalid date string,Please provide the date string in the format of YYYY-MM-DD"}
).refine(str=>{
  if(str) return afterToday(str)
  return true
},{message:"Expiration date is required to be set after today"})

export const emailSchema = z.string().email()

export const UserCreateFormSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().trim().nonempty().optional(),
  teaching_class_ids_str:z.string().trim().nonempty().optional(),  
  available_modules:z.array(z.string().trim().nonempty()).optional(),
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

export const  SearchUsersReqSchema = z.object({
  email:z.array(emailSchema).or(emailSchema).transform(input=>Array.isArray(input)?input:[input]).optional(),
  enrolled_class_id:z.array(z.string().trim().nonempty()).or(z.string().trim().nonempty()).transform(input=>Array.isArray(input)?input:[input]).optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).or(z.string().trim().nonempty()).transform(input=>Array.isArray(input)?input:[input]).optional(),
  type:z.enum(["AND","OR"]).optional()
}).refine(inputs=>inputs.email||inputs.enrolled_class_id||inputs.teaching_class_ids,{message:"Please provide at least one search query"})

export const SearchUsersResSchema = RoledUserArraySchema
export type SearchUsersResType = z.infer<typeof SearchUsersResSchema>

export const  GetUsersReqSchema = z.object({
  email:emailSchema
})

export const GetUserResSchema = RoledUserSchema
export type GetUserResType = z.infer<typeof GetUserResSchema>


export const PostUsersReqSchema = z.object({
  role: UserRoleSchema ,
  email: z.string().trim().email({message:"Please provide a valid email"}),
  first_name: z.string().trim().nonempty({message:"Required"}),
  last_name: z.string().trim().nonempty({message:"Required"}),
  enrolled_class_id: z.string().trim().nonempty().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string().trim().nonempty()).optional(),
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
  enrolled_class_id: z.string().trim().nonempty().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string().trim().nonempty()).optional(),
  account_expiration_date:  SetExpriationSchema.or(z.literal("")).optional(),
}).refine((input)=>{
  if(input.role==="managedStudent"){
    return input.enrolled_class_id?.length
  }else return true
},{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
).refine(input=>{
  if(input.role!=="admin"){
    return input.account_expiration_date?.length
  }else return true
},{path:["account_expiration_date"],message:`Expiration date is required`})


export type BatchCreateUserReqType = z.infer<typeof BatchCreateUsersReqSchema>

export const BatchCreateUsersResSchema = z.object({
  created: z.array(UserSchema),
  failed: z.array(UserCreateCSVSchema.extend({
    reason:z.string()
  })),
  message:z.string()
})

export type BatchCreateUsersResType = z.infer<typeof BatchCreateUsersResSchema>

export const PutUsersReqSchema = z.object({
  userId: z.string().trim().nonempty(),
  content:UserMetadataSchema.extend({
  })
})
export type PutUsersReqType = z.infer<typeof PutUsersReqSchema>

export const DeleteUsersReqSchema = z.object({
  userId:z.string().trim().nonempty()
})

export const GetClassesReqSchema= z.object({
  class_id:z.string().trim().nonempty()
})

export const GetClassesResSchema = z.object({
  class_id:z.string().trim().nonempty(),
  class_name:z.string().trim().nonempty(),
  teacher_ids:z.array(z.string().trim().nonempty()),
  student_ids:z.array(z.string().trim().nonempty()),
  capacity:z.number().nonnegative(),
  available_modules:z.array(z.string().trim().nonempty())
})

export type GetClassesResType = z.infer<typeof GetClassesResSchema>

export const PostClassesReqSchema=z.object({
  class_name:z.string().trim().nonempty({message:"Required"}),
  teacher_ids:z.array(z.string().email().trim().nonempty()),
  capacity:z.number().min(1,{message:"Capacity must greater than 0"}),
  available_modules:z.array(z.string().trim().nonempty())
})

export const BatchGetClassesReqSchema = z.object({
  class_id:z.string().nonempty().or(z.array(z.string().nonempty())).transform(input=>Array.isArray(input)?input:[input])
})

export const BatchGetClassesResSchema = z.array(GetClassesResSchema)
export type BatchGetClassesType = z.infer<typeof BatchGetClassesResSchema>

export type  PostClassesReqType = z.infer<typeof  PostClassesReqSchema>

export const PostClassesResSchema = GetClassesResSchema
export type PostClassesResType = z.infer<typeof PostClassesResSchema>

export const PutClassesReqSchema=z.object({
  class_id:z.string().trim().nonempty({message:"Required"}),
  class_name:z.string().nonempty().optional(),
  capacity:z.number().min(1,{message:"Capacity must greater than 0"}).optional(),
  available_modules:z.array(z.string().trim().nonempty()).optional(),
})



export type  PutClassesReqType = z.infer<typeof  PutClassesReqSchema>

export const PutClassesResSchema = GetClassesResSchema

export const DeleteClassesReqSchema= z.object({
  class_id:z.string().trim().nonempty()
})

export const PostInvitationReqSchema = z.object({
  email:emailSchema
})