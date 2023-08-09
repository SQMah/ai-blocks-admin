import {z} from "zod"
import { validDateString,afterToday, parseDateStr } from "@/lib/utils"



export const trimedNonEmptyString = z.string().trim().nonempty({message:"Required"})

export const emailSchema = z.string().trim().email({message:"Please provide a valid email"})

export const emptyArray =<T extends z.ZodTypeAny>(schema:T)=>z.array(schema).length(0)

export const expirationDateStrSchema = trimedNonEmptyString.refine(str=>{
  if(str) return validDateString(str)
  return true
},
{message:"Invalid date string,Please provide the date string in the format of YYYY-MM-DD"}
).refine(str=>{
if(str) return afterToday(str)
return true
},{message:"Expiration date is required to be set after today"})

export const setExpriationSchema = expirationDateStrSchema.transform(str=> parseDateStr(str))



export const JSONDateSchema = trimedNonEmptyString.refine(s=>{
  const timestamp = Date.parse(s);
  return isNaN(timestamp) == false
},{message:"Invalid JSON Date String"}).transform(s=>new Date(s))

// export function forceArrayLikeSchema<T extends z.ZodSchema<User>>(schema:T){
//     return z.array(schema).or(schema.transform(input=>[input]))
// }


