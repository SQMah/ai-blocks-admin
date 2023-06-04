import { FC, Dispatch, SetStateAction } from "react";
import axios from "axios";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

import { PutUsersReqType, SetExpriationSchema } from "@/models/api_schemas";
import { RoledUserType } from "@/models/auth0_schemas";
import { validDateString,expirated } from "@/lib/utils";

interface props {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  reload: () => Promise<void>;
  user: RoledUserType;
}

const formSchema = z.object({
  account_expiration_date: SetExpriationSchema,
});

const UpdateExpiration: FC<props> = ({isLoading,setIsLoading,reload,user,}) => {

  const expiration = user.user_metadata?.account_expiration_date
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account_expiration_date:"",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const payload: PutUsersReqType = {
        userId: user.user_id,
        content:{
          account_expiration_date: values.account_expiration_date,
        }
      };
      const response =await  axios.put("/api/users",payload)
      await reload();
    } catch (error: any) {
      console.log(error?.response?.data?.message ?? error?.message ?? error);
    }
    setIsLoading(false);
  };
  const isSame = expiration === form.watch("account_expiration_date")||form.watch("account_expiration_date")===""
  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading} variant={"secondary"} className="">
            {isLoading ? "loading..." : "Edit account expiration"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update expiration date</DialogTitle>
              <DialogDescription>
               Update the expiration date of {user.name}. Click save when you're done.
              </DialogDescription>
            </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="account_expiration_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="date update">
                  Update Expirtaion
                </FormLabel>
                  <Input
                    id = "date update"
                    {...field}
                    type="date"
                  ></Input>
                <FormDescription>
                <span className=" space-x-3"><span>Current expiration date:</span> 
                {expiration?<span>{expiration}</span>:<span className=" text-destructive">None</span>}
                {expiration&&validDateString(expiration)&&expirated(expiration)?<span className="text-destructive">{" (Expirated)"}</span>:null}
                </span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            <DialogFooter>
              <FormControl>
              <Button type="submit" disabled={isLoading||isSame} >
                {isLoading ? "Loading..." : "Save changes"}
              </Button>
              </FormControl>
            </DialogFooter>
        </form>
      </Form>
        </DialogContent>
      </Dialog>
      
    </>
  );
};

export default UpdateExpiration;
