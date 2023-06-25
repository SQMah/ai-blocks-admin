import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  getUserByEmail,
} from "@/lib/auth0_user_management";

import { APIError, adminCheck, serverErrorHandler } from "@/lib/api_utils";
import { z } from "zod";


const handleGet = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    // console.log(req.query)
    const  { email} = req.query;
    const parsing = z.string().email().safeParse(email)
    if(!parsing.success){
        throw new APIError("Invalid Request Params","Please provide one and only one email.")
    }
    const token = await getAccessToken()
    const user =  await getUserByEmail(token,parsing.data)
    res.status(200).json(user);
    return;
  } catch (error: any) {
    const handler = new serverErrorHandler(error)
    handler.log()
    handler.sendResponse(req,res)
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
      res.status(405).json({
        status:405,
        message:`${method} is not supported`,
        details:{
          resource: req.url,
          method: req.method
        }
      });
      break;
  }
};

export default handler;
