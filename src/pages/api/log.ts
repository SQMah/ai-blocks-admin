import type { NextApiRequest, NextApiResponse } from "next";
import { APIError, adminCheck, ServerErrorHandler } from "@/lib/api_utils";
import{z} from "zod"
import { putLogEvent } from "@/lib/cloud_watch";


const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    // console.log(req.query)
    const schema = z.object({message:z.string()})
    const parsing = schema.safeParse(req.body)
    if(!parsing.success){
        throw new APIError("Bad Request")
    }
    const {message} = parsing.data
    await putLogEvent("REVERT_ERROR",message)
    res.status(204).end()
    return;
  } catch (error: any) {
    const handler = new ServerErrorHandler(error)
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
