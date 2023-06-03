import type { NextApiRequest, NextApiResponse } from "next";
import {
  createUser,
  getAccessToken,
  checkRole,
  searchUser,
  sendInvitation,
  updateUser,
  deleteUser,
} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";
import {
  RoledUserArrayType,
  UserCreateResponseType,
} from "@/models/auth0_schemas";
import { PutUsersReqSchema, PostUsersReqSchema,PostUsersResType, UserCreateDataType} from "@/models/api_schemas";
import { delay } from "@/lib/utils";


const handleGet = async (req: NextApiRequest,res: NextApiResponse<RoledUserArrayType| string>)=>{
  try {
    let { email} = req.query;
    if (email == undefined) {
      res.status(500).send("Student ID is required");
      return;
    } else if (Array.isArray(email)) {
      email = email[email.length - 1];
    }
    const token = await getAccessToken();
    const users = await searchUser(token, email);
    res.status(200).json(users);
    return;
  } catch (error: any) {
    console.log(error.message || error);
    res.status(500).send(error.message || error);
    return;
  }
}

const handlePost = async (req: NextApiRequest,res: NextApiResponse<PostUsersResType| string>)=>{
  try {
    // console.log(req.body)
    // const session = await getSession(req, res);
    // // console.log(session)
    // if (!session?.user?.sub) {
    //   res.status(401).json("Unauthorized");
    //   return 
    // }
    const token = await getAccessToken();
    // const userId = session.user.sub;
    // const roles = await checkRole(token, userId);
    // if (!roles.includes("admin")) {
    //   res.status(403).send("Forbidden");
    //   return 
    // }
    const { user,users ,role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} = PostUsersReqSchema.parse(req.body);
    let success:boolean = false
    let messages:string[] = []
    if(users?.length){
      if(!role) throw new Error("Role is required for batch create.")
      for(const index in users){
        const {email,first_name,last_name} = users[index]
        try {
          const payload:UserCreateDataType ={
            email,first_name,last_name,role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date
          }
          const data = await createUser(token,payload);
          sendInvitation(token, data.name, data.email).then(()=>{
            const message = `account creation for ${data.email} is done`
            console.log(message);
            success=true;
            messages = [...messages,message]
          }).catch(err=>console.log(err))
        } catch (error:any) {
          const message = String(error?.response?.data?.message??error?.message)
          if(message){
            messages = [...messages,message]
          }else{
            const waring = `Fail to process data at index ${index}, email:${user?.email??"error"}`
            console.log(waring,error)
            messages = [...messages,error]
          }
        }
        await delay(1000)
      }
    }
    if(user){
      try {
        const data = await createUser(token,user);
        await sendInvitation(token, data.name, data.email);
        const message = `account creation for ${data.email} is done`
        console.log(message);
        success=true;
        messages = [...messages,message]
      } catch (error:any) {
        const message = String(error?.response?.data?.message??error?.message)
        if(message){
          messages =[...messages,message]
        }else{
          const waring = `Fail to process data at email:${user?.email??"error"}`
          console.log(waring,error)
          messages =[...messages,waring]
        }
      }
    }
    // console.log(messages)
    res.status(success?201:500).json({messages});
    return
  } catch (error: any) {
    console.log(error);
    res.status(500).send(error.message);
    return 
  }
}

const handlePut = async (req: NextApiRequest,res: NextApiResponse<UserCreateResponseType| string>)=>{
  try {
    const token =  await getAccessToken()
    const payload = PutUsersReqSchema.parse(req.body)
    // console.log(payload)
    const roles = await checkRole(token,payload.userId)
    const data = await updateUser(token,payload,roles)
    // console.log(data)
    res.status(200).json(data);
    return
  } catch (error: any) {
    console.log(error);
    res.status(500).send(error.message);
    return 
  }
}

const handleDelete = async (req: NextApiRequest,res: NextApiResponse<string>)=>{
  try {
    const token =  await getAccessToken()
    let {userId} = req.query;
    if (userId == undefined) {
      res.status(500).send("Student ID is required");
      return;
    } else if (Array.isArray(userId)) {
      userId = userId[userId.length - 1];
    }
    const data = await deleteUser(token,userId)
    console.log(`deleted user, user_id: ${userId}`)
    res.status(204).send(data);
    return
  } catch (error: any) {
    console.log(error);
    res.status(500).send(error.message);
    return 
  }
}



const handler = async (req: NextApiRequest,res: NextApiResponse<RoledUserArrayType | PostUsersResType|UserCreateResponseType|string >) => {
  const method:string|undefined = req.method;
  switch(method){
    case  "GET":
      await handleGet(req,res);
      break;
    case "POST":
      await handlePost(req,res);
      break;
    case "PUT":
      await handlePut(req,res)
      break;
    case "DELETE":
      await handleDelete(req,res)
      break;
    default:
      res.status(500).send(`${method} is not supported`);
      break;
  }
};

export default handler;
