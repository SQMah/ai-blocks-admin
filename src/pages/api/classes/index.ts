import type { NextApiRequest, NextApiResponse } from "next";

import { v1 as uuidv1 } from 'uuid';
import {z} from "zod"

import { scanClass, createClass , updateClass} from "@/lib/class_management";

import {  PostClassesReqSchema,PutClassesReqSchema } from "@/models/api_schemas";
import { dbToJSON,errorMessage } from "@/lib/utils";

import { adminCheck } from "@/lib/api_utils";





const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const {class_id} = req.query
      // console.log(class_id)
      if(!class_id){
        res.status(400).json({message:"Please provide a class_id"})
        return 
      }
      const classIDs = Array.isArray(class_id)?class_id:[class_id]
      const data = await scanClass(classIDs)
      // console.log(data)
      res.status(200).json(data.map(entry=>dbToJSON(entry)))
  } catch (error:any) {
    res.status(500).json({message:errorMessage(error,true)})
  }
}

const handlePost = async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const payload = PostClassesReqSchema.parse(req.body)
        const id = uuidv1()
        const data = await createClass(payload,id)
        res.status(201).json(dbToJSON(data))

    } catch (error:any) {
      if(error instanceof z.ZodError){
        res.status(400).json({message:"Invalid body content type"})
        return
      }
      res.status(500).json({message:errorMessage(error,true)})
    }
  };

const handlePut = async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      // console.log(req.body)
      const payload = PutClassesReqSchema.parse(req.body)
      const data = await updateClass(payload)
      res.status(200).json(dbToJSON(data))

  } catch (error:any) {
    if(error instanceof z.ZodError){
      res.status(400).json({message:"Invalid body content type"})
      return
    }
    res.status(500).json({message:errorMessage(error,true)})
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
      await handleGet(req,res);
      break;
    case "POST":
      await handlePost(req, res);
      break;
    case "PUT":
      await handlePut(req,res);
      break;
    default:
      res.status(405).json({message:`${method} is not supported`});
      break;
  }
};

export default handler;
