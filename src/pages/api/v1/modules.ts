// import { ServerErrorHandler, adminCheck } from "@/lib/api_utils";
// import { createModule, deleteModule, getModules, updateModule } from "@/lib/db";
// import { deleteModulesReqSchema, getModulesReqSchema, postModulesReqSchema, putModulesReqSchema } from "@/models/api_schemas";


// import type { NextApiRequest, NextApiResponse } from "next";


// const handleGet = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {module_id,exact}  = getModulesReqSchema.parse(req.query)
//     const data = await getModules(module_id,exact)
//     // const user = UserSchema.parse(data)
//     res.status(200).json(data);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handlePost = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const payload = postModulesReqSchema.parse(req.body)
//     // const user = UserSchema.parse(data)
//     const data = await createModule(payload)
//     res.status(201).json(data);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handlePut = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const payload = putModulesReqSchema.parse(req.body)
//     const {module_id,...update}=payload
//     const data = await updateModule(module_id,update)
//     res.status(200).json(data);
//   } catch (error) {
//     const handler = new ServerErrorHandler(error);
//     handler.log();
//     handler.sendResponse(req, res);
//   }
// };

// const handleDelete = async (req: NextApiRequest, res: NextApiResponse) => {
//   try {
//     const {module_id} = deleteModulesReqSchema.parse({...req.query,...req.body})
//     const data  = await deleteModule(module_id)
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
