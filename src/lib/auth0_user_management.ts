import axios, { AxiosError } from 'axios';
import generatePassword from './generate_password';
import { sendMail } from './mail_sender';
import {z} from "zod"

import { roleMapping,UserMetadataType,UserCreationBodyType,
  AssignRoleBodyType, RoleCheckResponseSchema, RoledUserArrayType,  RoleArrayType, UserSchema, 
  UserType, UserSearchResponseArraySchema,
   UserSearchResponseType, UserMetadataSchema, UserCreationBodySchema, defaultModels, UserRoleType} from '@/models/auth0_schemas';
import { PutUsersReqType, PostUsersReqType} from '@/models/api_schemas';

import { removeDuplicates, zodErrorMessage } from './utils';
import { APIError } from './api_utils';

const auth0BaseUrl = process.env.AUTH0_ISSUER_BASE_URL;

if(!auth0BaseUrl) throw new Error("AUTH 0 ISSUER IS NOT DEFINDED")



export async function createUser(access_token:string,payload:PostUsersReqType){
  const {role,first_name,last_name,email,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} = payload
  const roleId:string|undefined = roleMapping[role]?.id
  if(!roleId){
    throw new APIError("Invalid Request Body","Invalid role")
  }
  try {
    const user_meatadata:UserMetadataType ={
      ...(role === "managedStudent" && { enrolled_class_id }),
      ...(role==="teacher"&&{teaching_class_ids:teaching_class_ids?removeDuplicates(teaching_class_ids):teaching_class_ids}),
      ...((role==="unmanagedStudent"||role==="managedStudent")&&{available_modules:available_modules?removeDuplicates(available_modules):defaultModels}),
      ...(role !== "admin" && { account_expiration_date }),
    }
    const create_body:UserCreationBodyType = {
      "connection": "Username-Password-Authentication",
      "email": email,
      "password": generatePassword(),
      "verify_email": false,
      "given_name": first_name,
      "family_name": last_name,
      "name": `${first_name} ${last_name}`,
      "user_metadata":user_meatadata,
      "app_metadata":{}
    }
    const response = await axios.post(`${auth0BaseUrl}/api/v2/users`, UserCreationBodySchema.parse(create_body), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      });

    const data = UserSchema.parse(response.data)
    const userId:string = data.user_id
    await assignRole(access_token,userId,role)
    console.log(`${payload.role} account for ${data.email} is creacted`)
    return data;
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }
    if(error instanceof z.ZodError){
      throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        //handle conflict
        if(statusCode == 409){
          throw new APIError("Conflict",`${payload.email} already an existing user.`)
        }
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} for email: ${payload.email}, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error",`Connection Error In User Creation`)
    }
    throw new APIError("Internal Server Error",`Fail to create account for ${payload.email}, message:${error.message??"Unknown Error"}`)
  }
}

export async function getAccessToken(): Promise<string> {
    const body = {
        grant_type: 'client_credentials',
        client_id: process.env.AUTH0_API_CLIENT_ID,
        client_secret: process.env.AUTH0_API_CLIENT_SECRET,
        audience: process.env.AUTH0_API_BASE_URL,
        }

    //console.log(body)
    try {
      const response = await axios.post(`${auth0BaseUrl}/oauth/token`,body);
      //console.log('token:',response.data.access_token)
      const token = z.string().parse(response.data.access_token)
      return token;
    } catch (error:any) {
      if(error instanceof z.ZodError){
        throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
      }
      else if(error instanceof AxiosError){
        if(error.response){
          const statusCode = error.response.status;
          throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when getting access token, message: ${error.response.data?.message}`)
        }
        throw new APIError("Internal Server Error","Connection Error In Getting Access Token")
      }
      throw new APIError("Internal Server Error",`Fail to get access token, message:${error.message??"Unknown Error"}`)
    }
    
}

export const assignRole = async (access_token:string,userId:string,role:UserRoleType)=>{
    const roleId:string|undefined = roleMapping[role]?.id
    if(!roleId){
      throw new APIError("Invalid Request Body","Invalid role")
    }
    const assign_body:AssignRoleBodyType = {
      "roles" : [roleId]
    }
    try {
      await axios.post(`${auth0BaseUrl}/api/v2/users/${userId}/roles`, assign_body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      });
    } catch (error:any) {
      if(error instanceof APIError){
        throw error
      }
      else if(error instanceof AxiosError){
        if(error.response){
          const statusCode = error.response.status;
          throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when assigning role, message: ${error.response.data?.message}`)
        }
        throw new APIError("Internal Server Error",`Connection Error In Role Assign`)
      }
      throw new APIError("Internal Server Error",`Fail to assign role, message:${error.message??"Unknown Error"}`)
    }
}

