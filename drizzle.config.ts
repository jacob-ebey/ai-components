import type { Config } from "drizzle-kit";

export default {
  schema: "./app/db.server.ts",
  out: "./drizzle",
} satisfies Config;
