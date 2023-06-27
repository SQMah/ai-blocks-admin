import { FC, FormEvent, useId, useState,Dispatch,SetStateAction} from "react";
import axios, { AxiosError } from "axios";

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
import { useToast } from "./ui/use-toast";

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X,Check} from "lucide-react";

import { GetClassesResSchema, PutUsersReqType } from "@/models/api_schemas";
import { RoledUserType,modulesReady } from "@/models/auth0_schemas";

import RemoveStudentFromClass from "./removeStudentFromClass";
import { clientErrorHandler } from "@/lib/utils";


interface ManagedStudentOptionProps{
  student:RoledUserType,
  reload:()=>Promise<void>,
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}



export const ManagedStudentOption:FC<ManagedStudentOptionProps> = ({student,reload,isLoading,setIsLoading})=>{
    const currentClass = student.user_metadata?.enrolled_class_id
    const [classId,setClassId] = useState<string>("")
    const [message,setMessage] = useState<string>("")
    const {toast} = useToast()
    const oldClass = useId()
    const newClass = useId()

    const handleChange = async (e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault()
        if(!currentClass) return
        setMessage("")
        setIsLoading(true)
        const id = classId.trim()
        if(id.length===0){
            setMessage("Please provide the new class ID.")
            setClassId('')
        }else if(id===currentClass){
            setMessage("The new class ID is not same as the old ID.")
        }else{
            //can remove capacity and class id validation if needed
            try {
              const {data} = await axios.get('/api/v1/classes/'+id)
              const target = GetClassesResSchema.parse(data)
              if(target.student_ids.length>=target.capacity){
                setMessage("Class is full.")
                setIsLoading(false)
                return
              }
            } catch (error:any) {
              if(error instanceof AxiosError && error.response?.status===404){
                setMessage("Invalid class ID.")
              }else{
                const handler = new clientErrorHandler(error)
                handler.log()
                toast({
                  variant:"destructive",
                  title:"Search Class Error",
                  description:handler.message
                })
              }
              setIsLoading(false)
              return
            }
            try {
                //class will be updated by the api
                const payload:PutUsersReqType={
                  userId :student.user_id,
                  content:{
                    enrolled_class_id:id
                  }
                }
                setClassId('')
                const response = await  axios.put("/api/v1/users",payload)
                toast({
                  title:"Updated"
                })
                await reload()
            } catch (error:any) {
              const handler = new clientErrorHandler(error)
              handler.log()
              toast({
                variant:"destructive",
                title: "Update error",
                description: handler.message,
              })
            }
        }
        setIsLoading(false)
    }


    return <>
    <div className="space-y-10">
      <div className="space-y-4">
      <p>Current class</p>
      <div className=" min-h-[40px] w-3/5 rounded-md border border-input bg-transparent px-3 py-2 ">
       {currentClass?<div className="flex mx-1 items-center">
            <p className=" flex-grow">{currentClass}</p>
            <RemoveStudentFromClass {...{student,reload,isLoading,setIsLoading}}/>
       </div>:null}
      </div>
      </div>
      <Dialog>
      <DialogTrigger asChild>
        <Button   disabled={isLoading}>{isLoading?"loading...":"Change class by ID"}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
      <form onSubmit={handleChange}>
        <DialogHeader>
          <DialogTitle>Change class</DialogTitle>
          <DialogDescription>
            {`Change the class of ${student.name}. Click save when you are done.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-6 items-center gap-4 ">
            <Label htmlFor={oldClass} className="text-right col-span-2 ">
              Current class ID
            </Label>
            <div id={oldClass} className=" col-span-4" > {student.user_metadata?.enrolled_class_id}</div>
          </div>
          <div className="grid grid-cols-6 items-center gap-x-4 gap-y-1 ">
            <Label htmlFor={newClass} className="text-right col-span-2 ">
             New class ID
            </Label>
            <Input id={newClass} value={classId} placeholder="new class ID ..."
              onChange={(e)=>{setMessage("");setClassId(e.target.value)}} className="col-span-4"/>
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

  interface UnmanagedStudentOptionProps{
    student:RoledUserType,
    reload:()=>Promise<void>,
    isLoading:boolean,
    setIsLoading:Dispatch<SetStateAction<boolean>>
  }

  export const UnmanagedStudentOption:FC<UnmanagedStudentOptionProps> = ({student,reload,isLoading,setIsLoading})=>{
    const storedModules= student.user_metadata?.available_modules?.sort()??[]
    const [availableModules,setAvailableModules] = useState<string[]>(storedModules)
    const modulesToAdd:string[] = modulesReady.filter(module=>!availableModules.includes(module))
    const disableSave:boolean = storedModules.toString()===availableModules.toString()

    const [newClassId,setNewClassId] = useState<string>("")
    const [message,setMessage] = useState<string>("")
    const newClass = useId()

    const {toast} = useToast()

    const handleAddModule = (toAdd:string)=>{
      setAvailableModules(prev=>[...prev,toAdd].sort())
    }
    const handleRemoveModule = (toRemove:string)=>{
      setAvailableModules(prev=>prev.filter(module=>module!==toRemove).sort())
    }
    const handleSaveModules = async ()=>{
      setIsLoading(true)
      try {
        const paylaod:PutUsersReqType={
          userId :student.user_id,
          content:{
            available_modules:availableModules,
          }
        }
        const response =await  axios.put("/api/v1/users",paylaod)
        toast({
          title:"Updated"
        })
        await reload()
      } catch (error:any) {
          const handler = new clientErrorHandler(error)
          handler.log()
          toast({
            variant:"destructive",
            title: "Update error",
            description: handler.message,
          })
      }
      setIsLoading(false)
    }
    
    const handleAssignClass = async (e:FormEvent<HTMLFormElement>)=>{
      e.preventDefault()
        setMessage("")
        setIsLoading(true)
        const id = newClassId.trim()
        if(id.length===0){
            setMessage("Please provide the new class ID.")
            setNewClassId('')
            setIsLoading(false)
            return
        }
        try {
          //class id and capacity validation can be handled by api
          const {data} = await axios.get('/api/v1/classes/'+id)
          const target = GetClassesResSchema.parse(data)
              if(target.student_ids.length>=target.capacity){
                setMessage("Class is full.")
                setIsLoading(false)
                return
              }
        } catch (error:any) {
          if(error instanceof AxiosError && error.response?.status===404){
            setMessage("Invalid class ID.")
          }else{
            const handler = new clientErrorHandler(error)
            toast({
              variant:"destructive",
              title:"Saecrh Class Error",
              description:handler.message
            })
          }
          setIsLoading(false)
          return
        }
        try {
          const payload:PutUsersReqType={
            userId :student.user_id,
            content:{
              enrolled_class_id:newClassId
            }
          }
          setNewClassId('')
          //both class and user data will be upated by api
          const response =await  axios.put("/api/v1/users",payload)
          toast({
            title:"Updated"
          })
          await  reload()
        } catch (error:any) {
          const handler = new clientErrorHandler(error)
          handler.log()
          toast({
            variant:"destructive",
            title: "Update error",
            description: handler.message,
          })
      }
      setIsLoading(false)
    }

    return <>
    <div className=" grid grid-cols-3  items-center gap-12">
      <div className=" space-y-5 col-span-2">
      <p>current modules</p>
      <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
      <ul>
        {availableModules.map((module,index)=>{
          return <li key ={`${module}-${index}`} className="flex items-center gap-2">
            <div className="flex-grow">{module}</div>
            <Button variant={"ghost"} className="p-0" onClick={()=>handleRemoveModule(module)}><X color="red"/></Button>
            </li>
        })}
      </ul>
      </div>
      <p>modules to add</p>
      <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
      <ul>
        {modulesToAdd.map((module,index)=>{
          return <li key ={`${module}-${index}`} className="flex items-center gap-2">
          <div className="flex-grow">{module}</div>
          <Button variant={"ghost"} className="p-0" onClick={()=>handleAddModule(module)}><Check color="green"/></Button>
          </li>
        })}
      </ul>
      </div>
      <Button disabled={isLoading||disableSave} onClick={handleSaveModules}>{isLoading?"loading...":"Save module changes"}</Button>
      </div>
      <div className=" col-span-1">
          <form onSubmit={handleAssignClass} >
            <div className=" space-y-1">
            <Label htmlFor={newClass} className="text-right col-span-2 ">
             Change to managed student with Class ID
            </Label>
            <Input id={newClass} value={newClassId} placeholder="new class ID ..."
              onChange={(e)=>{setMessage("");setNewClassId(e.target.value)}} className="col-span-4"/>
            <div className=" col-span-6 text-right text-sm text-red-500">{message}</div>
            </div>
            <Button type="submit"  disabled={isLoading} className=" my-4">{isLoading?"Loading..." :"Save changes"}</Button>
          </form>
      </div>
    </div>
    </>
  }
