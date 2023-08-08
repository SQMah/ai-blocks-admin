import type { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, checkRole ,createUser} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";
import { stringToBoolean, zodErrorMessage } from "./utils";
import { string, z } from "zod";
import { AxiosError } from "axios";
import { GetClassesResType,BatchCreateUserReqType,PostUsersReqType, UpdateUserContentType } from "@/models/api_schemas";
import { ClassType,ClassUpdatePaylod } from "@/models/dynamoDB_schemas";
import { UserRoleType ,RoledUserType} from "@/models/auth0_schemas";

const requireAdminCheck = stringToBoolean(process.env.REQUIRE_ADMIN) ?? true;

export const adminCheck = async (
  req: NextApiRequest,
  res: NextApiResponse<any>
): Promise<boolean> => {
  if (!requireAdminCheck) return true;
  try {
    const session = await getSession(req, res);
    // console.log(session)
    if (!session?.user?.sub) {
      throw new APIError("Unauthorized");
    }
    const token = await getAccessToken();
    const userId = session.user.sub as string;
    const roles = await checkRole(token, userId);
    if (!roles.includes("admin")) {
      throw new APIError("Forbidden");
    }
    return true;
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
    return false;
  }
};

const APIErrorStatus = {
  "Bad Request": 400,
  "Invalid Request Body": 400,
  "Invalid Request Params": 400,
  "Unauthorized": 401,
  "Forbidden": 403,
  "Resource Not Found": 404,
  "Not Found": 404,
  "Conflict": 409,
  "Auth0 Error": 500,
  "Dynamo DB Error": 500,
  "Cloud Watch Error":500,
  "Implementation Error": 500,
  "Internal Server Error": 500,
} as const;

type API_ERROR_STATUS = typeof APIErrorStatus;

export type ERROR_STATUS_TEXT = keyof API_ERROR_STATUS;

type ERROR_STATUS_CODE = API_ERROR_STATUS[ERROR_STATUS_TEXT];

const APISccuessStatus = {
  OK: 200,
  Created: 201,
  "No Conetent": 204,
} as const;

type API_SUCCESS_STATUS = typeof APISccuessStatus;

export type SUCCESS_STATUS_TEXT = keyof API_SUCCESS_STATUS;
export type SUCCESS_STATUS_CODE = API_SUCCESS_STATUS[SUCCESS_STATUS_TEXT];

export class APIError extends Error {
  public readonly code: ERROR_STATUS_CODE;
  public readonly status: ERROR_STATUS_TEXT;
  public readonly name: string;
  constructor(
    status: ERROR_STATUS_TEXT,
    message: string | undefined = undefined
  ) {
    message = message ?? status;
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = APIErrorStatus[status];
  }
}

export class ServerErrorHandler {
  public readonly message: string;
  public readonly status_text: ERROR_STATUS_TEXT;
  public readonly status_code: number;
  constructor(error: any) {
    if (error instanceof APIError) {
      this.status_code = error.code;
      this.status_text = error.status;
      this.message = error.message;
    } else if (error instanceof z.ZodError) {
      this.status_code = 400;
      this.status_text = "Bad Request";
      this.message = zodErrorMessage(error.issues);
    } else if (error instanceof AxiosError) {
      this.status_code = 500;
      this.status_text = "Internal Server Error";
      this.message = error.response?.data?.message ?? "Unknown";
    } else {
      this.status_code = 500;
      this.status_text = "Internal Server Error";
      if (error instanceof Error) this.message = error.message ?? "Unknown";
      else this.message = "Unknown";
    }
  }
  log() {
    console.error(`Logging Error Message: ${this.message}`);
  }
  sendResponse(req: NextApiRequest, res: NextApiResponse) {
    res.status(this.status_code).json({
      status: this.status_code,
      message: `${this.status_text}: ${this.message}`,
      details: {
        resource: req.url,
        method: req.method,
      },
    });
  }
}

export const dbToJSON = (data: ClassType): GetClassesResType => {
  const {
    class_id,
    class_name,
    teacher_ids,
    student_ids,
    capacity,
    available_modules,
  } = data;
  const obj: GetClassesResType = {
    class_id,
    class_name,
    capacity,
    teacher_ids: teacher_ids && teacher_ids.size ? Array.from(teacher_ids) : [],
    student_ids: student_ids && student_ids.size ? Array.from(student_ids) : [],
    available_modules:
      available_modules && available_modules.size
        ? Array.from(available_modules)
        : [],
  };
  return obj;
};

