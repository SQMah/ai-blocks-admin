import axios, { AxiosResponse } from 'axios';
import generatePassword from './generate_password';
import { UserRole,UserCreationResponseData,UserCreationRequestBody,AssignRoleRaequestBody,roleResponseEntry } from '@/type/auth0_interfaces';
import { sendMail } from './mail_sender';

const auth0BaseUrl = process.env.AUTH0_ISSUER_BASE_URL;

const roleName_to_roleId ={
  "admin":"rol_YHRhJdPKTdNaTEPp",
  "managedStudent":"rol_FLZfpiWTljn9jiOd",
  "teacher":"rol_tEgERFGnK2D82MFC",
  "unmanagedStudent":"rol_IBB3Y72SjYuP3tNP"
}


export async function createUser(access_token:string,email: string,first_name:string,last_name:string,role:UserRole="unmanagedStudent", password: string|undefined=undefined,invited:boolean=true): Promise<UserCreationResponseData> {
  try {
    const create_body:UserCreationRequestBody = {
      "connection": "Username-Password-Authentication",
      "email": email,
      "password": password||generatePassword(),
      "verify_email": false,
      "given_name": first_name,
      "family_name": last_name,
      "name": `${first_name} ${last_name}`,
      "user_metadata": {
        "class_ids": [],
      },
      "app_metadata":{}
    }
    if(!(role in roleName_to_roleId)) throw new Error("Invalid role")
    const {data}: AxiosResponse<UserCreationResponseData> = await axios.post(`${auth0BaseUrl}/api/v2/users`, create_body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      });
      const userId:string = data.user_id
      const roleId:string = roleName_to_roleId[role]
      const assign_body:AssignRoleRaequestBody = {
        "roles" : [roleId]
      }
      // console.log("user created")
     await axios.post(`${auth0BaseUrl}/api/v2/users/${userId}/roles`, assign_body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      });
      // console.log("role assigned")
      if(invited){
        await sendInvitation(access_token,`${first_name} ${last_name}`,email)
      }
      return data;
  } catch (error:any) {
    if(error.response){
      const statusCode = error.response.status;
      const errorMessage = error.response.data.message;
      console.log(`Error occcurs with status code ${statusCode} for email: ${email}, message: ${errorMessage}`)
      throw new Error(`${errorMessage}  Email: ${email}`)
    }
    console.log(error)
    throw new Error("Unkown error")
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
      const response: AxiosResponse<any> = await axios.post(`${auth0BaseUrl}/oauth/token`,body);
      //console.log('token:',response.data.access_token)
      return response.data.access_token;
    } catch (err) {
      throw new Error("Fail to get token")
    }
    
}



export const checkRole = async(access_token:string,userId:string):Promise<string[]> =>{
  try {
    const {data}: AxiosResponse<roleResponseEntry[]> = await axios.get(`${auth0BaseUrl}/api/v2/users/${userId}/roles`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
    });
    return data.map((role:roleResponseEntry)=>role.name)
  } catch (error:any) {
    console.log(error.response.data.message||error.message)
    throw new Error(error.response.data.message||error.message)
  }
}

export const sendInvitation = async(access_token:string,receiver_name:string
  ,reciever_mail:string)=>{
  try {
      const sender_email = "tommy07201@gmail.com"//only for testing
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
      await sendMail("Invitation to AI Block","AI Block",sender_email,receiver_name,reciever_mail,url,"SQ")
      console.log(`Invitation mail sent to ${reciever_mail}`)  
  } catch (error:any) {
    console.log(error.response.data.message||error.message)
    throw new Error(error.response.data.message||error.message)
  }
  
}



interface query{
  name?:string;
  email?:string;
  userId?:string;
}

export const searchUser = async (access_token:string,query:query)=>{
  let queryHolder:string[] = [];
  //adjust if axact search is needed
  if(query.name) queryHolder = [...queryHolder,query.name.length>=3?`name:*${query.name}*`:`name:${query.name}`];
  if(query.email) queryHolder = [...queryHolder,`email:${query.email}`];
  if(query.userId) queryHolder = [...queryHolder,`user_id:${query.userId}`]
  const queryString = queryHolder.join("%20AND%20")
  const apiUrl = new URL(`?q=${queryString}`,`${auth0BaseUrl}/api/v2/users`)
  // console.log(apiUrl.href)
  try {
    const {data} = await axios.get(apiUrl.href,{
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    return data
  } catch (error:any) {
    console.log(error.response.message||error.message)
    throw new Error(error.response.message||error.message)
  }
  

}