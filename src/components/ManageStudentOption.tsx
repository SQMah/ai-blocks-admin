import { FC, FormEvent, useId, useState,Dispatch,SetStateAction} from "react";
import axios from "axios";
import { X } from "lucide-react";

import { RoledUserType } from "@/models/auth0_schemas";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PatchUsersReqType } from "@/models/api_schemas";

import RemoveStudentFromClass from "./removeStudentFromClass";


interface ManagedStudentOptionProps{
  student:RoledUserType,
  reload:()=>Promise<void>,
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}



const ManagedStudentOption:FC<ManagedStudentOptionProps> = ({student,reload,isLoading,setIsLoading})=>{
    const currentClass = student.user_metadata?.class_ids
    const [classId,setClassId] = useState<string>("")
    const [message,setMessage] = useState<string>("")
    const oldClass = useId()
    const newClass = useId()

    const handleChange = async (e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault()
        setMessage("")
        setIsLoading(true)
        if(classId.trim().length===0){
            setMessage("Please provide the new class ID.")
            setClassId('')
        }else if(classId===currentClass){
            setMessage("The new class ID is not same as the old ID.")
        }else{
            try {
                const paylaod:PatchUsersReqType={
                  userId :student.user_id,
                  classIds:classId
                }
                const response =await  axios.patch("/api/users",paylaod)
                setClassId('')
                reload()
            } catch (error:any) {
              console.log(error?.response?.data?.message ?? error?.message ?? error);
            }
        }
        setIsLoading(false)
    }


    return <>
    <div>
      <p>Class</p>
      <div className=" min-h-[40px] w-3/5 rounded-md border border-input bg-transparent px-3 py-2 ">
       {currentClass?<div className="flex mx-1 items-center">
            <p className=" flex-grow">{currentClass}</p>
            <RemoveStudentFromClass student={student} reload={reload} isLoading={isLoading} setIsLoading={setIsLoading}/>
       </div>:null}
      </div>
      <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Change class</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
      <form onSubmit={handleChange}>
        <DialogHeader>
          <DialogTitle>Change class</DialogTitle>
          <DialogDescription>
            Change the class of {student.name}. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-6 items-center gap-4 ">
            <Label htmlFor={oldClass} className="text-right col-span-2 ">
              Current class ID
            </Label>
            <div id={oldClass} className=" col-span-4" > {student.user_metadata?.class_ids}</div>
          </div>
          <div className="grid grid-cols-6 items-center gap-x-4 gap-y-1 ">
            <Label htmlFor={newClass} className="text-right col-span-2 ">
             New class ID
            </Label>
            <Input id={newClass} value={classId} onChange={(e)=>{setMessage("");setClassId(e.target.value)}} className="col-span-4"/>
            <div className=" col-span-6 text-right text-sm text-red-500">{message}</div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit"  disabled={isLoading}>{isLoading?"Loading..." :"Save changes"}</Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </div>
    </>
  }

export default ManagedStudentOption;