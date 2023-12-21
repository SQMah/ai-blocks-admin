// import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
// import { createGroup, deleteGroup, findManyGroups, findSingleGroup, updateGroup } from "@/lib/db";
// import { batchGetGroupsReqSchema, deleteGroupsSchema, getGroupsReqSechema, postGroupsReqSchema, putGroupsReqSchema } from "@/models/api_schemas";



// import type { NextApiRequest, NextApiResponse } from "next";


// const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {group_id,type} = getGroupsReqSechema.parse(req.query)
//     const group =  await findSingleGroup(group_id,type)
//     // const user = UserSchema.parse(data)
//     res.status(200).json(group);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// // const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
// //   try {
// //     const payload = postGroupsReqSchema.parse(req.body)
// //     const result = await createGroup(payload)
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
//     const payload = putGroupsReqSchema.parse(req.body)
//     const {group_id,...update}=payload
//     const data = await updateGroup(group_id,update)
//     res.status(200).json(data);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {group_id} = deleteGroupsSchema.parse({...req.query,...req.body})
//     const data = await deleteGroup(group_id)
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