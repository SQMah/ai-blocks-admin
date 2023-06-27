import type { NextApiRequest, NextApiResponse } from "next";
import {
  getAccessToken,
  getUserByEmail,
  sendInvitation,
} from "@/lib/auth0_user_management";

import { APIError, adminCheck, serverErrorHandler } from "@/lib/api_utils";
import { PostInvitationReqSchema } from "@/models/api_schemas";


const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    // console.log(req.query)
    const schema = PostInvitationReqSchema
    const parsing = schema.safeParse(req.query)
    if(!parsing.success){
        throw new APIError("Invalid Request Params","Please provide one and only one email")
    }
    const token = await getAccessToken()
    const {email} = parsing.data
    const user = await getUserByEmail(token,email)
    // console.log(user)
    await sendInvitation(token,user.name,email)
    res.status(204).end()
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
    case "POST":
      await handlePost(req, res);
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
