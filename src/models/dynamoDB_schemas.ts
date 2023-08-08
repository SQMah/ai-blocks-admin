import {z} from "zod"
import { emailSchema } from "@/lib/utils"


export const classSchema =z.object({
    class_id:z.string(),
    class_name:z.string(),
    teacher_ids:z.set(z.string()).nullish(),
    student_ids:z.set(z.string()).nullish(),
    capacity:z.number().nonnegative(),
    available_modules:z.set(z.string()).nullish(),
})

export type ClassType = z.infer<typeof classSchema>

export const classArraySchema =z.array(classSchema)
export type ClassArrayType = z.infer<typeof classArraySchema>


export const ClassUpdateSchema=z.object({
    class_id:z.string().trim().nonempty({message:"Required"}),
    class_name:z.string().nonempty().optional(),
    capacity:z.number().min(1,{message:"Capacity must greater than 0"}).optional(),
    available_modules:z.array(z.string().trim().nonempty()).optional(),
    addTeachers: z.array(emailSchema).optional(),
    addStudents :z.array(emailSchema).optional(),
    removeStudents:z.array(emailSchema).optional(),
    removeTeachers:z.array(emailSchema).optional(),
  })

  export type ClassUpdatePaylod = z.infer<typeof ClassUpdateSchema>
  