import { ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
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
