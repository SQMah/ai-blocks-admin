import type { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, getUserByEmail } from "@/lib/auth0_user_management";

import { APIError, adminCheck, ServerErrorHandler } from "@/lib/api_utils";
import { DeleteUsersByEmailReqSchema, GetUsersReqSchema, UpdateUserByEmailReqSechema } from "@/models/api_schemas";
import { TaskHandler } from "@/lib/task-handler";
import { zodErrorMessage } from "@/lib/utils";

const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    // console.log(req.query)
    // const  { email} = req.query;
    const parsing = GetUsersReqSchema.safeParse(req.query);
    if (!parsing.success) {
      throw new APIError(
        "Invalid Request Params",
        "Please provide one and only one email."
      );
    }
    const { email } = parsing.data;
    const taskHandler = new TaskHandler();
    taskHandler.logic.findUserByEmail(email);
    await taskHandler.start();
    const user = taskHandler.getSingleUser(email);
    res.status(200).json(user);
    return;
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const parsing = UpdateUserByEmailReqSechema.safeParse({...req.query,...req.body});
    if (!parsing.success) {
      throw new APIError(
        "Invalid Request Body",
        zodErrorMessage(parsing.error.issues)
      );
    }
    const { email,content } = parsing.data;
    const taskHandler = new TaskHandler();
    taskHandler.logic.updateUserByEmail(email,content)
    await taskHandler.start();
    const data = taskHandler.getSingleUser(email)
    res.status(200).json(data);
    return;
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const parsing = DeleteUsersByEmailReqSchema.safeParse(req.query);
    if (!parsing.success) {
      throw new APIError(
        "Invalid Request Params",
        "Please provide one and only one email."
      );
    }
    const { email } = parsing.data;
    const taskHandler = new TaskHandler();
    taskHandler.logic.deleteUserByEmail(email)
    await taskHandler.start();
    res.status(204).end();
    return;
  } catch (error: any) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  // console.log(req.method)
  //configurate for authentication
  if (!(await adminCheck(req, res))) {
    return;
  }
  const method: string | undefined = req.method;
  switch (method) {
    case "GET":
      await handleGet(req, res);
      break;
    case "PUT":
      await handlePut(req,res)
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
