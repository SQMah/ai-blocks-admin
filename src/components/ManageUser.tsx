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


import {ManageStudent}from "./ManageStudent";
import {UpdateExpiration} from "./UpdateExpiration";
import DeleteUser from "./DeleteUser";
import ShowExpiration from "./ShowExpiration";
import { delay, ClientErrorHandler} from "@/lib/utils";
import { User } from "@/models/db_schemas";
import { requestAPI } from "@/lib/request";
import { emailSchema } from "@/models/utlis_schemas";
import { getUsersResSchema } from "@/models/api_schemas";
import { ManageManger } from "./ManageManager";


const formSchema = z.object({
  email:emailSchema
});

interface searchProps {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<User | undefined>>;
}

const SearchUser: FC<searchProps> = ({ isLoading,setIsLoading,setUser }) => {
  const { toast } = useToast()
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setUser(undefined);
    setIsLoading(true);
    try {
      // console.log(values);
      const data = await requestAPI("users","GET",{},{},values.email)
      const user = getUsersResSchema.parse(data)
      setUser(user);
    } catch (error: any) {
      if(error instanceof AxiosError&& error.response?.status===404){
        form.setError("email",{message:"Invalid email!"})
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  Find by email
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






const ManageUser: FC = () => {
  const [user, setUser] = useState<User | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const {toast} = useToast()
  const reload = async()=>{
    if(!user||isLoading) return
    setIsLoading(true);
    const email = user.email;
    setUser(undefined)
    try {
      const data = await requestAPI("users","GET",{},{},user.email)
      const updated = getUsersResSchema.parse(data)
      setUser(updated);

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
            <p>Role:{user.role}</p>
            {user.role==="parent"||user.role==="student"||user.role==="teacher"  ?
            <div className=" space-x-3">
            <ShowExpiration expiration={user.expiration_date}/>
            <span><UpdateExpiration {...{user,reload,isLoading,setIsLoading}}/></span>
            </div>
            :null}
            {user.role ==="student" ?<ManageStudent {...{student:user,reload,isLoading,setIsLoading}}/>:
           ( user.role ==="parent"||user.role==="teacher")?<ManageManger{...{manager:user,reload,isLoading,setIsLoading}}/>:
            //user.roles.includes("teacher")?<TeacherOption {...{teacher:user,reload,isLoading,setIsLoading}}/>:
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
