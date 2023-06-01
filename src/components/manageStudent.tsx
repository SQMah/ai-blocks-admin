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
import { RoledUserArraySchema, RoledUserType ,roleMapping} from "@/models/auth0_schemas";

import {ManagedStudentOption,UnmanagedStudentOption }from "./ManageStudentOptions";

const formSchema = z.object({
  studentId: z.string().trim().email().nonempty(),
});

interface searchProps {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setStudent: Dispatch<SetStateAction<RoledUserType | undefined>>;
}

const SearchStudent: FC<searchProps> = ({ isLoading,setIsLoading,setStudent }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: "",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setStudent(undefined);
    setIsLoading(true);
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/users?studentId=${values.studentId}`
      );
      const data = RoledUserArraySchema.parse(response.data);
      if (!data.length) {
        form.setError("studentId",{message:"Invalid student ID!"})
        setIsLoading(false);
        return
      }
      const student = data[0]
      if(student.roles.includes("managedStudent")||student.roles.includes("unmanagedStudent")){
        setStudent(data[0]);
      }else{
        form.setError("studentId",{message:"Invalid student ID!"})
      }
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
            name="studentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex gap-2 items-center">
                  Find by student ID (email)
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






const ManageStudent: FC = () => {
  const [student, setStudent] = useState<RoledUserType | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const reload = async()=>{
    if(!student||isLoading) return
    setIsLoading(true);
    const email = student.email;
    setStudent(undefined)
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/users?studentId=${email}`
      );
      const data = RoledUserArraySchema.parse(response.data);
      if (data.length) {
       setStudent(data[0]);
      }
    } catch (error: any) {
      console.log(error?.response?.data?.message ?? error?.message ?? error);
    }
    setIsLoading(false);
  }

  return (
    <>
    <SearchStudent {...{isLoading,setIsLoading,setStudent}} />
        {student ? 
          <div className="my-2 space-y-3">
            <p>{student.name}</p>
            <p>Type: {student.roles.map(role=>roleMapping[role]?.name).join(",")}</p>
            {student.roles.includes("managedStudent")?<ManagedStudentOption {...{student,reload,isLoading,setIsLoading}}/>:
            student.roles.includes("unmanagedStudent")?<UnmanagedStudentOption {...{student,reload,isLoading,setIsLoading}}/>
            :null}
          </div>
         :null}
    </>
  );
};

export default ManageStudent;
