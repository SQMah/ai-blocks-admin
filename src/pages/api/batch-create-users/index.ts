import { APIError, serverHandleError,adminCheck } from "@/lib/api_utils";
import { createUser, getAccessToken, sendInvitation } from "@/lib/auth0_user_management";
import { updateClass } from "@/lib/class_management";
import { delay, zodErrorMessage } from "@/lib/utils";
import { BatchCreateUsersReqSchema, BatchCreateUsersResType } from "@/models/api_schemas";
import type { NextApiRequest, NextApiResponse } from "next";


const handlePost = async (req:NextApiRequest,res:NextApiResponse) =>{
    try {
        const parsing = BatchCreateUsersReqSchema.safeParse(req.body)
        if(!parsing.success){
            throw new APIError("Invalid Request Body",zodErrorMessage(parsing.error.issues))
        }
        const payload = parsing.data
        const emails = payload.users.map(user=>user.email)
        if(!emails.length) throw new APIError("Invalid Request Body","Empty users array.")
        //handle class
        if(payload.role==="teacher"&&payload.teaching_class_ids){
            for(const class_id of payload.teaching_class_ids){
                await updateClass({
                    class_id,
                    addTeachers:emails
                })
                await delay(300)
            }
        }else if(payload.role==="managedStudent"&&payload.enrolled_class_id){
            await updateClass({
                class_id:payload.enrolled_class_id,
                addStudents:emails
            })
        }
        //create users
        const response:BatchCreateUsersResType={
            created:[],
            failed:[],
            message:"Success case(s): 0, failed case(s):0"
        }
        const token = await  getAccessToken()
        //role, class, expiration etc.
        const {role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} = payload
        const info = {role,enrolled_class_id,teaching_class_ids,available_modules,account_expiration_date} 
        for(const user of payload.users){
            try {
                const data = await createUser(token,{
                    ...user,
                    ...info,
                })
                //at least delay half second
                await Promise.all([sendInvitation(token,`${user.first_name} ${user.last_name}`,user.email),delay(500)])
                response.created.push(data)
            } catch (error:any) {
                let reason = error.message??"Unknown error"
                if(error instanceof APIError){
                    reason = error.message
                }
                response.failed.push({...user,reason})
                await delay(500)
            }
        }
        const message = `Success case(s): ${response.created.length}, failed case(s):${response.failed.length}`
        response.message = message
        res.status(response.created.length>0?201:500).json(response)
    } catch (error) {
        serverHandleError(error,req,res)
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
        res.status(405).json({message:`${method} is not supported`});
        break;
    }
  };

export default handler