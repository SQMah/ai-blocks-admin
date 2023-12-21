// import {  ServerErrorHandler,adminCheck } from "@/lib/api_utils";
// import { TaskHandler } from "@/lib/task-handler";
// import { postBatchCreateUsersReqSchema } from "@/models/api_schemas";
// import type { NextApiRequest, NextApiResponse } from "next";


// const handlePost = async (req:NextApiRequest,res:NextApiResponse) =>{
//     try {
//         const paylaod = postBatchCreateUsersReqSchema.parse(req.body)
//         const th = new TaskHandler()
//         th.logic.batchCreateUser(paylaod)
//         const {users} = await th.run()
//         res.status(201).json(Array.from(users.values()))
//     } catch (error) {
//         const handler = new ServerErrorHandler(error)
//         handler.log()
//         handler.sendResponse(req,res)
//     }
// }


// const handler = async (req: NextApiRequest,res: NextApiResponse) => {
//     //configurate for authentication
//     if(!await adminCheck(req,res)){
//       return
//     }
//     const method: string | undefined = req.method;
//     switch (method) {
//       case "POST":
//         await handlePost(req,res);
//         break;
//       default:
//         res.status(405).json({
//             status:405,
//             message:`${method} is not supported`,
//             details:{
//               resource: req.url,
//               method: req.method
//             }
//           });
//         break;
//     }
//   };

// export default handler