import type { Config } from "drizzle-kit";
import 'dotenv/config'


const dbStr  = process.env.DATABASE_URL

if(!dbStr) throw new Error("no db string")

console.log(dbStr)
 
export default {
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  driver: 'pg',
  dbCredentials: {
    connectionString:dbStr,
  }
} satisfies Config;