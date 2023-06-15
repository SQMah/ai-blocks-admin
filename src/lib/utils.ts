import { ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { GetClassesResType } from "@/models/api_schemas";
import { ClassType } from "@/models/dynamoDB_schemas";
import  { AxiosError } from 'axios';
import {z} from "zod"

 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getOrdinal(number:number):string {
  const suffixes = ["th", "st", "nd", "rd"];
  const lastDigit = number % 10;
  const lastTwoDigits = number % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return number + "th";
  } else {
    return number + suffixes[lastDigit] || suffixes[0];
  }
}

export function delay(time:number):Promise<void> {
  return new Promise(resolve => setTimeout(resolve, time));
}

export function validDateString(str: string | undefined | null): boolean {
  if(!str) return false
  return !isNaN(Date.parse(`${str}T00:00:00`))
}

export function expirated(str:string):boolean{
  const tdy = new Date()
  const data = new Date(`${str}T00:00:00`);
  return data < tdy
}

export function afterToday(str:string):boolean{
  const tdy = new Date()
  const data = new Date(`${str}T00:00:00`);
  return data > tdy
}

export function findEarliestDate(dates: (string | undefined|null)[]): string | undefined {
  const validDates = dates.filter(date => date !== undefined) as string[];

  if (validDates.length === 0) {
    return undefined;
  }

  const sortedDates = validDates.sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA.getTime() - dateB.getTime();
  });

  return sortedDates[0];
}

export function removeDuplicates<T>(arr:T[]){
  const set = new Set(arr)
  return Array.from(set)
}


export const dbToJSON = (data:ClassType)=>{
  const {class_id,class_name,teacherIds,studentIds,capacity,available_modules} = data
  const obj:GetClassesResType ={
    class_id,class_name,capacity,
    teacherIds:teacherIds&&teacherIds.size?Array.from(teacherIds):[],
    studentIds:studentIds&&studentIds.size?Array.from(studentIds):[],
    available_modules:available_modules&&available_modules.size?Array.from(available_modules):[]
  }
  return obj
}

export const errorMessage = (error:any,logging:boolean = true)=>{
  let message = error.message as string?? "Unknown error"
  if(error instanceof z.ZodError){
    message = "Data schema error"
    logging&&console.error(error.message)
  }
  else if(error instanceof AxiosError){
    message = error.response?.data.message
    logging&&console.error(message)
  }else{
    logging&&console.error(error)
  }
  return message
}

export const stringToBoolean =(str:string|undefined)=>{
  if (str?.toLowerCase() === "true") return true
  else if (str?.toLowerCase() === "false") return false
  return undefined
}