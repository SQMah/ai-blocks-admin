import {z} from "zod"

export const classSchema =z.object({
    class_id:z.string(),
    teacherIds:z.set(z.string()).nullish(),
    studentIds:z.set(z.string()).nullish(),
    capacity:z.number().nonnegative(),
    available_modules:z.set(z.string()).nullish(),
})

export type ClassType = z.infer<typeof classSchema>