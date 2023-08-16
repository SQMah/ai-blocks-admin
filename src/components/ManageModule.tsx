import { Module } from "@/models/db_schemas";
import { FC, Dispatch, SetStateAction, useState, useEffect, useId } from "react";
import { X } from "lucide-react";

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
} from "@/components/ui/alert-dialog";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "./ui/use-toast";
import { ClientErrorHandler } from "@/lib/utils";
import { requestAPI } from "@/lib/request";
import { getModulesResSchema } from "@/models/api_schemas";
import { trimedNonEmptyString } from "@/models/utlis_schemas";

const ManageModule: FC<{}> = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [modules, setModules] = useState<Module[]>([]);
  const { toast } = useToast();

  const reload = async () => {
    setIsLoading(true)
    try {
        const res = await requestAPI("modules", "GET", { module_id: [] }, {})
        const data = getModulesResSchema.parse(res)
        setModules(data)
    } catch (error) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Search module error",
        description: handler.message,
      });
    }
    setIsLoading(false)
  };

  useEffect(()=>{
    reload()
  },[])

  return (
    <>
      <div className="space-y-4">
      <p>All modules:</p>
      <ul className="max-h-[24rem]  min-h-[10rem] overflow-auto rounded-md border border-input bg-transparent px-3 py-2 ">
          {modules.map((module, index) => {
            const { module_id, module_name } = module;
            return (
              <li
                key={`${module_id}-${index}`}
                className="flex items-center  space-x-4"
              >
                <span className="mx-4">{module_name}</span>
                <span>{module_id}</span>
                <div className="flex-grow flex justify-end">
                  <RemoveModule {...{ isLoading, setIsLoading,reload,module }} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
            <AddModule {...{ isLoading, setIsLoading,reload }}/>
        </div>
      </div>
    </>
  );
};

interface props {
  reload: () => Promise<void>;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const formSchema = z.object({
    module_name:trimedNonEmptyString
})

const AddModule:FC<props>=(props)=>{
    const {reload,isLoading,setIsLoading}= props
    const {toast} = useToast()
    const inputId = useId()
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
          module_name:"",
        },
      });
      const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true);
        try {
          const payload={
            module_name : values.module_name
          }
          const response =await  requestAPI("modules","POST",{},payload)
          toast({
            title:"Updated"
          })
          await reload();
        } catch (error: any) {
          const handler = new ClientErrorHandler(error)
          handler.log()
          toast({
            variant:"destructive",
            title: "Create Module Error",
            description: handler.message,
          })
    
        }
        setIsLoading(false);
      };

      const disableSave = !form.watch("module_name").length

    return <>
        <Dialog>
        <DialogTrigger asChild>
          <Button disabled={isLoading} variant={"default"} className="">
            {isLoading ? "loading..." : "Create Module"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Module</DialogTitle>
              <DialogDescription>
              Add new module. Click save when you are done.
              </DialogDescription>
            </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='module_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor={inputId}>
                  Module name
                </FormLabel>
                  <Input
                    id = {inputId}
                    {...field}
                    type="text"
                  ></Input>
                <FormDescription>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
            <DialogFooter>
              <FormControl>
              <Button type="submit" disabled={isLoading||disableSave} >
                {isLoading ? "Loading..." : "Create"}
              </Button>
              </FormControl>
            </DialogFooter>
        </form>
      </Form>
        </DialogContent>
      </Dialog>
    </>

}


const RemoveModule: FC<props&{module:Module}> = ({
  reload,
  isLoading,
  setIsLoading,
  module,
}) => {
  const { toast } = useToast();

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      // console.log(paylaod)
      //update user data and class data by single api call
      const response = await requestAPI(
        "modules",
        "DELETE",
        { module_id: module.module_id },
        {}
      );
      await reload();
    } catch (error: any) {
      const handler = new ClientErrorHandler(error);
      handler.log();
      toast({
        variant: "destructive",
        title: "Remove error",
        description: handler.message,
      });
    }
    setIsLoading(false);
  };

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={"ghost"}>
            <X color="red" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you absolutely sure to delete {module.module_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanentlydelete{" "}
              {module.module_name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={handleRemove}>
              {isLoading ? "Loading..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};



export default ManageModule;
