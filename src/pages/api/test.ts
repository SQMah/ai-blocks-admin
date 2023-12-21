import { APIError, ServerErrorHandler } from "@/lib/api_utils";
import { test } from "@/lib/drizzle_functions";
import { postGroupsReqSchema, postGroupsResSchema, postUsersReqSchema, postUsersResSchema } from "@/models/api_schemas";
import type { NextApiRequest, NextApiResponse } from "next"


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      let result = {}
      // const body = postGroupsReqSchema.parse(req.body)
      const data = await test()
      console.log('data:',data)
      // result = postGroupsResSchema.parse(data)
      result =data
      return res.json(result)
      
    } catch (error) {
      // console.log("api side",error,error instanceof APIError)
      const handler = new ServerErrorHandler(error)
      handler.log()
      handler.sendResponse(req,res)
    }
};
  
  export default handler;