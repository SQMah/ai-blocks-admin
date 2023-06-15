import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  checkRole,
} from "@/lib/auth0_user_management";
import { getSession } from "@auth0/nextjs-auth0";
import { v1 as uuidv1 } from 'uuid';


import { createClass ,deleteClass,getClass, updateClass} from "@/lib/class_management";

import {  PostClassesReqSchema,PutClassesReqSchema } from "@/models/api_schemas";
import { dbToJSON,errorMessage ,stringToBoolean} from "@/lib/utils";


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


const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const {class_id} = req.query
      if(!class_id) throw new Error("Class ID is required")
      if(Array.isArray(class_id)) throw new Error("Only one class ID")
      const data = await getClass(class_id)
      if(!data){ 
          res.status(200).json(undefined)
          return 
      }
      // console.log(data)
      res.status(200).json(dbToJSON(data))
  } catch (error:any) {
      res.status(500).end(errorMessage(error,false))
}
}

const handlePost = async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const payload = PostClassesReqSchema.parse(req.body)
        const id = uuidv1()
        const data = await createClass(payload,id)
        res.status(201).json(dbToJSON(data))

    } catch (error:any) {
        res.status(500).end(errorMessage(error,true))
    }
  };

const handlePut = async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      // console.log(req.body)
      const payload = PutClassesReqSchema.parse(req.body)
      const data = await updateClass(payload)
      res.status(200).json(dbToJSON(data))

  } catch (error:any) {
    res.status(500).end(errorMessage(error,true))
  }
};

const handleDelete =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const {class_id} = req.query
      if(!class_id) throw new Error("Class ID is required")
      if(Array.isArray(class_id)) throw new Error("Only one class ID")
      const data = await deleteClass(class_id)
      // console.log(data)
      res.status(204).end()
  } catch (error:any) {
    res.status(500).end(errorMessage(error,true))
  }
}

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
    case "PUT":
      await handlePut(req,res);
      break;
    case "DELETE":
      await handleDelete(req,res);
      break;
    default:
      res.status(500).send(`${method} is not supported`);
      break;
  }
};

export default handler;
