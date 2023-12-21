import { FC, useEffect, useState } from "react";
import { X, Check, Lock, Unlock } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "./ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ClientErrorHandler, capitalizeFirstLetter } from "@/lib/utils";
import { trimedNonEmptyString } from "@/models/utlis_schemas";
import { Module, groupTypeSchema } from "@/models/db_schemas";
import { requestAPI } from "@/lib/request";
import { batchGetUsersResSchema, getModulesResSchema, postGroupsResSchema } from "@/models/api_schemas";

const FormSchema = z.object({
  type: groupTypeSchema,
  group_name: trimedNonEmptyString,
  capacity: trimedNonEmptyString
    .refine(
      (cap) => {
        return Number(cap) > 0;
      },
      { message: "Capacity must greater than 0." }
    )
    .refine((input) => !isNaN(Number(input)), { message: "Invalid number" })
    .or(z.literal("")),
  manager_emails_str:z.string().trim().refine(
    (input) => {
      const idList = input
        .split(",")
        .filter((id) => id.length)
        .map((id) => id.trim());
      for (const id of idList) {
        if (!z.string().email().safeParse(id).success) {
          return false;
        }
      }
      return true;
    },
    {
      message: `Invalid email, please provide a list of email seperated by ","`,
    }
  ),
  student_emails_str:z.string().trim().refine(
    (input) => {
      const idList = input
        .split(",")
        .filter((id) => id.length)
        .map((id) => id.trim());
      for (const id of idList) {
        if (!z.string().email().safeParse(id).success) {
          return false;
        }
      }
      return true;
    },
    {
      message: `Invalid email, please provide a list of email seperated by ","`,
    }
  ),
});

type SelectedModule = Module&{
  locked:boolean
}


