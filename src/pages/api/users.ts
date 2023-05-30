import type { NextApiRequest, NextApiResponse } from "next";
import {
  createUser,
  getAccessToken,
  checkRole,
  searchUser,
  sendInvitation,
  updateUser,
} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";
import {
  RoledUserArrayType,
  UserCreateResponseType,
} from "@/models/auth0_schemas";
import { PatchUsersReqSchema, PostUsersReqSchema,PostUsersResType} from "@/models/api_schemas";


const handleGet = async (req: NextApiRequest,res: NextApiResponse<RoledUserArrayType| string>)=>{
  try {
    let { studentId } = req.query;
    if (studentId == undefined) {
      res.status(500).send("Student ID is required");
      return;
    } else if (Array.isArray(studentId)) {
      studentId = studentId[studentId.length - 1];
    }
    const token = await getAccessToken();
    const users = await searchUser(token, studentId);
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
    const session = await getSession(req, res);
    // console.log(session)
    if (!session?.user?.sub) {
      res.status(401).json("Unauthorized");
      return 
    }
    const token = await getAccessToken();
    const userId = session.user.sub;
    const roles = await checkRole(token, userId);
    if (!roles.includes("admin")) {
      res.status(403).send("Forbidden");
      return 
    }
    const { users } = PostUsersReqSchema.parse(req.body);
    let messages:string[] = []
    await  Promise.all(
      users.map(async (user) => {
        try {
          const { email, first_name, last_name, role, classId, expiration } =
            user;
          const data = await createUser(token,role,email,first_name,last_name,classId,expiration);
          // await sendInvitation(token, data.name, data.email);
          const message = `${role} account for ${data.email} is creacted`
          console.log(message);
          messages = [...messages,message ];
        } catch (error:any) {
          const message = error?.response?.data?.message??error?.message
          if(message){
            messages = [...messages, message]
          }else{
            console.log(error)
          }
        }
      })
    );
    res.status(201).json({messages});
  } catch (error: any) {
    console.log(error);
    res.status(500).send(error.message);
    return 
  }
}

const handlePatch = async (req: NextApiRequest,res: NextApiResponse<UserCreateResponseType| string>)=>{
  try {
    const token =  await getAccessToken()
    const payload = PatchUsersReqSchema.parse(req.body)
    // console.log(payload)
    const data = await updateUser(token,payload)
    // console.log(data)
    res.status(200).json(data);
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
    case "PATCH":
      await handlePatch(req,res)
      break;
    default:
      res.status(500).send(`${method} is not supported`);
      break;
  }
};

export default handler;
