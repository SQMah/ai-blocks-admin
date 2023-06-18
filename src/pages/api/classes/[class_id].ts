import type { NextApiRequest, NextApiResponse } from "next";

import { getClass,deleteClass} from "@/lib/class_management";

import { dbToJSON ,errorMessage} from "@/lib/utils";
import { adminCheck } from "@/lib/api_utils";



const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const {class_id} = req.query
        if(!class_id||Array.isArray(class_id)){
          res.status(400).json({message:"Please provide one and only one class ID"})
          return
        }
        const data = await getClass(class_id)
        if(!data){ 
            res.status(200).json(undefined)
            return 
        }
        // console.log(data)
        res.status(200).json(dbToJSON(data))
    } catch (error:any) {
        res.status(500).json({message:errorMessage(error,false)})
  }
}

const handleDelete =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const {class_id} = req.query
      if(!class_id||Array.isArray(class_id)){
        res.status(400).json({message:"Please provide one and only one class ID."})
        return
      }
      const data = await deleteClass(class_id)
      // console.log(data)
      res.status(204).end()
  } catch (error:any) {
    res.status(500).json({message:errorMessage(error,true)})
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