import { FC,Dispatch,SetStateAction, useState, } from "react";
import axios from "axios";

import { Button } from "./ui/button";
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "./ui/use-toast";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { RoledUserArrayType } from "@/models/auth0_schemas";
import { PutUsersReqType } from "@/models/api_schemas";

import { delay} from "@/lib/utils";

interface Props{
    teachers:RoledUserArrayType;
    students:RoledUserArrayType;
    classId:string;
    reload:()=>Promise<void>;
    isLoading:boolean;
    setIsLoading:Dispatch<SetStateAction<boolean>>;
}


const DeleteClass:FC<Props> = ({teachers,students,classId,isLoading,setIsLoading,reload})=>{
    const [confirm,setConfirm] = useState<boolean>(false)
    const {toast} = useToast()
    const handleDelete =async () => {
        setIsLoading(true)
        try {
            //sequence: update studens -> update teachers -> dlete class data(todo)
            for(const student of students){
                const payload:PutUsersReqType ={
                    userId:student.user_id,
                    content:{
                        enrolled_class_id:null
                    }
                }
                const {data} = await  axios.put("/api/users",payload)
                await delay(500)
            }
            for(const teacher of teachers){
                const teaching_class_ids = teacher.user_metadata?.teaching_class_ids
                ?.filter(id=>id!==classId)??[]
                const payload:PutUsersReqType ={
                    userId:teacher.user_id,
                    content:{teaching_class_ids}
                }
                const {data} = await  axios.put("/api/users",payload)
                await delay(500)
            }
            //todo: delete the class data in db
            toast({
                title:"Deleted"
            })
            await reload()
        } catch (error:any) {
          console.log(error?.response?.data?.message ?? error?.message ?? error);
          const message = error?.response?.data?.message
          if(message){
            toast({
              variant:"destructive",
              title: "Delete error",
              description: message,
            })
          }
        }
        setIsLoading(false)
    }
 

    return <>
    <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button  variant={"destructive"} disabled={isLoading}>{isLoading?"Loading...":"Delete class"}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent >
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure to delete the class {classId}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <p>This action cannot be undone. The action will have the following effects:</p>
                    <ul className=" list-disc mt-1 ml-4">
                        <li>Delete all associated data of {classId}</li>
                        <li>Remove {classId} from the class list of {teachers.length} teachers.</li>
                        <li>Remove {classId} from the user metadata of {students.length} students</li>
                        <li>Turn {students.length} students to unmanaged students</li>
                    </ul>
                  </AlertDialogDescription>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="terms" className="mt-4 mb-2" checked={confirm} onCheckedChange={(e:boolean)=>setConfirm(e)}/>
                        <label
                            htmlFor="terms"
                            className=" mt-4 mb-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Confirm deleting {classId}
                        </label>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={()=>setConfirm(false)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isLoading||!confirm} onClick={handleDelete}>{isLoading?"loading...":"Confirm"}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
    </>
}

export default DeleteClass