import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
import { createUserManages, deleteUserManages, getEnrolledGroups, getMangedGroups, updateUserManages } from "@/lib/drizzle_functions";
import { getUserManagesReqSchema,postUserManagesReqSchema,putUserManagesReqSchema,deleteUserManagesReqSchema} from "@/models/api_schemas";


import type { NextApiRequest, NextApiResponse } from "next";


const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const query  = getUserManagesReqSchema.parse(req.query)
    const users =  await getMangedGroups(query.email)
    // const user = UserSchema.parse(data)
    res.status(200).json(users);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const {email,group_id} = postUserManagesReqSchema.parse({...req.query,...req.body})
    const result = await createUserManages(email,group_id)
    // const user = UserSchema.parse(data)
    res.status(201).json(result);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const payload = putUserManagesReqSchema.parse({...req.query,...req.body})
    const {email,add,remove}=payload
    const data = await updateUserManages(email,add,remove)
    res.status(200).json(data);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const {email,group_id} = deleteUserManagesReqSchema.parse({...req.query,...req.body})
    const data = await deleteUserManages(email,group_id)
    // const user = UserSchema.parse(data)
    res.status(204).end();
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

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
      await handleDelete(req, res);
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
