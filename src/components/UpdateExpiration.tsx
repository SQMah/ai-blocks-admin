import { FC, Dispatch, SetStateAction, useState } from "react";
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
import { useToast } from "./ui/use-toast";

import { PutUsersReqType, SetExpriationSchema } from "@/models/api_schemas";
import { RoledUserType,RoledUserArrayType } from "@/models/auth0_schemas";
import {findEarliestDate,delay, ClientErrorHandler} from "@/lib/utils"
import ShowExpiration from "./ShowExpiration";


interface props {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  reload: () => Promise<void>;
  user: RoledUserType;
}

const formSchema = z.object({
  account_expiration_date: SetExpriationSchema,
});

export const UpdateExpiration: FC<props> = ({isLoading,setIsLoading,reload,user,}) => {
  const {toast} = useToast()

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
      const response =await  axios.put("/api/v1/users",payload)
      toast({
        title:"Updated"
      })
      await reload();
    } catch (error: any) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Update error",
        description: handler.message,
      })

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
               Update the expiration date of {user.name}. Click save when you are done.
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
                <ShowExpiration expiration={expiration} content="Current expiration date:"/>
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

interface AllProps{
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  reload: () => Promise<void> | ((id: string) => Promise<void>);
  users: RoledUserArrayType;
}

export const UpdateAllExpiration: FC<AllProps> = ({isLoading,setIsLoading,reload,users,}) => {
  const [updating,setUpdating] = useState<number>(0)
  const {toast} = useToast()

  const   eariliestExpiration = findEarliestDate(users.map(user=>user.user_metadata?.account_expiration_date))

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      account_expiration_date:"",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if(isLoading||form.watch("account_expiration_date").length===0)return
    let success = 0
    for(const user of users){
      setUpdating(prev=>prev+1)
      try {
        const payload: PutUsersReqType = {
          userId: user.user_id,
          content:{
            account_expiration_date: values.account_expiration_date,
          }
        };
        const response =await  axios.put("/api/v1/users",payload)
        await delay(500)
        success+=1
      } catch (error: any) {
        const handler = new ClientErrorHandler(error)
        handler.log()
        toast({
          variant:"destructive",
          title: "Update error for "+user.email,
          description: handler.message ,
        })
        continue
      }
    }
    toast({
      title:"Updated",
      description:`Updated expiration date for ${success} students`
    })
    await reload()
    setUpdating(0)
  };


  return (
    <>

      <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading||users.length===0} className="">
            {isLoading ? "loading..." : "Edit students' expirations"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Update expiration dates</DialogTitle>
              <DialogDescription>
               Update the expiration dates of all {users.length} students in this class. Click save when you are done.
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
                <ShowExpiration expiration={eariliestExpiration} content="Eariliest expiration date:"/>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            <DialogFooter>
              <FormControl>
              <Button type="submit" disabled={isLoading||updating>0} >
                {updating>0?`Updating ${updating}/${users.length} students`:isLoading ? "Loading..." : "Save changes"}
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

