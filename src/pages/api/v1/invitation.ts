// import type { NextApiRequest, NextApiResponse } from "next";
// import { APIError, adminCheck, ServerErrorHandler } from "@/lib/api_utils";
// import { postInvitationReqSchema } from "@/models/api_schemas";
// import { getAccessToken, getInvitationPramas } from "@/lib/auth0_user_management";
// import { sendMail } from "@/lib/mail_sender";


// const handlePost = async (
//   req: NextApiRequest,
//   res: NextApiResponse
// ) => {
//   try {
//     // console.log(req.query)
//     const {email} =postInvitationReqSchema.parse(req.query)
//     const token = await getAccessToken()
//     const {url} = await getInvitationPramas(token,email,email)
//     await sendMail(email,email,url)
//     res.status(204).end()
//     return;
//   } catch (error: any) {
//     const handler = new ServerErrorHandler(error)
//     handler.log()
//     handler.sendResponse(req,res)
//   }
// };



// const handler = async (req: NextApiRequest,res: NextApiResponse) => {
//   //configurate for authentication
//   if(!await adminCheck(req,res)){
//     return
//   }
//   const method: string | undefined = req.method;
//   switch (method) {
//     case "POST":
//       await handlePost(req, res);
//       break;
//     default:
//       res.status(405).json({
//         status:405,
//         message:`${method} is not supported`,
//         details:{
//           resource: req.url,
//           method: req.method
//         }
//       });
//       break;
//   }
// };

// export default handler;
