import { APIRoute } from "@/models/api_schemas";
import axios from "axios";



type Query = Record<string,string[]|string>
type BodyData = Record<string,any>

type Method ="GET"|"POST"|"PUT"|"DELETE"


const BASE_URL = "/api/v1" as const

export function queryToString(query:Query){
    const strs:string[] = []
    for (const key in query){
        const val = query[key]
        if(!val) continue
        if(Array.isArray(val)){
            const toExtendd = val.map(s=>`${key}=${s}`)
            strs.splice(strs.length,0,...toExtendd)
        }else{
            strs.push(`${key}=${val}`)
        }
    }
    return strs.length?"?"+strs.join("&"):""
}



export async function requestAPI(route:APIRoute,method:Method,query:Query,body:BodyData,dynamicRoute?:string) {
    const {data} = await  axios.request({
        url:`/${route}${dynamicRoute?`/${dynamicRoute}`:""}${queryToString(query)}`,
        baseURL:BASE_URL,
        method,
        data:body,
    })
    return data
}