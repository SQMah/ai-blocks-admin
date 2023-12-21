import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";


import type { NextApiRequest, NextApiResponse } from "next";
import { TaskHandler } from "@/lib/task-handler";
import { batchGetUsersReqSchema, batchPutUsersReqSchema, postUsersReqSchema } from "@/models/api_schemas";
import { batchGetUsersByEmails, batchUpdateUser, createUser} from "@/lib/drizzle_functions";


const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const query  =batchGetUsersReqSchema.parse(req.query)
    const users =  await batchGetUsersByEmails(query.email)
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
    // console.log(req.body)
    const payload = postUsersReqSchema.parse(req.body)
    // console.log(payload)
    
    //! need handle in taskhander
    const th = new TaskHandler()
    th.logic.createSingleUser(payload)
    const result = await th.run()
    const user = result.users.get(payload.email)
    // const user = UserSchema.parse(data)
    // console.log(new Date(result.expirationDate??"").toLocaleString())
    res.status(201).json(user);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const payload = batchPutUsersReqSchema.parse(req.body)
    const {emails,update}=payload
    const data = await batchUpdateUser(emails,update)
    res.status(200).json(data);
  } catch (error) {
    const handler = new ServerErrorHandler(error);
    handler.log();
    handler.sendResponse(req, res);
  }
};

// const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {email} = deleteUserReqSchema.parse({...req.query,...req.body})
//     const th = new TaskHandler()
//     th.logic.deleteUser(email)
//     const data  = await th.run()
//     // const user = UserSchema.parse(data)
//     res.status(204).end();
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

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
      // await handleDelete(req, res);
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
