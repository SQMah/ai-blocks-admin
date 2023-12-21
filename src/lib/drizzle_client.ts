import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../drizzle/schema";

let db:ReturnType<typeof drizzle>;

const db_url = process.env.DATABASE_URL;
const DB_MAX_CON = 10 as const;

if (!db_url) throw Error("db url not set");

// for query purposes
const queryClient = postgres(db_url, {
  max: DB_MAX_CON,
  ssl: { rejectUnauthorized: false },
});

if (process.env.NODE_ENV === "production") {
  db = drizzle(queryClient, { schema });
} else {
  //@ts-ignore
  if (!global.db) {
    //@ts-ignore

    global.db = drizzle(queryClient, { schema });
  }
  //@ts-ignore

  db = global.db;
}

export default db;
