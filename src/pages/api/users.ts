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
import {
  PutUsersReqSchema,
  PostUsersReqSchema,
  PostUsersResType,
  UserCreateDataType,
} from "@/models/api_schemas";
import { delay ,removeDuplicates,errorMessage,stringToBoolean} from "@/lib/utils";

const requireAdminCheck = stringToBoolean(process.env.REQUIRE_ADMIN)??true

const adminCheck = async (req: NextApiRequest,res: NextApiResponse<any>): Promise<boolean> => {
  try {
    const session = await getSession(req, res);
    // console.log(session)
    if (!session?.user?.sub) {
      res.status(401).json({message:"Unauthorized"});
      return false
    }
    const token = await getAccessToken();
    const userId = session.user.sub;
    const roles = await checkRole(token, userId);
    if (!roles.includes("admin")) {
      res.status(403).send({message:"Forbidden"});
      return false
    }
    return true
  } catch (error:any) {
    console.log(error);
    res.status(500).send(error.message);
    return false
  }
};

const handleGet = async (
  req: NextApiRequest,
  res: NextApiResponse<RoledUserArrayType | string>
) => {
  try {
    // console.log(req.query)
    let  { email,enrolled_class_id,teaching_class_ids,type} = req.query;
    const inputs = [email,enrolled_class_id,teaching_class_ids]
    .map(input=>{
      if(input===undefined) return undefined
      if(!Array.isArray(input)) return [input]
      return removeDuplicates(input)
    })
    const  query = {
      email:inputs[0],
      enrolled_class_id:inputs[1],
      teaching_class_ids:inputs[2],
    }
    const searchType = type==="AND"||type==="OR"?type:undefined
    // console.log(query,searchType)
    const token = await getAccessToken();
    const users = await searchUser(token, query,searchType);
    res.status(200).json(users);
    return;
  } catch (error: any) {
    res.status(500).end(errorMessage(error,true))
    return;
  }
};

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse<PostUsersResType | string>
) => {
  try {
    const token = await getAccessToken();
    const {user,users,role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date,}
     = PostUsersReqSchema.parse(req.body);
    let success =0;
    let fail = 0
    let details:string[] = []
    if (users?.length) {
      if (!role) throw new Error("Role is required for batch create.");
      for (const index in users) {
        const { email, first_name, last_name } = users[index];
        try {
          const payload: UserCreateDataType = {
            email,
            first_name,
            last_name,
            role,
            enrolled_class_id,
            teaching_class_ids,
            available_modules,
            account_expiration_date,
          };
          const data = await createUser(token, payload);
          await sendInvitation(token, data.name, data.email)
          success+=1;
          const message = `account creation for ${data.email} is done`;
          details.push(message)
          console.log(message);
        } catch (error: any) {
          const message = errorMessage(error,true)
          details.push(message)
          fail+=1
        }
        await delay(500);
      }
    }
    if (user) {
      try {
        const data = await createUser(token, user);
        success +=1
        await sendInvitation(token, data.name, data.email);
        const message = `account creation for ${data.email} is done`;
        console.log(message);
        details.push(message)
      } catch (error: any) {
        const message = errorMessage(error,true)
        details.push(message)
        if (!message) {
          const waring = `Fail to process data at email:${
            user?.email ?? "error"
          }`;
          console.log(waring, error);
          details.push(waring)
        }
        fail+=1
      }
    }
    res.status(success>=1 ? 201 : 500).json({ message:`
    Successful case${success>1?"s":""}: ${success} | Failed case${fail>1?"s":""}: ${fail}
    `,details});
    return;
  } catch (error: any) {
    res.status(500).end(errorMessage(error,true))
    return;
  }
};

const handlePut = async (
  req: NextApiRequest,
  res: NextApiResponse<UserCreateResponseType | string>
) => {
  try {
    const token = await getAccessToken();
    const payload = PutUsersReqSchema.parse(req.body);
    // console.log(payload)
    const roles = await checkRole(token, payload.userId);
    const data = await updateUser(token, payload, roles);
    // console.log(data)
    res.status(200).json(data);
    return;
  } catch (error: any) {
    res.status(500).end(errorMessage(error,true))
    return;
  }
};

const handleDelete = async (
  req: NextApiRequest,
  res: NextApiResponse<string>
) => {
  try {
    const token = await getAccessToken();
    let { userId } = req.query;
    if (userId == undefined) {
      res.status(500).send("Student ID is required");
      return;
    } else if (Array.isArray(userId)) {
      userId = userId[userId.length - 1];
    }
    const data = await deleteUser(token, userId);
    console.log(`deleted user, user_id: ${userId}`);
    res.status(204).end();
    return;
  } catch (error: any) {
    res.status(500).end(errorMessage(error,true))
    return;
  }
};

const handler = async (req: NextApiRequest,res: NextApiResponse<RoledUserArrayType | PostUsersResType | UserCreateResponseType | string>) => {
  //configurate for authentication
  if(requireAdminCheck && !await adminCheck(req,res)){
    return
  }
  const method: string | undefined = req.method;
  switch (method) {
    case "GET":
      await handleGet(req, res);
      break;
    case "POST":
      await handlePost(req, res);
      break;
    case "PUT":
      await handlePut(req, res);
      break;
    case "DELETE":
      await handleDelete(req, res);
      break;
    default:
      res.status(500).send(`${method} is not supported`);
      break;
  }
};

export default handler;
