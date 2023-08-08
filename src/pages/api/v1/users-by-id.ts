import type { NextApiRequest, NextApiResponse } from "next";
import { APIError, adminCheck, ServerErrorHandler } from "@/lib/api_utils";
import { getAccessToken, getInvitationPramas } from "@/lib/auth0_user_management";
import { getUsersByIdReqSchema } from "@/models/api_schemas";
import { findUserById } from "@/lib/db";



const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const {user_id,roles} = getUsersByIdReqSchema.parse(req.query)
      const users =  await findUserById(user_id,roles)
      // const user = UserSchema.parse(data)
      res.status(200).json(users);
    } catch (error) {
      const handler = new ServerErrorHandler(error);
      handler.log();
      handler.sendResponse(req, res);
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
