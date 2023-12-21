// import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
// import {
//   deleteUser,
//   findSingleUser,
//   updateUser,
// } from "@/lib/db";

// import type { NextApiRequest, NextApiResponse } from "next";
// import {  deleteUserReqSchema, getUsersReqSchema, putUsersReqSchema } from "@/models/api_schemas";
// import { TaskHandler } from "@/lib/task-handler";


// const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {email,roles}  = getUsersReqSchema.parse(req.query)
//     const user =  await findSingleUser(email,roles)
//     // console.log(user)
//     res.status(200).json(user);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// // const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
// //   try {
// //     const payload = postUsersReqSchema.parse(req.body)
// //     const result = await createUser(payload);
// //     // const user = UserSchema.parse(data)
// //     res.status(201).json(result);
// //   } catch (error) {
// //     const handler = new ServerErrorHandler(error);
// //     handler.log();
// //     handler.sendResponse(req, res);
// //   }
// // };

// const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const payload = putUsersReqSchema.parse({...req.query,...req.body})
//     if(payload.name){
//       const th = new TaskHandler()
//       th.logic.updateUser(payload)
//       const {users} = await th.run()
//       res.status(200).json(users.get(payload.email));
//     }else{
//       const {email,...update} = payload
//       const data = await updateUser(email,update)
//       res.status(200).json(data);
//     }
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {email} = deleteUserReqSchema.parse({...req.query,...req.body})
//     const th = new TaskHandler()
//     th.logic.deleteUser(email)
//     const data  = await th.run()
//     res.status(204).end();
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handler = async (req: NextApiRequest, res: NextApiResponse) => {
//   //configurate for authentication
//   if (!(await adminCheck(req, res))) {
//     return;
//   }
//   const method: string | undefined = req.method;
//   switch (method) {
//     case "GET":
//       await handleGet(req, res);
//       break;
//     // case "POST":
//     //   await handlePost(req, res);
//     //   break;
//     case "PUT":
//       await handlePut(req, res);
//       break;
//     case "DELETE":
//       await handleDelete(req, res);
//       break;
//     default:
//       res.status(405).json({
//         status: 405,
//         message: `${method} is not supported`,
//         details: {
//           resource: req.url,
//           method: req.method,
//         },
//       });
//       break;
//   }
// };

// export default handler;
