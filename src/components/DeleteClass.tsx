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
import { GetClassesResType } from "@/models/api_schemas";

import { ClientErrorHandler,} from "@/lib/utils";

interface Props{
    teachers:RoledUserArrayType;
    students:RoledUserArrayType;
    classId:string;
    handleChangeClass :(data:GetClassesResType|undefined)=>Promise<void>
    isLoading:boolean;
    setIsLoading:Dispatch<SetStateAction<boolean>>;
}


const DeleteClass:FC<Props> = ({teachers,students,classId,isLoading,setIsLoading,handleChangeClass})=>{
    const [confirm,setConfirm] = useState<boolean>(false)
    const {toast} = useToast()
    const handleDelete =async () => {
        setIsLoading(true)
        try {
            const delRes = await  axios.delete("/api/v1/classes/"+classId)
            toast({
                title:"Deleted"
            })
            await handleChangeClass(undefined)
        } catch (error:any) {
          const handler = new ClientErrorHandler(error)
          handler.log()
          toast({
            variant:"destructive",
            title: "Delete error",
            description: handler.message,
          })
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
                    <a>This action cannot be undone. The action will have the following effects:</a>
                    <span className=" list-disc mt-1 ml-4">
                        <li>Delete all associated data of {classId}</li>
                        <li>Remove {classId} from the class list of {teachers.length} teachers.</li>
                        <li>Remove {classId} from the user metadata of {students.length} students</li>
                        <li>Turn {students.length} students to unmanaged students</li>
                    </span>
                  </AlertDialogDescription>
                    <span className="flex items-center space-x-2">
                        <Checkbox id="terms" className="mt-4 mb-2" checked={confirm} onCheckedChange={(e:boolean)=>setConfirm(e)}/>
                        <label
                            htmlFor="terms"
                            className=" mt-4 mb-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Confirm deleting {classId}
                        </label>
                    </span>
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