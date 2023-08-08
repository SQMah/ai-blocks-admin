import { FC,Dispatch,SetStateAction, useState, } from "react";
import axios from "axios";
import {User} from "@/models/db_schemas"
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
import { ClientErrorHandler,  } from "@/lib/utils";
import { requestAPI } from "@/lib/request";

interface props{
  user:User,
  reload:()=>Promise<void>,
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}



const DeleteUser:FC<props>=({user,reload,isLoading,setIsLoading})=>{
    const [confirm,setConfirm] = useState<boolean>(false)
    const {toast} = useToast()
    const handleRemove =async () => {
        setIsLoading(true)
        try {
            const data = await requestAPI("users","DELETE",{},{},user.email)
            toast({
              title:"Deleted"
            })
            await reload()
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
                <Button variant={"destructive"} disabled={isLoading}>{isLoading?"Loading...":"Delete user"}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent >
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure to delete {user.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete  the account of {user.name}.
                  </AlertDialogDescription>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="terms" className="mt-4 mb-2" checked={confirm} onCheckedChange={(e:boolean)=>setConfirm(e)}/>
                        <label
                            htmlFor="terms"
                            className=" mt-4 mb-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            Confirm deleting the account of {user.email}
                        </label>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={()=>setConfirm(false)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isLoading||!confirm} onClick={handleRemove}>{isLoading?"Loading...":"Confirm"}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
    </>
}

export default DeleteUser;