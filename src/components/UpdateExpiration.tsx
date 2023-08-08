import { FC, Dispatch, SetStateAction, useState } from "react";
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


import {findEarliestDate, ClientErrorHandler, parseDateStr} from "@/lib/utils"
import ShowExpiration from "./ShowExpiration";
import { User } from "@/models/db_schemas";
import { expirationDateStrSchema } from "@/models/utlis_schemas";
import { BatchPutUsersReq, PutUsersReq } from "@/models/api_schemas";
import { requestAPI } from "@/lib/request";
import { UserRole } from "@prisma/client";


interface props {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  reload: () => Promise<void>;
  user: User;
}

const formSchema = z.object({
  expiration_date: expirationDateStrSchema,
});

export const UpdateExpiration: FC<props> = ({isLoading,setIsLoading,reload,user,}) => {
  const {toast} = useToast()

  const expiration = user.expiration_date
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expiration_date:"",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      const payload={
        expiration_date:values.expiration_date
      }
      const response =await  requestAPI("users","PUT",{},payload,user.email)
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
  const isSame = expiration === parseDateStr(form.watch("expiration_date"))||form.watch("expiration_date")===""
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
            name="expiration_date"
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
  users: User[];
  role:UserRole
}

export const UpdateAllExpiration: FC<AllProps> = ({isLoading,setIsLoading,reload,users,role}) => {
  const {toast} = useToast()

  const   eariliestExpiration = findEarliestDate(users.map(user=>user.expiration_date))

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expiration_date:"",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if(isLoading||form.watch("expiration_date").length===0)return
    
    try {
      const data = {
        emails:users.map(user=>user.email),
        expiration_date:values.expiration_date
      }
      const update = await requestAPI("users","PUT",{},data)
    } catch (error) {
      const handler = new ClientErrorHandler(error)
      handler.log()
      toast({
        variant:"destructive",
        title: "Update error",
        description: handler.message,
      })
    }
    toast({
      title:"Updated",
      description:`Updated expiration date for ${users.length} students`
    })
    await reload()
  };


  return (
    <>

      <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading||users.length===0} className="">
            {isLoading ? "loading..." : `Edit ${role}s' expirations`}
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
            name="expiration_date"
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
              <Button type="submit" disabled={isLoading} >
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

