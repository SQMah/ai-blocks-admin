import axios, { AxiosError } from "axios";
import generatePassword from "./generate_password";
import { z } from "zod";
import {  zodErrorMessage } from "./utils";
import { APIError } from "./api_utils";
import { auth0UserSchema } from "@/models/auth0_schemas";
import { EmailParam } from "./task-handler";

const auth0BaseUrl = process.env.AUTH0_ISSUER_BASE_URL;

if (!auth0BaseUrl) throw new Error("AUTH 0 ISSUER IS NOT DEFINDED");

const handleAuth0Error = (error: any) => {
  if (error instanceof APIError) {
    return error;
  }
  if (error instanceof z.ZodError) {
    return new APIError("Auth0 Error", zodErrorMessage(error.issues));
  } else if (error instanceof AxiosError) {
    if (error.response) {
      const statusCode = error.response.status;
      const message = error.response.data?.message;
      switch (statusCode) {
        case 400:
          return new APIError(
            "Bad Request",
            message ?? "Invalid request to Auth0"
          );
          break;
        case 404:
          return new APIError(
            "Resource Not Found",
            message ?? "User not found"
          );
        case 409:
          return new APIError("Conflict", message ?? "Unknown Conflict");
        case 429:
          return new APIError(
            "Internal Server Error",
            message ?? "Reach Auth0 Rate Limit"
          );
        default:
          return new APIError(
            "Internal Server Error",
            message ?? "Auth0 Request Error" + `, Status ${statusCode}`
          );
      }
    }
  }
  return new APIError(
    "Internal Server Error",
    `Auth0 Action Failure, message:${error.message ?? "Unknown Error"}`
  );
}


export async function createAuth0Account(
  access_token: string,
  email:string,
  name:string
){
  try {
    const create_body= {
      connection: "Username-Password-Authentication",
      email,
      name,
      password: generatePassword(),
      verify_email: false,
    };
    const response = await axios.post(
      `${auth0BaseUrl}/api/v2/users`,
      create_body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    //shd be an seperate call
    //await assignRole(access_token,userId,role)
    console.log(`Auth0 account for ${email} is creacted`);
    const user = auth0UserSchema.parse(response.data)
    return user;
  } catch (error: any) {
    throw handleAuth0Error(error);
  }
}

export async function getAccessToken(): Promise<string> {
  const body = {
    grant_type: "client_credentials",
    client_id: process.env.AUTH0_API_CLIENT_ID,
    client_secret: process.env.AUTH0_API_CLIENT_SECRET,
    audience: process.env.AUTH0_API_BASE_URL,
  };

  //console.log(body)
  try {
    const response = await axios.post(`${auth0BaseUrl}/oauth/token`, body);
    //console.log('token:',response.data.access_token)
    const token = z.string().parse(response.data.access_token);
    return token;
  } catch (error: any) {
    throw handleAuth0Error(error);
  }
}

 

export const getInvitationPramas = async (
  access_token: string,
  email: string,
  name:string,
):Promise<EmailParam> => {
  try {
    const body = {
      client_id: process.env.AUTH0_CLIENT_ID,
      connection_id: process.env.AUTH0_DB_CONNECTION_ID,
      email
    };
    const { data } = await axios.post(
      `${auth0BaseUrl}/api/v2/tickets/password-change`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    const {ticket} = data
    if(!ticket) throw new APIError("Auth0 Error",`Fail to get Change Password ticket for ${email}`)
    const url = ticket + "#type=invite" + "#app=AIBlock";
    // console.log(url)
    // console.log(`Invitation mail sent to ${reciever_mail}`);
    return {url,email,name}
  } catch (error: any) {
    throw handleAuth0Error(error);
  }
};





export const getAuth0UserByEmail = async (access_token: string, email: string) => {
  try {
    const response = await axios.get(
      `${auth0BaseUrl}/api/v2/users-by-email?email=${email}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    // console.log(response.data)
    const data = response.data;
    if (!Array.isArray(data))
      throw new APIError("Auth0 Error", "Fail to parse user data");
    // console.log(data)
    if (data.length === 0)
      throw new APIError("Resource Not Found", "User not found");
    return auth0UserSchema.parse(data[0])
  } catch (error: any) {
    // console.log(error)
    throw handleAuth0Error(error);
  }
};


type UserUpdate ={
  name:string
}

export const updateAuth0User = async (
  access_token: string,
  email:string,
  payload:UserUpdate,
) => {
  const {
    name
  } = payload;
  const body ={
    name
  }
  try {
    const target = await getAuth0UserByEmail(access_token,email)
    const { data } = await axios.patch(
      `${auth0BaseUrl}/api/v2/users/${target.user_id}`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    return data
  } catch (error: any) {
    throw handleAuth0Error(error);
  }
};


export const deleteAuth0Account = async (access_token: string, email:string) => {
  try {
    const user = await getAuth0UserByEmail(access_token,email)
    // console.log('enetered delteuser')
    const response = await axios.delete(
      `${auth0BaseUrl}/api/v2/users/${user.user_id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    return user ;
  } catch (error: any) {
    throw handleAuth0Error(error);
  }
};






