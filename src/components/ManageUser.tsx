import { FC, useState, Dispatch, SetStateAction} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {z}from "zod";
import { X, Search,Check } from "lucide-react";
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
import { Input } from "./ui/input";
import { useToast } from "./ui/use-toast";

import {  RoledUserType ,roleMapping} from "@/models/auth0_schemas";
import { BatchGetClassesResSchema, GetUserResSchema, GetUserResType, PutClassesReqType, PutUsersReqType } from "@/models/api_schemas";

import {ManagedStudentOption,UnmanagedStudentOption }from "./ManageStudentOptions";
import {UpdateExpiration} from "./UpdateExpiration";
import DeleteUser from "./DeleteUser";
import ShowExpiration from "./ShowExpiration";
import { delay, ClientErrorHandler} from "@/lib/utils";


const formSchema = z.object({
  userId: z.string().trim().email().nonempty(),
});

interface searchProps {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<RoledUserType | undefined>>;
}

const SearchUser: FC<searchProps> = ({ isLoading,setIsLoading,setUser }) => {
  const { toast } = useToast()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: "",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setUser(undefined);
    setIsLoading(true);
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/v1/users/${values.userId}`
      );
      const data = GetUserResSchema.parse(response.data)
      setUser(data);
    } catch (error: any) {
      if(error instanceof AxiosError&& error.response?.status===404){
        form.setError("userId",{message:"Invalid user ID!"})
      }else{
        const handler = new ClientErrorHandler(error)
        handler.log()
        toast({
          variant:"destructive",
          title: "Search User Error",
          description: handler.message,
        })
      }
    }
    setIsLoading(false);
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-1/2">
          <FormField
            control={form.control}
            name="userId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  Find by user ID (email)
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
      </Form>
    </>
  );
};


interface TeacherOptionProps{
  teacher:RoledUserType,
  reload:()=>Promise<void>,
  isLoading:boolean,
  setIsLoading:Dispatch<SetStateAction<boolean>>
}

const classFromSchema = z.object({
  teaching_class_ids_str:z.string().trim().nonempty({message:"Required"}),  
})

type ClassForm = z.infer<typeof classFromSchema>

const TeacherOption:FC<TeacherOptionProps>=({teacher,reload,isLoading,setIsLoading})=>{
    const storedClaess= teacher.user_metadata?.teaching_class_ids?.sort()??[]
    const [displayClasses,setDisplayClaesses] = useState<string[]>(storedClaess)
    const [removed,SetRemoved]  = useState<string[]>([])
    const disableSave:boolean = storedClaess.toString()===displayClasses.toString()
    const classesToBeRemoved = removed.filter(id=>storedClaess.includes(id))

    const {toast} = useToast()

    const form = useForm<ClassForm>({
      resolver: zodResolver(classFromSchema),
      defaultValues: {
        teaching_class_ids_str:""
      },
    });

    const handleAddClass = (toAdd:string)=>{
      SetRemoved(prev=>prev.filter(id=>id!==toAdd).sort())
      setDisplayClaesses(prev=>[...prev,toAdd].sort())
    }

    const handleRemoveClass = (toRemove:string)=>{
      SetRemoved(prev=>[...prev,toRemove].sort())
      setDisplayClaesses(prev=>prev.filter(classId=>classId!==toRemove).sort())
    }
    const handleAddNew= async (values:ClassForm)=>{
      const classIds = values.teaching_class_ids_str.split(",").map(id=>id.trim()).filter(id=>id.length)
      if(!classIds.length){
        form.setError("teaching_class_ids_str",{message:"Required"})
        return
      }
      const overlap = classIds.filter(id=>storedClaess.includes(id))
      if(overlap.length){
        const message = `${overlap.join(", ")} are already included.`
        form.setError("teaching_class_ids_str",{message})
        return
      }
      setIsLoading(true)
      try {
        const {data} = await axios.get('/api/v1/classes?'+classIds.map(id=>`class_id=${id}`).join('&'))
        const present = BatchGetClassesResSchema.parse(data).map(entry=>entry.class_id)
        const missing = classIds.filter(id=>!present.includes(id))
        if(missing.length){
          const message = `${missing.join(", ")} are not valid class IDs.`
          form.setError("teaching_class_ids_str",{message})
          setIsLoading(false)
          return
        }
      } catch (error:any) {
        const handler = new ClientErrorHandler(error)
        handler.log()
        toast({
          variant:"destructive",
          title:"Search Class Error",
          description:handler.message
        })
        setIsLoading(false)
        return
      }
      setIsLoading(false)
      form.reset()
      setDisplayClaesses(prev=>prev.concat(classIds).sort())
    }
    
    const handleAssignClass = async ()=>{
      if(disableSave||isLoading) return
      form.clearErrors()
      setIsLoading(true)
      try {
        const payload:PutUsersReqType={
          email:teacher.email,
          content:{
            teaching_class_ids:displayClasses
          }
        }
        //class data will also be updated by this api
        const response =await  axios.put("/api/v1/users",payload)
        toast({
          title:"Updated",
        })
        SetRemoved([])
        await  reload()
      } catch (error:any) {
        const handler = new ClientErrorHandler(error)
        handler.log()
        toast({
          variant:"destructive",
          title:"Update User Error",
          description:handler.message
        })
      }
      setIsLoading(false)
    }
    

    return <>
      <div className=" space-y-5 w-2/3">
        <p>Current classes </p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
        <ul>
          {displayClasses.map((id,index)=>{
            return <li key ={`${id}-${index}`} className="flex items-center gap-2">
              <div className="flex-grow">{id}</div>
              <Button variant={"ghost"} className="p-0" onClick={()=>handleRemoveClass(id)}><X color="red"/></Button>
              </li>
          })}
        </ul>
        </div>
        <p>Classes to be removed</p>
        <div className=" min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 ">
        <ul>
          {removed.map((id,index)=>{
            return <li key ={`${module}-${index}`} className="flex items-center gap-2">
            <div className="flex-grow">{id}</div>
            <Button variant={"ghost"} className="p-0" onClick={()=>handleAddClass(id)}><Check color="green"/></Button>
            </li>
          })}
        </ul>
        </div>
        <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleAddNew)}
          className=""
        >
        <FormField
                control={form.control}
                name="teaching_class_ids_str"
                render={({ field }) => (
                  <FormItem className="">
                    <FormLabel>New class: </FormLabel>
                    <div className="flex items-center">
                    <FormControl>
                      <Input placeholder="Class IDs..." {...field} />
                    </FormControl>
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
                          {isLoading ? "loading..." : "Add"}
                        </Button>
                    </FormControl>
                    </div>
                    <FormDescription>{`Seperate class IDs by "," .`}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
             
           </form>
      </Form>
      <AlertDialog>
              <AlertDialogTrigger asChild>
              <Button disabled={isLoading||disableSave} >{isLoading?"loading...":"Save class changes"}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure to update the classes of {teacher.name} ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. {classesToBeRemoved.length?`This will permanently remove ${classesToBeRemoved.join(", ")} from the class list of ${teacher.name}.`:""}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction disabled={isLoading} onClick={handleAssignClass}>{isLoading?"Loading...":"Confirm"}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
      
      </div>
      
    </>

}



const ManageUser: FC = () => {
  const [user, setUser] = useState<GetUserResType | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const {toast} = useToast()
  const reload = async()=>{
    if(!user||isLoading) return
    setIsLoading(true);
    const email = user.email;
    setUser(undefined)
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/v1/users/${email}`
      );
      const data = GetUserResSchema.parse(response.data);
      setUser(data);

    } catch (error: any) {
      if(error instanceof AxiosError && error.response?.status===404){
        //deleted user
        setUser(undefined)
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
  }

  

  return (
    <>
    <SearchUser {...{isLoading,setIsLoading,setUser}} />
        {user ? 
          
          <div className="my-2 space-y-3">
            <p>Name: {user.name}</p>
            <p>Type: {user.roles.map(role=>roleMapping[role]?.name).join(",")}</p>
            {user.roles.includes("managedStudent")||user.roles.includes("unmanagedStudent")||user.roles.includes("teacher")?
            <div className=" space-x-3">
            <ShowExpiration expiration={user.user_metadata?.account_expiration_date}/>
            <span><UpdateExpiration {...{user,reload,isLoading,setIsLoading}}/></span>
            </div>
            :null}
            {user.roles.includes("managedStudent")?<ManagedStudentOption {...{student:user,reload,isLoading,setIsLoading}}/>:
            user.roles.includes("unmanagedStudent")?<UnmanagedStudentOption {...{student:user,reload,isLoading,setIsLoading}}/>:
            user.roles.includes("teacher")?<TeacherOption {...{teacher:user,reload,isLoading,setIsLoading}}/>:
            null}
            <div className=" flex justify-end">
            <DeleteUser {...{user,reload,isLoading,setIsLoading}}/>
            </div>
          </div>
         :null}
    </>
  );
};

export default ManageUser;
