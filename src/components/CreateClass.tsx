import { FC,useState } from "react"
import { X,Check } from "lucide-react";
import {z} from "zod"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";

import { Input } from "./ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from "@/components/ui/form";

import { defaultModels,modulesReady } from "@/models/auth0_schemas"
import { CreateClassDataType} from "@/models/api_schemas";

const FormSchema = z.object({
    teacherIds: z.string().trim().nonempty({message:"Required"})
    .refine(input=>{
      const idList = input.split(",").filter(id=>id.length).map(id=>id.trim())
      for (const id of idList){
        if(!z.string().email().safeParse(id).success){
          return false
        }
      }
      return true
    },{message:`Invalid email, please provide a list of email seperated by ","`}),
    capacity:z.string().nonempty({message:"Required"})
    .refine(input=>!isNaN(Number(input)),{message:"Invalid number"})
})

const CreateClass:FC= ()=>{
    const [isLoading,setIsLoading] = useState<boolean>(false)
    const [availableModules,setAvailableModules] = useState<string[]>(defaultModels.sort())
    const modulesToAdd:string[] = modulesReady.filter(module=>!availableModules.includes(module))

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
          teacherIds:"",
          capacity:"10"
        },
      });

    const onSubmit = async (values: z.infer<typeof FormSchema>)=>{
        setIsLoading(true)
        try { 
            // console.log(values,availableModules)
            let {teacherIds,capacity} = values
            const payload:CreateClassDataType={
                teacherId:values.teacherIds.split(",").filter(id=>id.length).map(id=>id.trim()),
                capacity:Number(values.capacity),
                available_modules:availableModules||[]
            }
            console.log(payload)
        } catch (error: any) {
            console.log(error?.response?.data?.messages??error?.message??error)
          }
        setIsLoading(false)
    }

    const handleAddModule = (toAdd:string)=>{
      setAvailableModules(prev=>[...prev,toAdd].sort())
    }
    const handleRemoveModule = (toRemove:string)=>{
      setAvailableModules(prev=>prev.filter(module=>module!==toRemove).sort())
    }
   
    
    

    return <>
     <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className=" grid grid-cols-2  items-center gap-12"
        >
        <div className=" space-y-5 col-span-2">
          <FormField
                control={form.control}
                name="teacherIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teacher IDs (email)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Teacher IDs ..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Seperate teacher IDs by "," </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
                <div className="space-y-5 ">
                  <p>current modules</p>
                      <ul className="h-64 overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                          {availableModules.map((module,index)=>{
                          return <li key ={`${module}-${index}`} className="flex items-center gap-2">
                              <div className="flex-grow">{module}</div>
                              <Button type="button" variant={"ghost"} className="p-0" onClick={()=>handleRemoveModule(module)}><X color="red"/></Button>
                              </li>
                          })}
                      </ul>
                </div>
                <div className="space-y-5">
                  <p>modules to add</p>
                      <div className="  h-64 overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
                          {modulesToAdd.map((module,index)=>{
                          return <div key ={`${module}-${index}`} className="flex items-center gap-2">
                          <div className="flex-grow">{module}</div>
                          <Button type="button" variant={"ghost"} className="p-0" onClick={()=>handleAddModule(module)}><Check color="green"/></Button>
                          </div>
                          })}
                      </div>
                </div>
            <div className="items-center justify-end flex col-span-2 space-x-10">
            <Button type="reset" onClick={()=>{
              setAvailableModules(defaultModels)
              form.reset()
            }} variant={"secondary"} >Default values</Button>
            <Button type="submit" disabled={isLoading}>{isLoading?"Loading...":"Create Class"}</Button>
            </div>
        </form>
      </Form>
    </>
  }

export default CreateClass