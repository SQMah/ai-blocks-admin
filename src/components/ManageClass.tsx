import { FC, FormEvent,useState, Dispatch, SetStateAction, useId, useEffect} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {z}from "zod";
import { X, Search,Check} from "lucide-react";
import axios, { AxiosError } from "axios";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "./ui/input";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "./ui/use-toast";
import { Label } from "./ui/label";

import { cn, ClientErrorHandler } from "@/lib/utils"
import { RoledUserArrayType, RoledUserType ,modulesReady} from "@/models/auth0_schemas";
import ShowExpiration from "./ShowExpiration";
import { UpdateAllExpiration } from "./UpdateExpiration";
import RemoveStudentFromClass from "./removeStudentFromClass";
import DeleteClass from "./DeleteClass";
import { BatchGetClassesResSchema, BatchGetClassesType,GetClassesResSchema, GetClassesResType, GetUserResSchema, PutClassesReqType, PutClassesResSchema, SearchUsersResSchema, SearchUsersResType } from "@/models/api_schemas";



const formSchema = z.object({
  userId: z.string().trim().email().nonempty(),
});

interface Props {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  handleChangeClass :(data:GetClassesResType|undefined)=>Promise<void>
}


const SearchTeacher: FC<Props> = ({ isLoading,setIsLoading,handleChangeClass}) => {
    const [teacher,setTeacher] = useState<RoledUserType | undefined>();
    const [teaching,setTeaching] = useState<BatchGetClassesType>([])
    //error message when select class
    const [classErrorMessage,setClassErrorMessage] = useState<string>("")
    const {toast} = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "",
    },
  });
  //handle search serach teacher
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setTeacher(undefined);
    setTeaching([])
    await handleChangeClass(undefined)
    setIsLoading(true);
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/v1/users/${values.userId}`
      );
      const data = GetUserResSchema.parse(response.data);
      if (!data.roles.includes("teacher")) {
        form.setError("userId",{message:"Invalid teacher ID!"})
        setIsLoading(false);
        return
      }
      setTeacher(data);
      const teachingIds = data.user_metadata?.teaching_class_ids?.filter(id=>id.length)
      if(teachingIds?.length){
        const {data:classes} = await axios.get('/api/v1/classes?'+teachingIds.map(id=>`class_id=${id}`).join("&"))
        setTeaching(BatchGetClassesResSchema.parse(classes))
      }
    } catch (error: any) {
      if(error instanceof AxiosError && error.response?.status===404){
        form.setError("userId",{message:"Invalid teacher ID!"})
      }else{
        const handler = new ClientErrorHandler(error)
        handler.log()
        toast({
          variant:"destructive",
          title: "Search error",
          description: handler.message,
        })
      }
    }
    setIsLoading(false);
  };

  //handle select class
  const handleSelect =async (selectedId:string) => {
    // console.log("selected",selectedIds)
    setClassErrorMessage("")
    if(isLoading) return
    setIsLoading(true)
    try {
      const response = await axios.get(`/api/v1/classes/${selectedId}`)
      const data = GetClassesResSchema.parse(response.data)
      await handleChangeClass(data)
    } catch (error:any) {
      if(error instanceof AxiosError && error.response?.status===404){
        setClassErrorMessage("Inaccessible class")
        setTeaching(prev=>prev.filter(entry=>entry.class_id!==selectedId))
        await handleChangeClass(undefined)
      }else{
        const handler = new ClientErrorHandler(error)
        handler.log()
        toast({
          variant:"destructive",
          title:"Search lass Error",
          description:handler.message
        })
      }
    }
    setIsLoading(false)
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-1/2 my-4">
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  Find by teacher ID (email)
                  <Search size={16} />
                </FormLabel>
                <div className="flex gap-5 items-center">
                  <Input
                    placeholder="Search..."
                    {...field}
                    type="email"
                  ></Input>
                  <FormControl>
                  <Button
                    onClick={() => form.reset()}
                    variant={"ghost"}
                    className="p-1"
                    type="reset"
                  >
                    <X size={30} />
                  </Button>
                  </FormControl>
                  <FormControl>
                    <Button
                      type="submit"
                      className=" rounded-xl"
                      disabled={isLoading}
                    >
                      {isLoading ? "loading..." : "search"}
                    </Button>
                  </FormControl>
                </div>
                <FormMessage/>
              </FormItem>
            )}
          />
        </form>
      </Form>{
        teacher?<>
        <div className="my-4 flex space-x-10 items-center">
            <p className="space-x-1">
                <span>Name: </span>
                <span>{teacher.name}</span>
            </p>
            <Select onValueChange={handleSelect} disabled={isLoading}>
              <SelectTrigger className="w-1/6">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                <SelectLabel>Class</SelectLabel>
                {teaching.map(entry=>{
                  return <SelectItem  key={`select-${entry.class_id}`} value={entry.class_id}>{entry.class_name}</SelectItem>
                })}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className=" text-destructive text-sm">{classErrorMessage}</p>
        </div>
        </>:null
      }
    </>
  );
};


const InputClassID:FC<Props> = ({ isLoading,setIsLoading,handleChangeClass})=>{
    const [value,setValue] = useState<string>("")
    const [message,setMessage] = useState<string>("")
    const {toast} = useToast()
    const inputId = useId()

    const handleSubmit = async(e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault()
        const input = value.trim()
        if(!input.length){
            setMessage("Please fill in class ID.")
            return
        }
        if(isLoading) return
        setIsLoading(true)
        try {
          // console.log("/api/v1/classes?class_id="+class_id)
          const {data} = await axios.get("/api/v1/classes/"+input)
          if(!data){
            setMessage("Invalid class ID")
            await handleChangeClass(undefined)
            setIsLoading(false)
            return
          }
          await handleChangeClass(GetClassesResSchema.parse(data))
        } catch (error:any) {
          if(error instanceof AxiosError&&error.response?.status===404){
            setMessage("Invalid class ID")
          }else{
            const handler = new ClientErrorHandler(error)
            handler.log()
            toast({
              title:"Search Error",
              description:handler.message,
              variant:"destructive"
            })
          }
          await handleChangeClass(undefined)
        }
        setIsLoading(false)
    }

    return<>
    <form className="my-4 w-1/2 space-y-2" onSubmit={handleSubmit}>
         <Label className={cn("flex gap-2 items-center",message.length?"text-destructive":"")} htmlFor={inputId}>
            Find by class ID
            <Search size={16} />
        </Label>
        <div className="flex gap-5 items-center" id={inputId}>
                  <Input
                    placeholder="Search..."
                    value={value}
                    onChange={(e)=>{setValue(e.target.value);setMessage("")}}
                  ></Input>
                  <Button
                    onClick={() => setValue("")}
                    variant={"ghost"}
                    className="p-1"
                    type="reset"
                  >
                    <X size={30} />
                  </Button>
                    <Button
                      type="submit"
                      className=" rounded-xl"
                      disabled={isLoading}
                    >
                      {isLoading ? "loading..." : "search"}
                    </Button>
        </div>
        <div className="text-sm font-medium text-destructive">{message}</div>
    </form>
    </>

}

interface CapacProps extends Props{
  data:GetClassesResType
}

const UpdateCapacity:FC<CapacProps> =({isLoading,setIsLoading,handleChangeClass,data})=>{
  const {toast} = useToast()
  const updateScehma = z.object({
    
    capacity:z.string().nonempty({message:"Required"}).refine(cap=>{
      return Number(cap) > 0
    },{message:"Capacity must greater than 0."}).refine(input=>{
      const cap = Number(input)
      return cap !==data.capacity
    },{message:"Updated capacity must not be same as the old value."})
    .refine(cap=>!isNaN(Number(cap)),{message:"Invalid input"})
  })

  const form = useForm<z.infer<typeof updateScehma>>({
    resolver: zodResolver(updateScehma),
    defaultValues: {
      capacity:String(data.capacity)
    },
  });

  const onSubmit = async(values:z.infer<typeof updateScehma>)=>{
    if(isLoading) return 
    setIsLoading(true)
    try {
      const payload:PutClassesReqType = {
        class_id:data.class_id,
        capacity:Number(values.capacity)
      }
      const response = await axios.put('/api/v1/classes',payload)
      toast({
        title:"Updated"
      })
      await handleChangeClass(PutClassesResSchema.parse(response.data))
    } catch (error:any) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Update error",
        description: handler.message,
      })
      setIsLoading(false)
    }
  }

  const disableSave = form.watch("capacity") === String(data.capacity)

  return<>
    <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading} variant={"secondary"} className="">
            {isLoading ? "loading..." : "Update class capacity"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update capacity</DialogTitle>
              <DialogDescription>
               Update the capacity of {data.class_id}. Click save when you are done.
              </DialogDescription>
            </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="update cap">
                  Update Capacity
                </FormLabel>
                <Input
                    id = "update cap"
                    type="number"
                    min="1"
                    {...field}
                      />
                <FormDescription>
                <span>Current number of students: {data.student_ids.length}. Current capacity: {data.capacity}</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            <DialogFooter>
              <FormControl>
              <Button type="submit" disabled={isLoading||disableSave} className="mt-4"> 
                {isLoading ? "Loading..." : "Save changes"}
              </Button>
              </FormControl>
            </DialogFooter>
        </form>
      </Form>
        </DialogContent>
      </Dialog>
      
  </>
}

interface NameProps extends Props{
  data:GetClassesResType
}

const UpdateName:FC<NameProps> =({isLoading,setIsLoading,handleChangeClass,data})=>{
  const {toast} = useToast()
  const updateScehma = z.object({
   class_name:z.string().trim().nonempty({message:"Required"})
   .refine(input=>input!==data.class_name
    ,{message:"Updated class name must not be same as the old name."})
  })

  const form = useForm<z.infer<typeof updateScehma>>({
    resolver: zodResolver(updateScehma),
    defaultValues: {
      class_name:data.class_name
    },
  });

  const onSubmit = async(values:z.infer<typeof updateScehma>)=>{
    if(isLoading) return 
    setIsLoading(true)
    try {
      const payload:PutClassesReqType = {
        class_id:data.class_id,
        class_name:values.class_name.trim()
      }
      const response = await axios.put('/api/v1/classes',payload)
      toast({
        title:"Updated"
      })
      await handleChangeClass(PutClassesResSchema.parse(response.data))
    } catch (error:any) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Update error",
        description: handler.message,
      })
      setIsLoading(false)
    }
  }

  const disableSave = form.watch("class_name") === data.class_name

  return<>
    <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading} variant={"secondary"} className="">
            {isLoading ? "loading..." : "Update class name"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update class name</DialogTitle>
              <DialogDescription>
               Update the name of {data.class_id}. Click save when you are done.
              </DialogDescription>
            </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="class_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="update name">
                  Update Class Name
                </FormLabel>
                <Input
                    id = "update name"
                    {...field}
                      />
                <FormDescription>
                <span>Current class name: {data.class_name}.</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            <DialogFooter>
              <FormControl>
              <Button type="submit" disabled={isLoading||disableSave} className="mt-4"> 
                {isLoading ? "Loading..." : "Save changes"}
              </Button>
              </FormControl>
            </DialogFooter>
        </form>
      </Form>
        </DialogContent>
      </Dialog>
      
  </>
}




const ManageClass: FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [data, setData] = useState<GetClassesResType|undefined>()

  const [users,setUsers] = useState<SearchUsersResType>([])
  const teachers= users.filter(user=>user.roles.includes("teacher"))
  const students = users.filter(user=>user.roles.includes("managedStudent"))

  const [availableModules,setAvailableModules] = useState<string[]>([])
  const modulesToAdd:string[] = modulesReady.filter(module=>!availableModules.includes(module))
  const disableSave:boolean = data?.available_modules.toString()===availableModules.toString()

  const {toast} = useToast()

  const reload = async(currentClass:GetClassesResType|undefined = data)=>{
    // console.log(currentClass)
    if(!currentClass) return
    setAvailableModules(currentClass.available_modules)
    setIsLoading(true);
    //get the users
    try {
      const emails = currentClass.student_ids.concat(currentClass.teacher_ids)
      if(!emails.length){
        setIsLoading(false);
        return
      }
      let url = `/api/v1/users?type=OR`
      for(const email of emails){
        url+=`&email=${email}`
      }
      const response = await axios.get(url);
      const data = SearchUsersResSchema.parse(response.data);
      // console.log(data)
      setUsers(data)
    } catch (error: any) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Search error",
        description: handler.message,
      })
    }
    setIsLoading(false);
  }

  const handleChangeClass =async (payload:GetClassesResType|undefined):Promise<void> => {
    // console.log(payload)
    setData(payload)
    setUsers([])
    setAvailableModules(payload?.available_modules??[])
    if(!payload) return
    await reload(payload)
  }
  

  const handleAddModule = (toAdd:string)=>{
    setAvailableModules(prev=>[...prev,toAdd].sort())
  }
  const handleRemoveModule = (toRemove:string)=>{
    setAvailableModules(prev=>prev.filter(module=>module!==toRemove).sort())
  }
  const handleSaveModules = async ()=>{
    if(!data) return
    setIsLoading(true)
    try {
        //fetch server
        const payload:PutClassesReqType = {
            class_id:data.class_id,
            available_modules:availableModules
        }
        // console.log(payload)
        const response = await axios.put("/api/v1/classes",payload)
        toast({
          title:"Updated"
        })
        const updated = PutClassesResSchema.parse(response.data)
        await handleChangeClass(updated)
    } catch (error:any) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Update error",
        description: handler.message,
      })
    }
    setIsLoading(false)
  }
  

  return (
    <>
    <div className="m-8">
    {/* <div>Class ID: {classId}</div> */}
    <Tabs defaultValue="teacher" className="">
    <div className="flex justify-center">
      <TabsList className="">
        <TabsTrigger value="teacher">By teacher</TabsTrigger>
        <TabsTrigger value="classId">By class ID</TabsTrigger>
      </TabsList>
    </div>
      <TabsContent value="teacher">
        <SearchTeacher {...{isLoading,setIsLoading,handleChangeClass} }/>
        </TabsContent>
        <TabsContent value="classId">
        <InputClassID {...{isLoading,setIsLoading,handleChangeClass} }/>
        </TabsContent>
      </Tabs>
      {data&&!isLoading?<>
      {/* <pre>{JSON.stringify(data,null,2)}</pre> */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3 col-span-2">
          <p>Class ID:</p>
          <p>{data.class_id}</p>
          <p>Class Name:</p>
          <div className=" space-x-24"><span>{data.class_name}</span> <UpdateName {...{isLoading,setIsLoading,handleChangeClass,data}}/></div>
          <p>Teachers in class:</p>
          <p className="space-x-3">{teachers.map((teacher,index)=>{
            return <span key={`${teacher.email}-${index}`}>{`${teacher.name} (${teacher.email})`}</span>
          })}</p>
        </div>
        <div className=" space-y-3">
            <div className="flex space-x-4 items-center">
              <p>Students ({students.length}/{data.capacity})</p>
              <UpdateCapacity {...{isLoading,setIsLoading,handleChangeClass,data}}/>
            </div>
            <div className="h-2/3 overflow-auto w-full rounded-md border border-input bg-transparent px-3 py-2 ">
                <ul>
                    {students.map((student,index)=>{
                    return <li key ={`${module}-${index}`} className="flex items-center  space-x-4">
                            <span>{`${index+1}.`}</span>
                            <span className="mx-4">{student.name}</span>
                            <span>{student.email}</span>
                            <ShowExpiration expiration={student.user_metadata?.account_expiration_date} content=""/>
                            <div className="flex-grow flex justify-end">
                              <RemoveStudentFromClass {...{student,reload,isLoading,setIsLoading}}/>
                            </div>
                        </li>
                    })}
                </ul>
            </div>
            <UpdateAllExpiration {...{isLoading,setIsLoading,users:students,reload}}/>
        </div>
        <div className=" space-y-3">
            <p>current modules</p>
            <div className=" min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
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
            <div className="flex justify-end">
                <Button disabled={isLoading||disableSave} onClick={handleSaveModules}>{isLoading?"loading...":"Save module changes"}</Button>
            </div>
            </div>
        </div>
      </>:null}
      {
      data?.class_id?
      <div className="flex justify-end w-full my-8">
        <DeleteClass {...{students,teachers,handleChangeClass,isLoading,setIsLoading,classId:data.class_id}}/>
      </div>:null
      }
    </div>
    </>
  );
};

export default ManageClass;
