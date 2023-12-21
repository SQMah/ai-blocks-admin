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

import { ClientErrorHandler,} from "@/lib/utils";
import { Group, User } from "@/models/db_schemas";
import { requestAPI } from "@/lib/request";

interface Props{
    group:Group
    handleChangeGroup :(data:Group|undefined)=>Promise<void>
    isLoading:boolean;
    setIsLoading:Dispatch<SetStateAction<boolean>>;
    managers:User[];
    students:User[];
}


const DeleteGroup:FC<Props> = ({group,isLoading,setIsLoading,handleChangeGroup,managers,students})=>{
    const {groupId,groupName,type} = group
    const [confirm,setConfirm] = useState<boolean>(false)
    const {toast} = useToast()
    const handleDelete =async () => {
        setIsLoading(true)
        try {
            const delRes = await  requestAPI("groups","DELETE",{
              group_id:groupId
            },{})
            toast({
                title:"Deleted"
            })
            await handleChangeGroup(undefined)
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
                <Button  variant={"destructive"} disabled={isLoading}>{isLoading?"Loading...":`Delete ${type}`}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent >
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure to delete  {groupName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    <a>This action cannot be undone. The action will have the following effects:</a>
                    <span className=" list-disc mt-1 ml-4">
                        <li>Delete all associated data of {groupName}</li>
                        <li>Remove {groupName} from the manage list of {managers.length} teachers.</li>
                        {type==="class"?
                        <li>Remove {groupName} from the enrolling of {students.length} students</li>
                        :null}
                         {type==="family"?
                        <li>Remove {groupName} from the families of {students.length} children</li>
                        :null}
                    </span>
                  </AlertDialogDescription>
                    <span className="flex items-center space-x-2">
                        <Checkbox id="terms" className="mt-4 mb-2" checked={confirm} onCheckedChange={(e:boolean)=>setConfirm(e)}/>
                        <label
                            htmlFor="terms"
                            className=" mt-4 mb-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Confirm deleting {groupName}
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

export default DeleteGroup