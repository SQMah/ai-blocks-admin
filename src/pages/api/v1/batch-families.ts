import {  ServerErrorHandler,adminCheck } from "@/lib/api_utils";
import { batchAddFamily } from "@/lib/db";
import { postBatchFamiliesReqSchema } from "@/models/api_schemas";
import type { NextApiRequest, NextApiResponse } from "next";


const handlePost = async (req:NextApiRequest,res:NextApiResponse) =>{
    try {
      const {emails,group_id} =  postBatchFamiliesReqSchema.parse(req.body)
      const data = await batchAddFamily(emails,group_id)
      res.status(201).json(data)
    } catch (error) {
        const handler = new ServerErrorHandler(error)
        handler.log()
        handler.sendResponse(req,res)
    }
}


const handler = async (req: NextApiRequest,res: NextApiResponse) => {
    //configurate for authentication
    if(!await adminCheck(req,res)){
      return
    }
    const method: string | undefined = req.method;
    switch (method) {
      case "POST":
        await handlePost(req,res);
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

export default handler