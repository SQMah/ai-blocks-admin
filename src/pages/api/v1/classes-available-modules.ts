// import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
// import { addAvalibleModulesToClass, removeAvalibleModulesToClass, updateClassAvailableModules } from "@/lib/db";
// import { deleteClassesModulesReqSchema, postClassesModulesReqSchema, putClassesModulesReqSchema } from "@/models/api_schemas";
// import type { NextApiRequest, NextApiResponse } from "next";

// const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {group_id,module_ids,unlocked_ids} =postClassesModulesReqSchema.parse({...req.query,...req.body})
//     const result = await addAvalibleModulesToClass(group_id,module_ids,unlocked_ids)
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
//     const payload = putClassesModulesReqSchema.parse({...req.query,...req.body})
//     // console.log(payload)
//     const {group_id,toAdd,toRemove,toLock,toUnlock}=payload
//     const data = await updateClassAvailableModules(group_id,toAdd,toRemove,toLock,toUnlock)
//     res.status(200).json(data);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {group_id,module_ids} =deleteClassesModulesReqSchema.parse({...req.query,...req.body})
//     const data = await removeAvalibleModulesToClass(group_id,module_ids)
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
