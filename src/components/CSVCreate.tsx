import {FC,useState,Dispatch,SetStateAction} from "react"
import Papa from "papaparse"
import { z} from "zod"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable} from "./ui/data-table"

import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "./ui/input"
import { Label } from "@radix-ui/react-label"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios"; 

import { getOrdinal } from "@/lib/utils"
import { UserRoleSchema} from "@/models/auth0_schemas"
import { PostUsersReqType, UserCreateCSVSchema, UserCreateCSVType,PostUsersResSchema,SetExpriationSchema } from "@/models/api_schemas"

type CSVData = {
    data: any[];
    errors: Papa.ParseError[];
    meta: Papa.ParseMeta|undefined;
};

const columns: ColumnDef<UserCreateCSVType>[] = [
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "first_name",
      header: "First Name",
    },
    {
      accessorKey: "last_name",
      header: "Last Name",
    },
]


interface CSVCreateProps{
    isLoading:boolean,
    setIsLoading:Dispatch<SetStateAction<boolean>>
}


const CSVCreate:FC<CSVCreateProps> = ({isLoading,setIsLoading})=>{
    const [csvData, setCsvData] = useState<CSVData>({
        data: [],
        errors: [],
        meta:undefined,
    });
    const [errorMessage,setErrorMessage] = useState<string>("")
    
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMessage('')
        const file = event.target.files?.[0];
        // console.log(file)
        if (!file) {
        return;
        }
    
        let results = await new Promise<CSVData>((resolve) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader:function(h) {
                h = h.trim().toLowerCase()
                switch(h) {
                    case "first name":
                    case "first_name":
                      return "first_name";
                    case "last name":
                    case "last_name":
                      return "last_name";
                    case "email":
                      return "email";
                    default:
                      return h;
                  }
            },
            complete: (results:CSVData) => resolve(results),
        });
        });
        const missingFields = Object.keys(UserCreateCSVSchema.shape).filter(field=>!results.meta?.fields?.includes(field))
        if(missingFields.length){
            setErrorMessage(`${missingFields.join(", ")} ${missingFields.length>1?"are":"is"} missing from file header.`)
            return
        }
        let safe = true
        results.data = results.data.map((row,index)=>{
            if(!safe) return row
            try {
                const user = UserCreateCSVSchema.parse(row)
                return user
            } catch (error:any) {
                safe = false
                if (error instanceof z.ZodError) {
                    const {issues} = error
                    console.log(issues);
                    setErrorMessage(`Fail to process the ${getOrdinal(index+1)} data, messages: ${
                        issues.map((issue,index)=>{
                            const {message,path} = issue
                            return `${index+1}. ${message} in ${path.join(", ")}`
                        }).join(". ")
                    }.`)
                }
            }
        })
        if(!safe) return
        setCsvData(results);
    };


    return <>
    <div className="grid w-full items-center gap-1.5">
      <Label htmlFor="picture">CSV:</Label>
      <Input id="picture" type="file" accept=".csv" onChange={handleFileUpload} className="max-w-sm  cursor-pointer"/>
      <p className="text-sm text-muted-foreground">Please upload a CSV file that includes the following headers: 'First name', 
      'Last name', and 'Email'. All three headers are required and must be present in the CSV file. 
      Please ensure that your CSV file is formatted correctly before uploading.</p>
      <p className="text-sm font-medium text-destructive">{errorMessage}</p>
    </div>
    {csvData.data.length?<div className="grid grid-cols-2 gap-4">
        <DataTable columns={columns} data={csvData.data} pageSize={5}/>
        <Create  {...{setIsLoading,isLoading,users:csvData.data}}/>
    </div>:null}
    {/* <pre>{JSON.stringify(csvData,null,3)}</pre> */}
    </>
    
}

const formSchema= z.object({
    role: UserRoleSchema,
    enrolled_class_id: z.string().optional(),
    teaching_class_ids_str:z.string().optional(),  
    available_modules:z.array(z.string()).optional(),
    account_expiration_date:  SetExpriationSchema.or(z.literal("")).optional(),
  }).refine((input)=>{
    if(input.role==="managedStudent"){
      return input.enrolled_class_id?.length
    }else return true
  },{path:["enrolled_class_id"],message:"Enrolled class ID is required for student account"}
  ).refine(input=>{
    if(input.role!=="admin"){
      return input.account_expiration_date?.length
    }else return true
  },{path:["account_expiration_date"],message:`Expiration date is required`})

type formType = z.infer<typeof formSchema>

interface formProps{
    users:UserCreateCSVType[],
    isLoading:boolean,
    setIsLoading:Dispatch<SetStateAction<boolean>>
}

const Create: FC<formProps> = ({isLoading,setIsLoading,users}) => {

    const form = useForm<formType>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        enrolled_class_id:"",
        teaching_class_ids_str:"",
        account_expiration_date:"",
      },
    });
  
    const onSubmit = async (values: formType) => {
      setIsLoading(true)
      try {
        const {role,enrolled_class_id,teaching_class_ids_str,available_modules,account_expiration_date} = values
        const payload: PostUsersReqType = { 
          users,role,
          ...(role === "managedStudent" && { enrolled_class_id }),
          ...(role==="unmanagedStudent"&&{available_modules}),
          ...(role==="teacher"&&{teaching_class_ids:teaching_class_ids_str?.split(",").filter(id=>id.length)??[]}),
          ...(role !== "admin" && { account_expiration_date }),
        };      
        // console.log(payload)
        const response = await axios.post("/api/users", payload);
        const data = PostUsersResSchema.parse(response.data)
        console.log(data.messages);
      } catch (error: any) {
        console.log(error?.response?.data?.messages??error?.message??error)
      }
      setIsLoading(false)
    };
  
    return (
      <>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher account</SelectItem>
                      <SelectItem value="managedStudent">
                        Student account
                      </SelectItem>
                      <SelectItem value="unmanagedStudent">
                        Unmanaged student account
                      </SelectItem>
                      <SelectItem value="admin">Admin account</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.watch("role") &&
            form.watch("role") === "managedStudent" ? (
              <>
                <FormField
                  control={form.control}
                  name="enrolled_class_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Class ID..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
            {form.watch("role") &&
            form.watch("role") === "teacher" ? (
              <>
                <FormField
                  control={form.control}
                  name="teaching_class_ids_str"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teacing classss</FormLabel>
                      <FormControl>
                        <Input placeholder="Class IDs..." {...field} />
                      </FormControl>
                      <FormDescription>Seperate class IDs by "," .</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
            {form.watch("role") && form.watch("role") !== "admin" ? (
              <>
                <FormField
                  control={form.control}
                  name="account_expiration_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account expiration</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Expiration date"
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
            {form.watch("role")?<Button type="submit" disabled={isLoading}>{isLoading?"Loading...":"Submit"}</Button>:null}
          </form>
        </Form>
      </>
    );
  };

export default CSVCreate;