export const deleteRole = async (access_token:string,userId:string,role:UserRoleType)=>{
  const roleId:string|undefined = roleMapping[role]?.id
  if(!roleId){
    throw new APIError("Invalid Request Body","Invalid role")
  }
  const body:AssignRoleBodyType = {
    "roles" : [roleId]
  }
  try {
    await axios.delete(`${auth0BaseUrl}/api/v2/users/${userId}/roles`,  {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      data:body
    });
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when removing role, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error",`Connection Error In Role Remove`)
    }
    throw new APIError("Internal Server Error",`Fail to remove role, message:${error.message??"Unknown Error"}`)
  }
}

export const checkRole = async(access_token:string,userId:string):Promise<RoleArrayType> =>{
  try {
    const response = await axios.get(`${auth0BaseUrl}/api/v2/users/${userId}/roles`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
    });
    const data = RoleCheckResponseSchema.parse(response.data)
    let res = data.map((role)=>role.name)
    return res
  } catch (error:any) {
    if(error instanceof z.ZodError){
      throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when checking role, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In Role Checking")
    }
    throw new APIError("Internal Server Error",`Fail to check role, message:${error.message??"Unknown Error"}`)
  }
}

export const sendInvitation = async(access_token:string,receiver_name:string
  ,reciever_mail:string)=>{
  try {
      const signing_name ="SQ"
      const formated_addr = "AI Blocks"
      const subject = "Invitation to AI Blocks"
      const body = {
        "client_id": process.env.AUTH0_CLIENT_ID,
        "connection_id": process.env.AUTH0_DB_CONNECTION_ID,
        "email": reciever_mail
      }
      const {data} = await axios.post(`${auth0BaseUrl}/api/v2/tickets/password-change`,body,{
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      });
      const url = data.ticket +"#type=invite" + "#app=AIBlock"
      // console.log(url)
      await sendMail(subject,formated_addr,receiver_name,reciever_mail,url,signing_name)
      console.log(`Invitation mail sent to ${reciever_mail}`)  
  } catch (error:any) {
   if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when generating password changing ticket, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In Password Changing ticket Generation")
    }
    throw new APIError("Internal Server Error",`Fail to send inviation email, message:${error.message??"Unknown Error"}`)
  }
  
}

interface SerachQuery {
    email?:string[]
    enrolled_class_id?:string[]
    teaching_class_ids?:string[]
}


