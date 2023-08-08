import { FC } from "react";
import { validDateString,expirated } from "@/lib/utils";

type props ={
    expiration?:string|null
    content?:string
}


const ShowExpiration:FC<props> = ({expiration,content="Expiration date:"})=>{
    return  <span className=" space-x-3"><span>{content}</span> 
    {expiration?<span>{expiration}</span>:<span className=" text-destructive">None</span>}
    {expiration&&validDateString(expiration)&&expirated(expiration)?<span className="text-destructive">{" (Expirated)"}</span>:null}
    </span>
}

export default ShowExpiration