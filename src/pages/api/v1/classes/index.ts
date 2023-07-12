import type { NextApiRequest, NextApiResponse } from "next";

import { v1 as uuidv1 } from "uuid";

import {
  BatchGetClassesReqSchema,
  PostClassesReqSchema,
  PutClassesReqSchema,
  DeleteClassesReqSchema,
} from "@/models/api_schemas";
import {  zodErrorMessage } from "@/lib/utils";

import {
  adminCheck,
  APIError,
  ServerErrorHandler,
  dbToJSON,
} from "@/lib/api_utils";
import { TaskHandler } from "@/lib/task-handler";

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const parsing = BatchGetClassesReqSchema.safeParse(req.query);
    if (!parsing.success) {
      throw new APIError(
        "Invalid Request Params",
        "Please provide some class_id"
      );
    }
    const classIDs = parsing.data.class_id;
    const taskHandler = new TaskHandler();
    taskHandler.logic.batchGetClass(classIDs)
    await taskHandler.start();
    const data = taskHandler.getClasses(classIDs)
    res.status(200).json(data.map((entry) => dbToJSON(entry)));
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const parsing = PostClassesReqSchema.safeParse(req.body);
    if (!parsing.success) {
      throw new APIError(
        "Invalid Request Body",
        zodErrorMessage(parsing.error.issues)
      );
    }
    const payload = parsing.data;
    // const token = await  getAccessToken()
    // const emails = removeDuplicates(payload.teacher_ids)
    // //valdiate valid teachers
    // const searched = (await searchUser(token,{email:emails},"OR"))
    // .filter(teacher=>teacher.roles.includes("teacher"))
    // const searchedEmails = removeDuplicates(searched.map(teacher=>teacher.email))
    // const missing = emails.filter(email=>!searchedEmails.includes(email))
    // if(missing.length){
    //   throw new APIError("Invalid Request Body",`${missing.join(", ")} are not valid teacher ids`)
    // }
    const id = uuidv1();
    // const data = await createClass(payload,id)
    // for(const teacher of searched){
    //   const newClasses = teacher.user_metadata?.teaching_class_ids??[]
    //   newClasses.push(data.class_id)
    //   await updateUser(token,{
    //     userId:teacher.user_id,
    //     content:{teaching_class_ids:newClasses}
    //   },teacher.roles)
    //   await delay(500)
    // }
    const taskHandler = new TaskHandler();
    taskHandler.logic.createClass(payload, id);
    await taskHandler.start();
    const data = taskHandler.getSingleClass(id);
    res.status(201).json(dbToJSON(data));
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // console.log(req.body)
    const parsing = PutClassesReqSchema.safeParse(req.body);
    if (!parsing.success) {
      throw new APIError(
        "Invalid Request Body",
        zodErrorMessage(parsing.error.issues)
      );
    }
    const payload = PutClassesReqSchema.parse(req.body);
    // //will check for vlaid id and capacity,throw error if invalid
    // await classUpdatable(payload);
    // const data = await updateClass(payload);
    const th = new TaskHandler()
    th.logic.updateClass(payload)
    await th.start()
    const data = th.getSingleClass(payload.class_id)
    res.status(200).json(dbToJSON(data));
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handleDelete =async (req: NextApiRequest,res: NextApiResponse) => {
  try {
      const parsing =  DeleteClassesReqSchema.safeParse(req.query)
      if(!parsing.success){
        throw new APIError("Invalid Request Params","Please provide one and only one class ID.")
      }
      const {class_id} = parsing.data
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

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  //configurate for authentication
  if (!(await adminCheck(req, res))) {
    return;
  }
  const method: string | undefined = req.method;
  switch (method) {
    case "GET":
      await handleGet(req, res);
      break;
    case "POST":
      await handlePost(req, res);
      break;
    case "PUT":
      await handlePut(req, res);
      break;
    case "DELETE":
      await handleDelete(req,res);
      break;
    default:
      res.status(405).json({
        status: 405,
        message: `${method} is not supported`,
        details: {
          resource: req.url,
          method: req.method,
        },
      });
      break;
  }
};

export default handler;
