import { FC,Dispatch,SetStateAction} from "react";
import axios from "axios";
import { X } from "lucide-react";

import { RoledUserType } from "@/models/auth0_schemas";
import { Button } from "./ui/button";

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
import { PutUsersReqType } from "@/models/api_schemas";


interface props{
  student:RoledUserType,
  reload:()=>Promise<void>,
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}



const RemoveStudentFromClass:FC<props>=({student,reload,isLoading,setIsLoading})=>{
    
    const handleRemove =async () => {
        setIsLoading(true)
        try {
            const paylaod:PutUsersReqType={
              userId :student.user_id,
              content:{
                enrolled_class_id:null
              }
            }
            // console.log(paylaod)
            const response =await  axios.put("/api/users",paylaod)
            await reload()
        } catch (error:any) {
          console.log(error?.response?.data?.message ?? error?.message ?? error);
        }
        setIsLoading(false)
    }

    return <>
    <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant={"ghost"}><X color="red"/></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure to remove {student.name} from {student.user_metadata?.enrolled_class_id} ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently remove {student.name} from {student.user_metadata?.enrolled_class_id}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isLoading} onClick={handleRemove}>{isLoading?"Loading...":"Confirm"}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
    </>
}

export default RemoveStudentFromClass;