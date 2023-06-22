import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  checkRole,
} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";
import { stringToBoolean,zodErrorMessage } from "./utils";
import { z } from "zod";
import { AxiosError } from "axios";
import { GetClassesResType } from "@/models/api_schemas";
import { ClassType } from "@/models/dynamoDB_schemas";


const requireAdminCheck = stringToBoolean(process.env.REQUIRE_ADMIN)??true

export const adminCheck = async (req: NextApiRequest,res: NextApiResponse<any>): Promise<boolean> => {
    if(!requireAdminCheck) return true
    try {
      const session = await getSession(req, res);
      // console.log(session)
      if (!session?.user?.sub) {
        throw new APIError("Unauthorized")
      }
      const token = await getAccessToken();
      const userId = session.user.sub as string;
      const roles = await checkRole(token, userId);
      if (!roles.includes("admin")) {
        throw new APIError("Forbidden")
      }
      return true
    } catch (error:any) {
      serverHandleError(error,req,res)
      return false
    }
  };


  const APIErrorStatus = {
    "Bad Request": 400,
    "Invalid Request Body":400,
    "Invalid Request Params":400,
    "Unauthorized": 401,
    "Forbidden": 403,
    "Resource Not Found":404,
    "Not Found": 404,
    "Conflict": 409,
    "Auth0 Error":500,
    "Dynamo DB Error":500,
    "Internal Server Error": 500
} as const;

  
  type API_ERROR_STATUS = typeof APIErrorStatus

  type ERROR_STATUS = keyof API_ERROR_STATUS

  type ERROR_STATUS_CODE  = API_ERROR_STATUS[ERROR_STATUS]

  export class APIError extends Error{
    public readonly code:ERROR_STATUS_CODE
    public readonly status:ERROR_STATUS
    public readonly name:string
    constructor(status:ERROR_STATUS,message:string|undefined = undefined){
      message = message?`${status}: ${message}`:status
      super(message)
      this.name = "APIError"
      this.status = status
      this.code = APIErrorStatus[status]
    }
  }

  export function serverHandleError(error:any,req:NextApiRequest,res:NextApiResponse){
    const body = {
      status:500,
      message:"Internal Server Error" ,
      details:{
        resource: req.url,
        method: req.method
      }
    }
    if(error instanceof APIError){
      body.status=error.code
      body.message = error.message
    }else if(error instanceof z.ZodError){
      body.status = 400
      body.message =  `Invalid Request Body/Params: ${zodErrorMessage(error.issues)}`
    }else if(error instanceof AxiosError){
      body.message = `Internal Connect Error: ${error.response?.data?.message}`
    }
    res.status(body.status).json(body);
  }

  export const dbToJSON = (data:ClassType)=>{
    const {class_id,class_name,teacher_ids,student_ids,capacity,available_modules} = data
    const obj:GetClassesResType ={
      class_id,class_name,capacity,
      teacher_ids:teacher_ids&&teacher_ids.size?Array.from(teacher_ids):[],
      student_ids:student_ids&&student_ids.size?Array.from(student_ids):[],
      available_modules:available_modules&&available_modules.size?Array.from(available_modules):[]
    }
    return obj
  }
  
  