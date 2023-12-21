// import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
// import { changeClass, disEnrollUser, enrollUser } from "@/lib/db";
// import { deleteEnrollsReqSchema, postEnrollsReqSchema, putEnrollsReqSchema } from "@/models/api_schemas";


// import type { NextApiRequest, NextApiResponse } from "next";


// // const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
// //   try {
// //     const query  = batchGetUsersReqSchema.parse(req.query)
// //     const users =  await findManyUsers(query)
// //     // const user = UserSchema.parse(data)
// //     res.status(200).json(users);
// //   } catch (error) {
// //     const handler = new ServerErrorHandler(error);
// //     handler.log();
// //     handler.sendResponse(req, res);
// //   }
// // };

// const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {email,group_id} = postEnrollsReqSchema.parse({...req.query,...req.body})
//     const result = await enrollUser(email,group_id)
//     // const user = UserSchema.parse(data)
//     res.status(201).json(result);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const payload = putEnrollsReqSchema.parse({...req.query,...req.body})
//     const {email,group_id}=payload
//     const data = await changeClass(email,group_id)
//     res.status(200).json(data);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {email,group_id} = deleteEnrollsReqSchema.parse({...req.query,...req.body})
//     const data = await disEnrollUser(email,group_id)
//     // const user = UserSchema.parse(data)
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
//     // case "GET":
//     //   await handleGet(req, res);
//     //   break;
//     case "POST":
//       await handlePost(req, res);
//       break;
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
