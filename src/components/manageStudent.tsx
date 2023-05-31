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
import * as z from "zod";
import { X, Search } from "lucide-react";
import axios from "axios";
import { RoledUserArraySchema, RoledUserType } from "@/models/auth0_schemas";

import ManagedStudentOption from "./ManageStudentOption";

const formSchema = z.object({
  studentId: z.string().trim().email().nonempty(),
});

interface searchProps {
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setData: Dispatch<SetStateAction<RoledUserType | undefined>>;
}

const SearchStudent: FC<searchProps> = ({ loading, setLoading, setData }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: "",
    },
  });
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setData(undefined);
    setLoading(true);
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/users?studentId=${values.studentId}`
      );
      const data = RoledUserArraySchema.parse(response.data);
      if (!data.length) {
        form.setError("studentId",{message:"Invalid student ID!"})
        setLoading(false);
        return
      }
      const student = data[0]
      if(student.roles.includes("managedStudent")||student.roles.includes("unmanagedStudent")){
        setData(data[0]);
      }else{
        form.setError("studentId",{message:"Invalid student ID!"})
      }
    } catch (error: any) {
      console.log(error?.response?.data?.message ?? error?.message ?? error);
    }
    setLoading(false);
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
                      disabled={loading}
                    >
                      {loading ? "loading..." : "search"}
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
  const [studentData, setStudentData] = useState<RoledUserType | undefined>();
  const [isLaoding, setIsLaoding] = useState<boolean>(false);

  const reload = async()=>{
    if(!studentData||isLaoding) return
    setIsLaoding(true);
    const email = studentData.email;
    setStudentData(undefined)
    try {
      // console.log(values);
      const response = await axios.get(
        `/api/users?studentId=${email}`
      );
      const data = RoledUserArraySchema.parse(response.data);
      if (data.length) {
       setStudentData(data[0]);
      }
    } catch (error: any) {
      console.log(error?.response?.data?.message ?? error?.message ?? error);
    }
    setIsLaoding(false);
  }

  return (
    <>
    <SearchStudent
          loading={isLaoding}
          setLoading={setIsLaoding}
          setData={setStudentData}
        />
        {studentData ? 
          <div className="my-8">
            <p>{studentData.name}</p>
            <p>Type: {studentData.roles.join(",")}</p>
            {studentData.roles.includes("managedStudent")?<ManagedStudentOption student={studentData} reload={reload} isLoading={isLaoding} setIsLoading={setIsLaoding}/>:null}
          </div>
         :null}
    </>
  );
};

export default ManageStudent;
