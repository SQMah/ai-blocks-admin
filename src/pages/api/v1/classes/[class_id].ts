import type { NextApiRequest, NextApiResponse } from "next";


import { APIError, adminCheck,ServerErrorHandler } from "@/lib/api_utils";
import { dbToJSON } from "@/lib/api_utils";
import { DeleteClassesReqSchema, GetClassesReqSchema } from "@/models/api_schemas";
import { TaskHandler } from "@/lib/task-handler";


//get class by class_id
const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const parsing = GetClassesReqSchema.safeParse(req.query)
        if(!parsing.success){
          throw new APIError("Invalid Request Params","Please provide one and only one class ID.")
        }
        const {class_id} = parsing.data
        const taskHandler = new TaskHandler()
        taskHandler.logic.getClassByID(class_id)
        await taskHandler.start()
        const data =taskHandler.getSingleClass(class_id)
        res.status(200).json(dbToJSON(data))
    } catch (error:any) {
      const handler = new ServerErrorHandler(error)
      handler.log()
      handler.sendResponse(req,res)
  }
}

const handleDelete =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const parsing =  DeleteClassesReqSchema.safeParse(req.query)
      if(!parsing.success){
        throw new APIError("Invalid Request Params","Please provide one and only one class ID.")
      }
      const {class_id} = parsing.data
      // const target = await getClass(class_id)
      const th = new TaskHandler()
      th.logic.deleteClassbyID(class_id)
      await th.start()
      res.status(204).end()
  } catch (error:any) {
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
      case "GET":
        await handleGet(req,res);
        break;
      case "DELETE":
        await handleDelete(req,res);
        break
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