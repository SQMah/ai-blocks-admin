import { FC, useState, Dispatch, SetStateAction} from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "./ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {z}from "zod";
import { X, Search } from "lucide-react";
import axios from "axios";

import { validDateString,expirated } from "@/lib/utils";
import { RoledUserArraySchema, RoledUserType ,roleMapping} from "@/models/auth0_schemas";

import {ManagedStudentOption,UnmanagedStudentOption }from "./ManageStudentOptions";
import UpdateExpiration from "./UpdateExpiration";


const formSchema = z.object({
  userId: z.string().trim().email().nonempty(),
});

interface searchProps {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setUser: Dispatch<SetStateAction<RoledUserType | undefined>>;
}

const SearchStudent: FC<searchProps> = ({ isLoading,setIsLoading,setUser }) => {
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
        `/api/users?email=${values.userId}`
      );
      const data = RoledUserArraySchema.parse(response.data);
      if (!data.length) {
        form.setError("userId",{message:"Invalid account ID!"})
        setIsLoading(false);
        return
      }
      const user = data[0]
      setUser(data[0]);
    } catch (error: any) {
      console.log(error?.response?.data?.message ?? error?.message ?? error);
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






const ManageUser: FC = () => {
  const [user, setUser] = useState<RoledUserType | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const expiration = user?.user_metadata?.account_expiration_date
  const reload = async()=>{
    setIsLoading(true);
    if(!user||isLoading) return
    const email = user.email;
    setUser(undefined)
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/users?email=${email}`
      );
      const data = RoledUserArraySchema.parse(response.data);
      if (data.length) {
       setUser(data[0]);
      //  console.log(data[0])
      }
    } catch (error: any) {
      console.log(error?.response?.data?.message ?? error?.message ?? error);
    }
    setIsLoading(false);
  }

  

  return (
    <>
    <SearchStudent {...{isLoading,setIsLoading,setUser}} />
        {user ? 
          
          <div className="my-2 space-y-3">
            <p>Name: {user.name}</p>
            <p>Type: {user.roles.map(role=>roleMapping[role]?.name).join(",")}</p>
            {user.roles.includes("managedStudent")||user.roles.includes("unmanagedStudent")||user.roles.includes("teacher")?
            <div className=" space-x-3"><span>Expiration date:</span> 
            {expiration?<span>{expiration}</span>:<span className=" text-destructive">None</span>}
            {expiration&&validDateString(expiration)&&expirated(expiration)?<span className="text-destructive">{" (Expirated)"}</span>:null}
            <span><UpdateExpiration {...{user,reload,isLoading,setIsLoading}}/></span>
            </div>
            :null}
            {user.roles.includes("managedStudent")?<ManagedStudentOption {...{student:user,reload,isLoading,setIsLoading}}/>:
            user.roles.includes("unmanagedStudent")?<UnmanagedStudentOption {...{student:user,reload,isLoading,setIsLoading}}/>
            :null}
          </div>
         :null}
    </>
  );
};

export default ManageUser;
