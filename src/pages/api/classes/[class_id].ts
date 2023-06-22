import type { NextApiRequest, NextApiResponse } from "next";

import { getClass,deleteClass} from "@/lib/class_management";

import { APIError, adminCheck, serverHandleError } from "@/lib/api_utils";
import { dbToJSON } from "@/lib/api_utils";


//get class by class_id
const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const {class_id} = req.query
        if(!class_id||Array.isArray(class_id)){
          throw new APIError("Invalid Request Params","Please provide one and only one class ID")
        }
        const data = await getClass(class_id)
        // console.log(data)
        res.status(200).json(dbToJSON(data))
    } catch (error:any) {
       serverHandleError(error,req,res)
  }
}

const handleDelete =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const {class_id} = req.query
      if(!class_id||Array.isArray(class_id)){
        throw new APIError("Invalid Request Params","Please provide one and only one class ID.")
      }
      const data = await deleteClass(class_id)
      // console.log(data)
      res.status(204).end()
  } catch (error:any) {
    serverHandleError(error,req,res)
  }
}

const handler = async (req: NextApiRequest,res: NextApiResponse) => {
    //configurate for authentication
    if(!await adminCheck(req,res)){
      return
    }
    const method: string | undefined = req.method;
    switch (method) {
      case "GET":
        await handleGet(req,res);
        break;
      case "DELETE":
        await handleDelete(req,res);
        break
      default:
        res.status(405).json({message:`${method} is not supported`});
        break;
    }
  };
  
  export default handler;