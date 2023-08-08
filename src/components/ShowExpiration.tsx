import { FC } from "react";
import {expirated, formatDate } from "@/lib/utils";

type props ={
    expiration?:Date|null
    content?:string
}


const ShowExpiration:FC<props> = ({expiration,content="Expiration date:"})=>{
    return  <span className=" space-x-3"><span>{content}</span> 
    {expiration?<span>{formatDate(expiration)}</span>:<span className=" text-destructive">None</span>}
    {expiration&&expirated(expiration)?<span className="text-destructive">{" (Expirated)"}</span>:null}
    </span>
}

export default ShowExpiration