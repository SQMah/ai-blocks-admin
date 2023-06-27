import {FC,useState,Dispatch,SetStateAction} from "react"
import Papa from "papaparse"
import { z} from "zod"
import { ColumnDef } from "@tanstack/react-table"
import { DataTable} from "./ui/data-table"

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast"

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
import axios, { AxiosError } from "axios"; 

import { getOrdinal, clientErrorHandler } from "@/lib/utils"
import { UserRoleSchema} from "@/models/auth0_schemas"
import {  UserCreateCSVSchema, UserCreateCSVType,
  SetExpriationSchema, GetClassesResSchema,BatchGetClassesResSchema, BatchCreateUserReqType, BatchCreateUsersResSchema } from "@/models/api_schemas"

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
                    console.error(issues);
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
      <Label htmlFor="picture">Account data:</Label>
      <Input id="picture" type="file" accept=".csv" onChange={handleFileUpload} className="max-w-sm  cursor-pointer"/>
      <p className="text-sm text-muted-foreground">{`Please upload a CSV file that includes the following headers: 'First name', 
      'Last name', and 'Email'. All three headers are required and must be present in the CSV file. 
      Please ensure that your CSV file is formatted correctly before uploading.`}</p>
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
    const { toast } = useToast()

    const form = useForm<formType>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        role:undefined,
        enrolled_class_id:"",
        teaching_class_ids_str:"",
        account_expiration_date:"",
      },
    });
  
    const onSubmit = async (values: formType) => {
      setIsLoading(true)
      try {
        const {role,enrolled_class_id,teaching_class_ids_str,available_modules,account_expiration_date} = values
        const teaching = teaching_class_ids_str?.split(",").map(id=>id.trim()).filter(id=>id.length)??[]
        //can remove the logic of validating class id if needed
        if(role==="teacher"&&teaching.length){
          try {
            const {data} = await axios.get('/api/v1/classes?'+teaching.map(id=>`class_id=${id}`).join('&'))
            const present = BatchGetClassesResSchema.parse(data).map(entry=>entry.class_id)
            const missing = teaching.filter(id=>!present.includes(id))
            if(missing.length){
              const message = `${missing.join(", ")} are not valid class IDs.`
              form.setError("teaching_class_ids_str",{message})
              setIsLoading(false)
              return
            }
          } catch (error:any) {
            const handler = new  clientErrorHandler(error)
            handler.log()
            toast({
              variant:"destructive",
              title:"Search Class Error",
              description:handler.message
            })
            setIsLoading(false)
            return
          }
        }
        const enrolled  = enrolled_class_id?.trim()
        //can remove the logic of validating class id if needed
        if(enrolled&&role==="managedStudent"){
          try {
            const {data:obj} = await axios.get('/api/v1/classes/'+enrolled)
            const target = GetClassesResSchema.parse(obj)
            const remain = Math.max(target.capacity - target.student_ids.length,0)
            if(remain < users.length){
              form.setError('enrolled_class_id',{message:`Class is full, only ${remain} seat(s) remain.`})
              setIsLoading(false)
              return
            }
          } catch (error:any) {
            if(error instanceof AxiosError&&error.response?.status===404){
              form.setError("enrolled_class_id",{message:`${enrolled} is not a valid class ID`})
            }else{
              const handler = new  clientErrorHandler(error)
              handler.log()
              toast({
                variant:"destructive",
                title:"Search Class Error",
                description:handler.message
              })
            }
            setIsLoading(false)
            return
          }
        }
        const payload: BatchCreateUserReqType = { 
          users,role,
          ...(role === "managedStudent" && { enrolled_class_id }),
          ...(role==="unmanagedStudent"&&{available_modules}),
          ...(role==="teacher"&&{teaching_class_ids:teaching}),
          ...(role !== "admin" && { account_expiration_date }),
        };      
        // console.log(payload)
        const response = await axios.post("/api/v1/batch-create-users", payload);
        const data = BatchCreateUsersResSchema.parse(response.data)
        // console.log(sata);
        form.reset()
        toast({
          title: "Creation status",
          description: data.message,
        })
      } catch (error: any) {
        const handler = new clientErrorHandler(error)
        handler.log()
        // console.log(error.response?.data)
        toast({
          variant:"destructive",
          title: "Creation error",
          description:handler.message
        })
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
                      <FormLabel>Teaching classes</FormLabel>
                      <FormControl>
                        <Input placeholder="Class IDs..." {...field} />
                      </FormControl>
                      <FormDescription>{`Seperate class IDs by "," `}.</FormDescription>
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