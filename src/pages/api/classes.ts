import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  checkRole,
} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";

import { createClass ,getClass} from "@/lib/class_management";

import { PutClassesReqSchema } from "@/models/api_schemas";


const requireAdminCheck = false

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

const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const {class_id} = req.query
        if(!class_id) throw new Error("Class ID is required")
        if(Array.isArray(class_id)) throw new Error("Only one class ID")
        const data = await getClass(class_id)
        if(!data){ 
            res.status(404).send("Class not found");
            return 
        }
        res.status(200).json(data)
    } catch (error:any) {
        console.log(error.message??error);
        res.status(500).send(error.message);
}

}

const handlePost = async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const payload = PutClassesReqSchema.parse(req.body)
        const data = await createClass(payload)
        res.status(200).send("success")

    } catch (error:any) {
        console.log(error.message??error);
        res.status(500).send(error.message);
        return false
    }
  };



const handler = async (req: NextApiRequest,res: NextApiResponse) => {
  //configurate for authentication
  if(requireAdminCheck && !await adminCheck(req,res)){
    return
  }
  const method: string | undefined = req.method;
  switch (method) {
    case "GET":
        await handleGet(req,res);
        break;
    case "POST":
      await handlePost(req, res);
      break;
    default:
      res.status(500).send(`${method} is not supported`);
      break;
  }
};

export default handler;
