import type { NextApiRequest, NextApiResponse } from "next";

import { v1 as uuidv1 } from 'uuid';

import { scanClass, createClass , updateClass, classUpdatable} from "@/lib/class_management";

import {  BatchGetClassesReqSchema, PostClassesReqSchema,PutClassesReqSchema } from "@/models/api_schemas";
import {  removeDuplicates ,delay, zodErrorMessage} from "@/lib/utils";

import { adminCheck ,APIError,serverErrorHandler,dbToJSON} from "@/lib/api_utils";
import { getAccessToken, searchUser, updateUser } from "@/lib/auth0_user_management";





const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const parsing = BatchGetClassesReqSchema.safeParse(req.query)
      if(!parsing.success){
        throw new APIError("Invalid Request Params","Please provide some class_id")
      }
      const classIDs = parsing.data.class_id
      const data = await scanClass(classIDs)
      // console.log(data)
      res.status(200).json(data.map(entry=>dbToJSON(entry)))
  } catch (error:any) {
    const handler = new serverErrorHandler(error)
    handler.log()
    handler.sendResponse(req,res)
  }
}

const handlePost = async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const parsing = PostClassesReqSchema.safeParse(req.body)
        if(!parsing.success){
          throw new APIError("Invalid Request Body",zodErrorMessage(parsing.error.issues))
        }
        const payload = parsing.data
        const token = await  getAccessToken()
        const emails = removeDuplicates(payload.teacher_ids)
        //valdiate valid teachers
        const searched = (await searchUser(token,{email:emails},"OR"))
        .filter(teacher=>teacher.roles.includes("teacher"))
        const searchedEmails = removeDuplicates(searched.map(teacher=>teacher.email))
        const missing = emails.filter(email=>!searchedEmails.includes(email))
        if(missing.length){
          throw new APIError("Invalid Request Body",`${missing.join(", ")} are not valid teacher ids`)
        }
        const id = uuidv1()
        const data = await createClass(payload,id)
        for(const teacher of searched){
          const newClasses = teacher.user_metadata?.teaching_class_ids??[]
          newClasses.push(data.class_id)
          await updateUser(token,{
            userId:teacher.user_id,
            content:{teaching_class_ids:newClasses}
          },teacher.roles)
          await delay(500)
        }
        res.status(201).json(dbToJSON(data))

    } catch (error:any) {
      const handler = new serverErrorHandler(error)
      handler.log()
      handler.sendResponse(req,res)
    }
  };

const handlePut = async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      // console.log(req.body)
      const parsing = PutClassesReqSchema.safeParse(req.body)
      if(!parsing.success){
        throw new APIError("Invalid Request Body",zodErrorMessage(parsing.error.issues))
      }
      const payload = PutClassesReqSchema.parse(req.body)
      //will check for vlaid id and capacity,throw error if invalid
      await classUpdatable(payload)
      const data = await updateClass(payload)
      res.status(200).json(dbToJSON(data))
  } catch (error:any) {
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
