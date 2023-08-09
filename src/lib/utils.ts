import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { AxiosError } from "axios";
import { z } from "zod";
import { DateTime } from "luxon";
import {
  generateErrorMessage,
  ErrorMessageOptions,
  generateError,
} from "zod-error";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOrdinal(number: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const lastDigit = number % 10;
  const lastTwoDigits = number % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return number + "th";
  } else {
    // @ts-expect-error
    return number + suffixes[lastDigit] || suffixes[0];
  }
}

export function delay(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time));
}


export function validDateString(str: string | undefined | null): boolean {
  if (!str) return false;
  return !isNaN(Date.parse(`${str}T00:00:00`));
}
export function  parseDateStr(str:string):Date
export function  parseDateStr(str:undefined | null):undefined
export function parseDateStr(str:string | undefined | null):Date| undefined {
  if(!validDateString(str)) return undefined
  return new Date(`${str}T00:00:00`)
}


export function expirated(data: string|Date): boolean {
  const tdy = new Date();
  if(typeof data === "string"){
    const date = new Date(`${data}T00:00:00`);
    return date < tdy;
  }else{
    return data < tdy
  }
}

export function afterToday(data: string|Date): boolean {
  const tdy = new Date();
  if(typeof data === "string"){
    const date = new Date(`${data}T00:00:00`);
    return date > tdy;
  }else{
    return data > tdy
  }
}

export function futureDate(days: number, months: number, years: number) {
  return DateTime.now().plus({ days, months, years });
}


export function findEarliestDate(
  dates: (Date | undefined | null)[]
): Date | undefined {
  const validDates = dates.filter(Boolean) as Date[]

  if (validDates.length === 0) {
    return undefined;
  }

  const sortedDates = validDates.sort((a, b) => {
    return a.getTime() - b.getTime();
  });

  return sortedDates[0];
}

export function removeDuplicates<T>(arr: T[]) {
  const set = new Set(arr);
  return Array.from(set);
}

export class ClientErrorHandler {
  public readonly message: string;
  public readonly status_code:number;
  public readonly isAxiosError:boolean = false;
  constructor(error: any) {
    if (error instanceof z.ZodError) {
      this.isAxiosError = true
      this.message = zodErrorMessage(error.issues);
    } else if (error instanceof AxiosError) {
      this.isAxiosError = true
      this.message = error.response?.data?.message ?? "Axios Error";
    } else if (error instanceof Error) {
      this.message = error.message ?? "Unknown Error";
    } else {
      this.message = "Unknown Error";
    }
    this.status_code = error instanceof AxiosError? (error.response?.status)??500 : 500
  }
  log() {
    console.error(this.message);
  }
}

export const stringToBoolean = (str: string | undefined) => {
  if (str?.toLowerCase() === "true") return true;
  else if (str?.toLowerCase() === "false") return false;
  return undefined;
};

const zodErrorOptions: ErrorMessageOptions = {
  delimiter: {
    error: " ||",
  },
  transform: ({ errorMessage, index }) =>
    `Error #${index + 1}: ${errorMessage}`,
};

export const zodErrorMessage = (issues: z.ZodIssue[]) => {
  const errorMessage = generateErrorMessage(issues, zodErrorOptions);
  return Error(errorMessage).message;
};

export type TupleSplit<
  T,
  N extends number,
  O extends readonly any[] = readonly []
> = O["length"] extends N
  ? [O, T]
  : T extends readonly [infer F, ...infer R]
  ? TupleSplit<readonly [...R], N, readonly [...O, F]>
  : [O, T];

export function sameList<T>(
  arr1: T[] | Set<T> | null | undefined,
  arr2: T[] | Set<T> | null | undefined
) {
  // console.log(arr1,arr2)
  if (!arr1 || !arr2) return false;
  if (!Array.isArray(arr1)) {
    arr1 = Array.from(arr1);
  }
  if (!Array.isArray(arr2)) {
    arr2 = Array.from(arr2);
  }
  return arr1.sort().toString() === arr2.sort().toString();
}

export type Nullable<T> = T | undefined | null;

export function filterObject(
  obj: Record<string, any>,
  fn: (key: string, val: any) => boolean
) {
  const asArray = Object.entries(obj);
  const filtered = asArray.filter((entry) => {
    const [key, val] = entry;
    return fn(key, val);
  });
  return Object.fromEntries(filtered);
}

export function isSubset<T>(superset: T[], subset: T[]) {
  return subset.every((element) => superset.includes(element));
}

export function hasIntersection<T>(list1: T[], list2: T[]) {
  return list1.some((x) => list2.includes(x));
}


/**
 * 
 * @param target 
 * @param filter 
 * @param fn true => included
 */
export function myFilterArray<T>(target:T[],fn:(val:T,index:number)=>boolean){
  const included:T[] = []
  const excluded:T[] =[]

  target.forEach((val,index)=>{
    if(fn(val,index)){
      included.push(val)
    }else{
      excluded.push(val)
    }
  })
  return {included,excluded}
}

export function formatDate(date:Date){
  const data = DateTime.fromJSDate(date)
  return data.toFormat("yyyy LLL dd")
}

export function capitalizeFirstLetter(string:string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