const CreateGroup: FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allModules,setAllModules] = useState<Module[]>([])
  const [seletcedModules,setSelectedModules] = useState<SelectedModule[]>([])
  const modulesToAdd= allModules.filter(m=>!(seletcedModules.map(s=>s.moduleId).includes(m.moduleId)))

  const { toast } = useToast();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      group_name: "",
      manager_emails_str: "",
      student_emails_str: "",
      capacity: "10",
    },
  });

  //get modules
  useEffect(()=>{
    requestAPI("modules","GET",{ module_id: [] },{})
    .then(data=>getModulesResSchema.parse(data))
    .then(modules=>setAllModules(modules))
    setSelectedModules([])
  },[])

  const onSubmit = async (values: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    try {
      const {group_name,capacity,manager_emails_str,student_emails_str,type} = values
      const isClass = type ==="class"
      const isFamily = type === "family"
      const managerRole = isClass?"teacher":isFamily?"parent":""
      const manager = manager_emails_str.split(",").map(s=>s.trim()).filter(s=>s.length)
      const students = student_emails_str.split(",").map(s=>s.trim()).filter(s=>s.length)
      const available_modules =isClass?seletcedModules.map(m=>m.moduleId):undefined
      const unlocked_modules = isClass?seletcedModules.filter(m=>m.locked===false).map(m=>m.moduleId):undefined
      if(isClass&&((students?.length??0)>Number(capacity))){
        console.log(Number(capacity),students)
        form.setError("capacity", {
          message: "Number of students exceeds capacity."
        });
        setIsLoading(false);
        return;
      }
      if(manager.length){
        try {
          const data = await requestAPI("users","GET",{email:manager},{})
          const users = batchGetUsersResSchema.parse(data)
          const unmatched = manager.filter(m=>!users.map(u=>u.email).includes(m) )
          if(unmatched.length){
            form.setError("manager_emails_str", {
              message: `Not found ${managerRole} emails: ${unmatched.join(",")}`,
            });
            setIsLoading(false);
            return;
          }
          const wrongRole = users.filter(u=>u.role!==managerRole)
          if(wrongRole.length){
            form.setError("manager_emails_str", {
              message: `Unmatched role ${managerRole} emails: ${wrongRole.map(u=>u.email).join(",")}`,
            });
            setIsLoading(false);
            return;
          }
        } catch (error) {
          const handler = new ClientErrorHandler(error);
          if (handler.isAxiosError && handler.status_code === 404) {
            form.setError("manager_emails_str", {
              message: handler.message.split(":")[2],
            });
            setIsLoading(false);
            return;
          }
          handler.log();
          toast({
            title: "Search error",
            description: handler.message,
          });
          setIsLoading(false);
          return;
        }
      }

      if(students.length){
        try {
          const data = await requestAPI("users","GET",{email:students},{})
          const users = batchGetUsersResSchema.parse(data)
          const unmatched = students.filter(m=>!users.map(u=>u.email).includes(m) )
          if(unmatched.length){
            form.setError("student_emails_str", {
              message: `Not found student emails: ${unmatched.join(",")}`,
            });
            setIsLoading(false);
            return;
          }
          const wrongRole = users.filter(u=>u.role!=="student")
          if(wrongRole.length){
            form.setError("student_emails_str", {
              message: `Unmatched role student emails: ${wrongRole.map(u=>u.email).join(",")}`,
            });
            setIsLoading(false);
            return;
          }
        } catch (error) {
          const handler = new ClientErrorHandler(error);
          if (handler.isAxiosError && handler.status_code === 404) {
            form.setError("student_emails_str", {
              message: handler.message.split(":")[2],
            });
            setIsLoading(false);
            return;
          }
          handler.log();
          toast({
            title: "Search error",
            description: handler.message,
          });
          setIsLoading(false);
          return;
        }
      }
      const body = {
        type:type,
        group_name,
        capacity:isClass?Number(capacity):-1,
        manager_emails:manager,
        student_emails:students,
        available_modules,
        unlocked_modules
      }
      // console.log(body)
      const data = await requestAPI('groups',"POST",{},body)
      const created = postGroupsResSchema.parse(data)

      toast({
        title: "Creation status",
        description: `Created group,type:${created.type}, name: ${created.groupName} ,ID: ${created.groupId}`,
      });
      form.reset();
      handleResetModules()
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Create Error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  const handleAddModule = (module:Module) => {
    setSelectedModules(prev=>[...prev,{...module,locked:true}])
  };
  const handleRemoveModule = (target:SelectedModule) => {
   setSelectedModules(prev=>prev.filter(m=>m.moduleId!==target.moduleId))
  };

  const handleLock = (target:SelectedModule)=>{
    const changed = seletcedModules.map(m=>m.moduleId===target.moduleId?({...m,locked:true}):m)
    setSelectedModules(changed)
  }

  const handleUnlock = (target:SelectedModule)=>{
    const changed = seletcedModules.map(m=>m.moduleId===target.moduleId?({...m,locked:false}):m)
    setSelectedModules(changed)
  }

  const handleResetModules = ()=>{
    setSelectedModules([])
  }

  const selectedType = form.watch("type")
  const managerType = selectedType==="class"?"teacher":selectedType==="family"?"parent":""

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className=" grid grid-cols-2  items-center gap-12"
        >
          <div className=" space-y-5 col-span-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a group type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="class">Class</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("type")?
            <>
            <FormField
              control={form.control}
              name='group_name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{capitalizeFirstLetter(selectedType)} name</FormLabel>
                  <FormControl>
                    <Input placeholder={`${capitalizeFirstLetter(selectedType)} name ...`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="manager_emails_str"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{capitalizeFirstLetter(managerType)} emails</FormLabel>
                  <FormControl>
                    <Input placeholder={`${managerType} emails ...`} {...field} />
                  </FormControl>
                  <FormDescription>{`Seperate ${managerType} emails by "," `}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
                <FormField
              control={form.control}
              name='student_emails_str'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Students emails</FormLabel>
                  <FormControl>
                    <Input placeholder={`students emails ...`} {...field} />
                  </FormControl>
                  <FormDescription>{`Seperate students emails by "," `}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            </>
            :null}
            {selectedType==="class"?
            <>
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class capacity</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          <div className="grid grid-cols-1 space-y-5 md:grid-cols-2 md:space-y-0 md:gap-4">
            <div className="space-y-5">
            <p>Modules to add </p>
            <ul className="max-h-[80%]  min-h-[50%] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
              {modulesToAdd.map((module, index) => {
                return (
                  <li
                    key={`${module.moduleId}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-grow">{module.moduleName}</div>
                    <Button
                      type="button"
                      variant={"ghost"}
                      className="p-0"
                      onClick={() => handleAddModule(module)}
                    >
                      <Check color="green" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            </div>
            <div className="space-y-5">
            <p>Modules selected </p>
            <ul className="max-h-[80%] min-h-[50%] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
              {seletcedModules.map((module, index) => {
                return (
                  <li
                    key={`${module.moduleId}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <div className="flex-grow">{module.moduleName}</div>
                    {module.locked?
                    <Button
                      type="button"
                      variant={"ghost"}
                      className="p-0"
                      onClick={() => handleUnlock(module)}
                    >
                      <Lock/>
                    </Button>
                    :
                    <Button
                      type="button"
                      variant={"ghost"}
                      className="p-0"
                      onClick={() => handleLock(module)}
                    >
                     <Unlock/>
                    </Button>
                    }
                    <Button
                      type="button"
                      variant={"ghost"}
                      className="p-0"
                      onClick={() => handleRemoveModule(module)}
                    >
                      <X color="red" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            </div>
          </div>
            </>
            :null}
          </div>
          {form.watch("type")?
          <div className="items-center justify-end flex col-span-2 space-x-10">
            <Button
              type="reset"
              onClick={() => {
                handleResetModules()
                form.reset();
              }}
              variant={"secondary"}
            >
              Default values
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Loading..." : "Create Class"}
            </Button>
          </div>
          :null}
        </form>
      </Form>
    </>
  );
};

export default CreateGroup;
