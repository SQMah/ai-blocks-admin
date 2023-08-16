import { Loader2 } from "lucide-react";
import { FC } from "react";

const Loading: FC<{}> = () => {
    return (
      <>
        <div >
        <Loader2 className=" animate-spin"/>
        </div>
      </>
    );
  };

export default Loading