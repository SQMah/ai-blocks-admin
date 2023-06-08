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