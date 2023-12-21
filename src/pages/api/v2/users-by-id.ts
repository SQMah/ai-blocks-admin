import type { NextApiRequest, NextApiResponse } from "next";
import { APIError, adminCheck, ServerErrorHandler } from "@/lib/api_utils";
import { getUserByIdReqSchema } from "@/models/api_schemas";
import { getUserById } from "@/lib/drizzle_functions";




const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const  query = getUserByIdReqSchema.parse(req.query)
      const users =  await getUserById(query.userId)
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
