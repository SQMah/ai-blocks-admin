import type { NextApiRequest, NextApiResponse } from "next";

import { getClass,deleteClass} from "@/lib/class_management";

import { APIError, adminCheck,ServerErrorHandler } from "@/lib/api_utils";
import { dbToJSON } from "@/lib/api_utils";
import { assignRole, deleteRole, getAccessToken, searchUser, updateUser } from "@/lib/auth0_user_management";
import { delay } from "@/lib/utils";
import { DeleteClassesReqSchema, GetClassesReqSchema } from "@/models/api_schemas";
import { TaskHandler } from "@/lib/task-handler";


//get class by class_id
const handleGet =async (req: NextApiRequest,res: NextApiResponse) => {
    try {
        const parsing = GetClassesReqSchema.safeParse(req.query)
        if(!parsing.success){
          throw new APIError("Invalid Request Params","Please provide one and only one class ID.")
        }
        const {class_id} = parsing.data
        const taskHandler = new TaskHandler()
        taskHandler.logic.getClassByID(class_id)
        await taskHandler.start()
        const data =taskHandler.getSingleClass(class_id)
        res.status(200).json(dbToJSON(data))
    } catch (error:any) {
      const handler = new ServerErrorHandler(error)
      handler.log()
      handler.sendResponse(req,res)
  }
}

// const handleDelete =async (req: NextApiRequest,res: NextApiResponse) => {
//   try {
//       const parsing =  DeleteClassesReqSchema.safeParse(req.query)
//       if(!parsing.success){
//         throw new APIError("Invalid Request Params","Please provide one and only one class ID.")
//       }
//       const {class_id} = parsing.data
//       const target = await getClass(class_id)
//       const emails = []
//       for(const email in target.student_ids??[]) emails.push(email)
//       for (const email in target.teacher_ids??[]) emails.push(email)
//       const token = await getAccessToken()
//       const users = await searchUser(token,{email:emails},"OR")
//       const teachers = []
//       const students = []
//       for(const user of users){
//         if(user.roles.includes("teacher")) teachers.push(user)
//         else if (user.roles.includes("managedStudent")) students.push(user)
//       }
//       for(const teacher of teachers){
//         try {
//           const {user_id,roles} = teacher
//           const teaching_class_ids = teacher.user_metadata?.teaching_class_ids
//           if(!teaching_class_ids) throw new Error(`${teacher.email} has no teaching classes`)
//           await updateUser(token,{
//             userId:user_id,
//             content:{
//               teaching_class_ids:teaching_class_ids.filter(id=>id!==target.class_id)
//             }
//           },roles)
//         } catch (error:any) {
//           console.error(`Fail to update ${teacher.email}, reason:${error.message??"unknown"}`)
//         }
//         await delay(500)
//       }
//       for(const student of students){
//         try {
//           const {user_id,roles} = student
//           const enrolled = student.user_metadata?.enrolled_class_id
//           if(!enrolled) throw new Error(`${student.email} has no enrolled class`)
//           if(enrolled!==target.class_id) throw new Error(`${student.email} is not enrolled into ${target.class_id}`)
//           await updateUser(token,{
//             userId:user_id,
//             content:{
//               enrolled_class_id:null
//             }
//           },roles)
//           await deleteRole(token,user_id,"managedStudent")
//           await assignRole(token,user_id,"unmanagedStudent")
//         } catch (error:any) {
//           console.error(`Fail to update ${student.email}, reason:${error.message??"unknown"}`)
//         }
//         await delay(500)
//       }
//       const data = await deleteClass(class_id)
//       // console.log(data)
//       res.status(204).end()
//   } catch (error:any) {
//     const handler = new ServerErrorHandler(error)
//     handler.log()
//     handler.sendResponse(req,res)
//   }
// }

const handler = async (req: NextApiRequest,res: NextApiResponse) => {
    //configurate for authentication
    if(!await adminCheck(req,res)){
      return
    }
    const method: string | undefined = req.method;
    switch (method) {
      case "GET":
        await handleGet(req,res);
        break;
      // case "DELETE":
      //   await handleDelete(req,res);
      //   break
      default:
        res.status(405).json({
          status:405,
          message:`${method} is not supported`,
          details:{
            resource: req.url,
            method: req.method
          }
        });
        break;
    }
  };
  
  export default handler;