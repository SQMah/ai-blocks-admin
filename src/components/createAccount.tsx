import { FC,useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


import ManualCreate from "./ManualCreate";
import CSVCreate from "./CSVCreate";

const CreateAccount: FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
    return (
      <>
        <Tabs defaultValue="manual" className=" m-8">
          <div className="flex justify-center">
          <TabsList className= "">
            <TabsTrigger value="manual">Manual</TabsTrigger>
            <TabsTrigger value="csv">Use CSV</TabsTrigger>
          </TabsList>
          </div>
          <TabsContent value="manual"><ManualCreate {...{setIsLoading,isLoading}}/></TabsContent>
          <TabsContent value="csv"><CSVCreate {...{setIsLoading,isLoading}}/></TabsContent>
        </Tabs>
      </>
    );
  };
  
export default CreateAccount