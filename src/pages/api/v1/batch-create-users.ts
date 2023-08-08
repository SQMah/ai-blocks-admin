import { APIError, ServerErrorHandler,adminCheck } from "@/lib/api_utils";
import { TaskHandler } from "@/lib/task-handler";
import {  zodErrorMessage } from "@/lib/utils";
import { BatchCreateUsersReqSchema} from "@/models/api_schemas";
import type { NextApiRequest, NextApiResponse } from "next";


const handlePost = async (req:NextApiRequest,res:NextApiResponse) =>{
    try {
        const parsing = BatchCreateUsersReqSchema.safeParse(req.body)
        if(!parsing.success){
            throw new APIError("Invalid Request Body",zodErrorMessage(parsing.error.issues))
        }
        const payload = parsing.data
        // const emails = payload.users.map(user=>user.email)
        // if(!emails.length) throw new APIError("Invalid Request Body","Empty users array.")
        // //check for class validity,will throw error if invalid
        // // console.log(payload)
        // if(payload.role==="teacher"&&payload.teaching_class_ids?.length){
        //     for(const class_id of payload.teaching_class_ids){
        //         await classUpdatable({
        //             class_id,
        //             addTeachers:emails
        //         })
        //         await delay(300)
        //     }
        // }else if(payload.role==="managedStudent"&&payload.enrolled_class_id){
        //     await classUpdatable({
        //         class_id:payload.enrolled_class_id,
        //         addStudents:emails
        //     })
        // }
        // //create users
        // const response:BatchCreateUsersResType={
        //     created:[],
        //     failed:[],
        //     message:"Success case(s): 0, failed case(s):0"
        // }
        // const token = await  getAccessToken()
        // //role, class, expiration etc.
        // const {role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} = payload
        // const info = {role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} 
        // //create users
        // const created = []
        // for(const user of payload.users){
        //     try {
        //         const data = await createUser(token,{
        //             ...user,
        //             ...info,
        //         })
        //         //at least delay half second
        //         await Promise.all([sendInvitation(token,data.name,data.email),delay(500)])
        //         created.push(data)
        //     } catch (error:any) {
        //         const reason = error.message??"Unknown error"
        //         response.failed.push({...user,reason})
        //         await delay(500)
        //     }
        // }
        // //update classes, validity is checked before
        // if(created.length){
        //     try {
        //         if(payload.role==="teacher"&&payload.teaching_class_ids?.length){
        //             const createdEmails = created.map(user=>user.email)
        //             for(const class_id of payload.teaching_class_ids){
        //                 await updateClass({
        //                     class_id,
        //                     addTeachers:createdEmails
        //                 })
        //                 await delay(300)
        //             }
        //         }else if(payload.role==="managedStudent"&&payload.enrolled_class_id){
        //             const createdEmails = created.map(user=>user.email)
        //             await updateClass({
        //                 class_id:payload.enrolled_class_id,
        //                 addStudents:createdEmails
        //             })
        //         }
        //         response.created = created
        //     } catch (error) {
        //         const handler = new ServerErrorHandler(error)
        //         for(const user of created){
        //             response.failed.push({
        //                 email:user.email,
        //                 first_name:user.given_name??user.name,
        //                 last_name:user.family_name??user.name,
        //                 reason:handler.message + " at class update."
        //             })
        //         }
        //     }
        // }
        // //logging failed users
        // response.failed.length>0&&console.error("Failed Creation: ",response.failed)
        // response.message = `Success case(s): ${response.created.length}, failed case(s):${response.failed.length}`
        const th = new TaskHandler()
        th.logic.barchCreateUsers(payload)
        await th.start()
        const users = th.getAllUsers()
        res.status(201).json(users)
    } catch (error) {
        const handler = new ServerErrorHandler(error)
        handler.log()
        handler.sendResponse(req,res)
    }
}


const handler = async (req: NextApiRequest,res: NextApiResponse) => {
    //configurate for authentication
    if(!await adminCheck(req,res)){
      return
    }
    const method: string | undefined = req.method;
    switch (method) {
      case "POST":
        await handlePost(req,res);
        break;
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

export default handler