import axios from 'axios';
import generatePassword from './generate_password';
import { sendMail } from './mail_sender';
import * as z from "zod"

import { roleMapping,UserMetadataType,UserCreationBodyType
  ,AssignRoleBodyType, RoleCheckResponseSchema, RoledUserArraySchema, RoledUserArrayType, 
  RoleArraySchema, RoleArrayType, UserCreateResponseSchema, UserCreateResponseType, UserSearchResponseArraySchema, UserSearchResponseType, UserMetadataSchema, UserCreationBodySchema } from '@/models/auth0_schemas';
import { PutUsersReqType, UserCreateDataType} from '@/models/api_schemas';

const auth0BaseUrl = process.env.AUTH0_ISSUER_BASE_URL;


export async function createUser(access_token:string,payload:UserCreateDataType): Promise<UserCreateResponseType> {
  try {
    const {role,first_name,last_name,email,enrolled_class_id,teaching_class_ids,account_expiration_date} = payload
    const user_meatadata:UserMetadataType ={
      ...(role === "managedStudent" && { enrolled_class_id }),
      ...(role==="teacher"&&{teaching_class_ids}),
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

    const data = UserCreateResponseSchema.parse(response.data)
      const userId:string = data.user_id
      const roleId:string|undefined = roleMapping[role]?.id
      if(!roleId){
        throw new Error("Invalid role.")
      }
      const assign_body:AssignRoleBodyType = {
        "roles" : [roleId]
      }
      await axios.post(`${auth0BaseUrl}/api/v2/users/${userId}/roles`, assign_body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      });
      // console.log("user created")
      return data;
  } catch (error:any) {
    if(error.response){
      const statusCode = error.response.status;
      const errorMessage = error.response.data.message;
      console.log(`Error occcurs with status code ${statusCode} for email: ${payload.email}, message: ${errorMessage}`)
      throw new Error(`${errorMessage}  Email: ${payload.email}`)
    }
    console.log(error)
    throw error
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
    } catch (err) {
      throw new Error("Fail to get token")
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
    res = RoleArraySchema.parse(res)
    return res
  } catch (error:any) {
    console.log(error?.response?.data?.message??error?.message??error)
    throw new Error(error?.response?.data?.message??error?.message??error)
  }
}

export const sendInvitation = async(access_token:string,receiver_name:string
  ,reciever_mail:string)=>{
  try {
      const sender_email = "tommy07201@gmail.com"//only for testing
      const signing_name ="SQ"
      const formated_addr = "AI Block"
      const subject = "Invitation to AI Block"
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
      await sendMail(subject,formated_addr,sender_email,receiver_name,reciever_mail,url,signing_name)
      console.log(`Invitation mail sent to ${reciever_mail}`)  
  } catch (error:any) {
    console.log(error?.response?.data?.message??error?.message??error)
    throw new Error(error?.response?.data?.message??error?.message??error)
  }
  
}


export const searchUser = async (access_token:string,studentId:string):Promise<RoledUserArrayType>=>{

  const apiUrl = new URL(`?fields=email%2Cuser_metadata%2Cname%2Cuser_id%2Capp_metadata&include_fields=true&email=${studentId}`,`${auth0BaseUrl}/api/v2/users-by-email`)
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
    // console.log(res)
    res = RoledUserArraySchema.parse(res)
    return res
  } catch (error:any) {
    console.log(error?.response?.data?.message??error?.message??error)
    throw new Error(error?.response?.data?.message??error?.message??error)
  }
}

const PutUserBodySchema = z.object({
  user_metadata:z.object({
    enrolled_class_id:z.string().nullish()
  })
})

type PutUserBodyType = z.infer<typeof PutUserBodySchema>


export const updateUser = async (access_token:string,payload:PutUsersReqType) =>{
  const {userId,enrolled_class_id} = payload
  const body:PutUserBodyType ={
    user_metadata:{}
  }
  if(enrolled_class_id !==undefined){
    body.user_metadata.enrolled_class_id =  enrolled_class_id
  }
  // console.log(body)
  try {
    const {data} = await axios.patch(`${auth0BaseUrl}/api/v2/users/${userId}`, body, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
    });
    return UserCreateResponseSchema.parse(data)    
  } catch (error:any) {
    console.log(error?.response?.data?.message??error?.message??error)
    throw new Error(error?.response?.data?.message??error?.message??error)
  }
}