export const searchUser = async (access_token:string,query:SerachQuery,type:"AND"|"OR"="OR"):Promise<RoledUserArrayType>=>{
  // console.log(query,type)
  const {email,enrolled_class_id,teaching_class_ids} = query
  const seperator = `%20${type}%20`
  const queryStrs = [
    email&&email.map(input=>`email:${input}`),
    enrolled_class_id&&enrolled_class_id.map(input=>`user_metadata.enrolled_class_id:${input}`),
    teaching_class_ids&&teaching_class_ids.map(input=>`user_metadata.teaching_class_ids:${input}`)
  ].filter(input=>!!input).map(input=>input?.join(seperator).replaceAll(" ","\\ "))
  // console.log(queryStrs,seperator)
  const apiUrl = new URL(`?q=${queryStrs.join(seperator)}`,`${auth0BaseUrl}/api/v2/users`)
  // console.log(apiUrl.href)
  try {
    const response = await axios.get(apiUrl.href,{
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    // console.log(response.data)
    const data = UserSearchResponseArraySchema.parse(response.data)
    // console.log(data)
    let res = await Promise.all(data.map(async (user:UserSearchResponseType)=>{
      const roles = await checkRole(access_token,user.user_id)
      return {...user,roles}
    }))
    // console.log(res.map(user=>user.name))
    return res
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else if(error instanceof z.ZodError){
      throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when searching users, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In Users Search")
    }
    throw new APIError("Internal Server Error",`Fail to search users, message:${error.message??"Unknown Error"}`)
  }
}

export const getUserByEmail = async (access_token:string,email:string)=>{
  try {
    const response = await axios.get(`${auth0BaseUrl}/api/v2/users-by-email?email=${email}`,{
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    // console.log(response.data)
    const data = response.data
    if(!Array.isArray(data)) throw new APIError("Auth0 Error","Fail to parse user data")
    // console.log(data)
    if(data.length===0) throw new APIError("Resource Not Found","User not found")
    const user = UserSchema.parse(data[0])
    const roles = await checkRole(access_token,user.user_id)
    return {...user,roles}
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else if(error instanceof z.ZodError){
      throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when get user, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In Getting User")
    }
    throw new APIError("Internal Server Error",`Fail to getting user, message:${error.message??"Unknown Error"}`)
  }
}

const PutUserBodySchema = z.object({
  user_metadata:UserMetadataSchema.optional()
})

type PutUserBodyType = z.infer<typeof PutUserBodySchema>


export const updateUser = async (access_token:string,payload:PutUsersReqType,roles:RoleArrayType) =>{
  const {userId,content} = payload
  const {available_modules,enrolled_class_id,teaching_class_ids,account_expiration_date} = content
  const body:PutUserBodyType ={}
  const isStudent = roles.includes("managedStudent")||roles.includes("unmanagedStudent")
  const isTeacher =roles.includes("teacher")
  const isAdmin = roles.includes('admin')
  body.user_metadata={
    ...(isStudent && { enrolled_class_id }),
    ...(isTeacher&&{teaching_class_ids:teaching_class_ids?removeDuplicates(teaching_class_ids):teaching_class_ids}),
    ...(isStudent&&{available_modules:available_modules?removeDuplicates(available_modules):available_modules}),
    ...(isAdmin&&account_expiration_date===null&&{account_expiration_date}),
    ...(!isAdmin&&{account_expiration_date})
  }
  if(!Object.keys(body).length) throw new APIError("Invalid Request Body","Invalid update content")
  try {
    const {data} = await axios.patch(`${auth0BaseUrl}/api/v2/users/${userId}`, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
    });
    return UserSchema.parse(data)    
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else if(error instanceof z.ZodError){
      throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when updating user, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In Users Update")
    }
    throw new APIError("Internal Server Error",`Fail to update user, message:${error.message??"Unknown Error"}`)
  }
}

export const deleteUser = async (access_token:string,userId:string) =>{
  try {
    // console.log('enetered delteuser')
    const response = await axios.delete(`${auth0BaseUrl}/api/v2/users/${userId}`,{
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    return response.data
  } catch (error:any) {
   if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when deleting user, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In User Deletion")
    }
    throw new APIError("Internal Server Error",`Fail to delete user, message:${error.message??"Unknown Error"}`)
  }
}

export const getUserByID =async (access_token:string,userId:string) => {
  try {
    const response = await axios.get(`${auth0BaseUrl}/api/v2/users/${userId}`,{
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    const user = UserSchema.parse(response.data)
    const roles = await checkRole(access_token,userId)
    return {...user,roles}
  } catch (error:any) {
    if(error instanceof APIError){
      throw error
    }else if(error instanceof z.ZodError){
      throw new APIError("Auth0 Error",zodErrorMessage(error.issues))
    }
    else if(error instanceof AxiosError){
      if(error.response){
        const statusCode = error.response.status;
        throw new APIError("Auth0 Error",`Error occcurs with status code ${statusCode} when getting user, message: ${error.response.data?.message}`)
      }
      throw new APIError("Internal Server Error","Connection Error In Users Get")
    }
    throw new APIError("Internal Server Error",`Fail to get user, message:${error.message??"Unknown Error"}`)
  }
  
}