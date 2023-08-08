import {z} from "zod"




const IdentitySchema = z.object({
  connection: z.string(),
  user_id: z.string(),
  provider: z.string(),
  isSocial: z.boolean(),
});



export const auth0UserSchema = z.object({
  created_at: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  family_name: z.string().optional(),
  given_name: z.string().optional(),
  identities: z.array(IdentitySchema),
  name: z.string(),
  nickname: z.string().optional(),
  picture: z.string(),
  updated_at: z.string().optional(),
  user_id: z.string(),
}).passthrough();

export type Auth0User = z.infer<typeof auth0UserSchema>

