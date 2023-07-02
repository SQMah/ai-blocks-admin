import {z} from "zod"

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