import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
import { batchGetGroupsByIds, createGroup, deleteGroup, updateGroup } from "@/lib/drizzle_functions";
import { batchGetGroupsByIdReqSchema, deleteGroupsReqSchema, postGroupsReqSchema, putGroupsReqSchema } from "@/models/api_schemas";


import type { NextApiRequest, NextApiResponse } from "next";


const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    //log query 
    // console.log(req.query)
    const query  = batchGetGroupsByIdReqSchema.parse(req.query)
    const groups =  await batchGetGroupsByIds(query.group_id)
    // const user = UserSchema.parse(data)
    res.status(200).json(groups);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // console.log(req.body)
    const payload = postGroupsReqSchema.parse(req.body)
    const result = await createGroup(payload)
    // console.log(result)
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
    const payload = putGroupsReqSchema.parse(req.body)
    const {group_id,update}=payload
    const data = await updateGroup(group_id,update)
    res.status(200).json(data);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const {group_id} = deleteGroupsReqSchema.parse(req.query)
    const data = await deleteGroup(group_id)
    console.log("dele/ted group",group_id)
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
