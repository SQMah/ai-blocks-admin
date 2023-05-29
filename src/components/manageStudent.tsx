import { FC, useState,Dispatch,SetStateAction, useEffect } from "react";
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
import * as z from "zod";
import { X, Search } from "lucide-react";
import axios from "axios";

import { UserWithRole } from "@/models/auth0_interfaces";
import { SearchResoponse } from "@/lib/auth0_user_management";

const formSchema = z.object({
  studentId: z.string().min(1, { message: "This field is reqired" }),
});

interface searchProps{
  loading:boolean
  setLoading:Dispatch<SetStateAction<boolean>>
  setData:Dispatch<SetStateAction<UserWithRole|undefined>>
}

const SearchStudent: FC<searchProps> = ({loading,setLoading,setData}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setData(undefined)
      setLoading(true)
      console.log(values);
      const response = await axios.get(`/api/users?studentId=${values.studentId}`)
      form.reset();
      const data:SearchResoponse = response.data
      if(data.length){
        setData(data[0])
      }
      setLoading(false)
    } catch (error:any) {
      console.log(error.response.message||error.message)
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-1/2">
          <FormField
            control={form.control}
            name="studentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  Find by student ID
                  <Search size={16} />
                </FormLabel>
                <div className="flex gap-5 items-center">
                  <Input placeholder="Search..." {...field}></Input>
                  <Button
                    onClick={() => form.reset()}
                    variant={"ghost"}
                    className="p-1"
                    type="reset"
                  >
                    <X size={30} />
                  </Button>
                  <FormControl>
                    <Button type="submit" className=" rounded-xl" disabled={loading}> 
                      {loading?"loading...":"search"}
                    </Button>
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </>
  );
};



const ManageStudent: FC = () => {
  const [stduentData,setStudentData] = useState<UserWithRole>()
  const [isLaoding,setIsLaoding] = useState<boolean>(false)

  useEffect(()=>{

  },[stduentData])

  return (
    <>
      <div className="m-8">

      <SearchStudent loading={isLaoding} setLoading={setIsLaoding} setData={setStudentData} />
      {stduentData?<>
        <p>{stduentData.name}</p>
        <p>Type: {stduentData.roles.join(",")}</p>
      </>:null}
      </div>
    </>
  );
};

export default ManageStudent;