export function classUpdatePaylaodsFromCreateUser(
  payload: Parameters<typeof createUser>[1]
): ClassUpdatePaylod[] {
  // console.log(payload)
  const { role, enrolled_class_id, teaching_class_ids, email } = payload;
  const payloads: ClassUpdatePaylod[]  = [];
  if (role === "managedStudent" && enrolled_class_id) {
    const data: ClassUpdatePaylod = {
      class_id: enrolled_class_id,
      addStudents: [email],
    };
    return [data]
  }
  if (role === "teacher" && teaching_class_ids) {
    const data: ClassUpdatePaylod[] = teaching_class_ids.map((id) => {
      return {
        class_id: id,
        addTeachers: [email],
      };
    });
    return data
  }
  return payloads;
}

export function classUpdatePayloadsFromBatchCreate(
  payload: BatchCreateUserReqType
): ClassUpdatePaylod[] {
  const { role, enrolled_class_id, teaching_class_ids, users } = payload;
  if (role === "managedStudent" && enrolled_class_id) {
    const data = {
      class_id: enrolled_class_id,
      addStudents: users.map((user) => user.email),
    };
    return [data];
  } else if (role === "teacher" && teaching_class_ids) {
    return teaching_class_ids.map((id) => {
      return {
        class_id: id,
        addTeachers: users.map((user) => user.email),
      };
    });
  }
  return [];
}

export function classUpdatePayloadsFromDeleteUser(
  user: RoledUserType
): ClassUpdatePaylod[] {
  // console.log(user)
  const { roles, user_metadata, email } = user;
  if (!user_metadata) return [];
  const { enrolled_class_id, teaching_class_ids } = user_metadata;
  if (roles.includes("managedStudent") && enrolled_class_id) {
    const data: ClassUpdatePaylod = {
      class_id: enrolled_class_id,
      removeStudents: [email],
    };
    return [data];
  }
  if (roles.includes("teacher") && teaching_class_ids) {
    return teaching_class_ids.map((id) => {
      return {
        class_id: id,
        removeTeachers: [email],
      };
    });
  }
  return [];
}


export function classUpdatePayloadsFromUpdateUserContetnt(updateContent:UpdateUserContentType,user:RoledUserType):ClassUpdatePaylod[]{
  const {enrolled_class_id,teaching_class_ids} = updateContent
  const updateEnrolled = enrolled_class_id!==undefined
  const updateTeaching = teaching_class_ids!==undefined
  if(!updateEnrolled&&!updateTeaching) return []
  const {email} = user
  if(user.roles.includes("managedStudent")&&updateEnrolled){
    const oldClass = user.user_metadata?.enrolled_class_id
    if(enrolled_class_id){
      //change classs
      const payloads:ClassUpdatePaylod[] = []
      oldClass&&payloads.push({class_id:oldClass,removeStudents:[email]})
      payloads.push({class_id:enrolled_class_id,addStudents:[email]})
      return payloads
    }else if(oldClass){
      //become unmanaged
      return [{class_id:oldClass,removeStudents:[email]}]
    }
  }else if(user.roles.includes("unmanagedStudent")&&enrolled_class_id ){  
    //enrolled in class
    return [{class_id:enrolled_class_id,addStudents:[email]}]
  }else if(user.roles.includes('teacher')&&teaching_class_ids){
    //change teaching
    const remove = (user.user_metadata?.teaching_class_ids??[]).map(class_id=>{
      return {class_id,removeTeachers:[email]}
    })
    const add = teaching_class_ids.map(class_id=>{
     return{ class_id,addTeachers:[email]}
    })
    return [...remove,...add]
  }
  return []
}

export function haveRoleChange(update:UpdateUserContentType,roles:UserRoleType[]):undefined|{old:UserRoleType,new:UserRoleType}{
  if(roles.includes("managedStudent")&&update.enrolled_class_id===null){
    return {old:"managedStudent",new:"unmanagedStudent"}
  }else if(roles.includes("unmanagedStudent")&&update.enrolled_class_id){
    return {old:"unmanagedStudent",new:"managedStudent"}
  }
  return undefined
}

export function userUpdatePayloadFromClassCreation(users:RoledUserType[],class_id:string):{user:RoledUserType,content:UpdateUserContentType}[]{
  return users.map(user=>{
    const {user_metadata} = user
    const teaching =[ ...(user_metadata?.teaching_class_ids??[]),class_id]
    return{user,content:{teaching_class_ids:teaching}}
  })
}

export function willUpdateUsersWhenClassUpdate(payload:ClassUpdatePaylod):boolean{
  const {addStudents,addTeachers,removeStudents,removeTeachers} = payload
  return [...addStudents??[],...addTeachers??[],...removeStudents??[],removeTeachers??[]].length>0
}