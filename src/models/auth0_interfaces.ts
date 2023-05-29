export type UserResponseData =  {
    created_at: string;
    email: string;
    email_verified: boolean;
    family_name: string;
    given_name: string;
    identities: Identity[];
    name: string;
    nickname: string;
    picture: string;
    updated_at: string;
    user_id: string;
    user_metadata: UserMetadata;
    app_metadata?: Appmetadata;
}

export type UserWithRole = UserResponseData&{roles:string[]}

export interface UserCreationRequestBody {
    connection:string
    email: string;
    password: string;
    verify_email:boolean;
    given_name:string|undefined;
    family_name:string|undefined;
    name:string
    user_metadata:UserMetadata;
    app_metadata: Appmetadata;
}
  
export interface Identity {
    connection: string;
    user_id: string;
    provider: string;
    isSocial: boolean;
}
  
export interface UserMetadata {
    account_expiration_date?: string,
    class_ids?: string[]|string;
}

export interface Appmetadata{
}

export interface AssignRoleRaequestBody{
    "roles": string[]
}

export interface roleResponseEntry{
    id: string;
    name: string;
    description: string;
}


export type UserRole ="admin"|"managedStudent"|"teacher"|"unmanagedStudent"

export const PossilbeRoles = ["admin","managedStudent","teacher","unmanagedStudent"] as const

export const role_to_roleId ={
    "admin":"rol_YHRhJdPKTdNaTEPp",
    "managedStudent":"rol_FLZfpiWTljn9jiOd",
    "teacher":"rol_tEgERFGnK2D82MFC",
    "unmanagedStudent":"rol_IBB3Y72SjYuP3tNP"
}

export const role_to_roleName= {
    "unmanagedStudent":"unmanaged student",
    "managedStudent":"student",
    "admin":"admin",
    "teacher":"teacher"
}

