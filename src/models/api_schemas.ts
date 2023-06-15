import {z}from "zod"
import { UserMetadataSchema, UserRoleSchema } from "./auth0_schemas"
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


export const UserCreateDataSchema = z.object({
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

export type UserCreateDataType = z.infer<typeof UserCreateDataSchema>




export const PostUsersReqSchema = z.object({
  user:UserCreateDataSchema.optional(),
  users: z.array(UserCreateCSVSchema).optional(),
  role: UserRoleSchema.optional() ,
  enrolled_class_id: z.string().optional(),
  teaching_class_ids:z.array(z.string().trim().nonempty()).optional(),
  available_modules:z.array(z.string()).optional(),
  account_expiration_date:  SetExpriationSchema.or(z.literal("")).optional(),
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
  message:z.string(),
  details:z.array(z.string())
});

export type PostUsersResType = z.infer<typeof PostUsersResSchema>;

export const PutUsersReqSchema = z.object({
  userId: z.string().trim().nonempty(),
  content:UserMetadataSchema.extend({
  })
})

export type PutUsersReqType = z.infer<typeof PutUsersReqSchema>


export const GetClassResSchema = z.object({
  class_id:z.string(),
  class_name:z.string(),
  teacherIds:z.array(z.string()),
  studentIds:z.array(z.string()),
  capacity:z.number().nonnegative(),
  available_modules:z.array(z.string())
})

export type GetClassesResType = z.infer<typeof GetClassResSchema>

export const PostClassesReqSchema=z.object({
  class_name:z.string().nonempty({message:"Required"}),
  teacherIds:z.array(z.string().email().trim().nonempty()),
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
  teacherIds:z.array(z.string().email().trim().nonempty()).optional(),
  studentIds:z.array(z.string().email().trim().nonempty()).optional(),
  capacity:z.number().min(1,{message:"Capacity must greater than 0"}).optional(),
  available_modules:z.array(z.string()).optional(),
  addTeachers:z.array(z.string().email().trim().nonempty()).optional(),
  addStudents:z.array(z.string().email().trim().nonempty()).optional(),
  removeTeachers:z.array(z.string().email().trim().nonempty()).optional(),
  removeStudents:z.array(z.string().email().trim().nonempty()).optional(),
})
.refine(input=>{
  return Object.values(input).length>1
},{message:"At least one update to be made"})
.refine(input=>{
  const {studentIds,teacherIds,addStudents,addTeachers,removeStudents,removeTeachers} = input
  const studentOverlap = studentIds&&(addStudents||removeStudents)
  const teacherOverlap = teacherIds&&(addTeachers||removeTeachers)
  return !(teacherOverlap&&studentOverlap)
},{message:"Cannot set and modify students/teachers at the same time."})

export type  PutClassesReqType = z.infer<typeof  PutClassesReqSchema>