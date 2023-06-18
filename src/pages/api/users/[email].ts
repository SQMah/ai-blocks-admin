import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  getUserByEmail,
} from "@/lib/auth0_user_management";

import {errorMessage} from "@/lib/utils";
import { adminCheck } from "@/lib/api_utils";
import { z } from "zod";


const handleGet = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    // console.log(req.query)
    const  { email} = req.query;
    if(Array.isArray(email)||!email||email.trim().length === 0||!z.string().email().safeParse(email).success){
        res.status(400).json({message:"Please provide one and only one non-empty email."})
        return
    }
    const token = await getAccessToken()
    const user =  await getUserByEmail(token,email.trim())
    res.status(200).json(user);
    return;
  } catch (error: any) {
    res.status(500).json({message:errorMessage(error,true)})
    return;
  }
};



const handler = async (req: NextApiRequest,res: NextApiResponse) => {
  //configurate for authentication
  if(!await adminCheck(req,res)){
    return
  }
  const method: string | undefined = req.method;
  switch (method) {
    case "GET":
      await handleGet(req, res);
      break;
    default:
      res.status(405).json({message:`${method} is not supported`});
      break;
  }
};

export default handler;
