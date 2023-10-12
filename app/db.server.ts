import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sqliteTable, index, integer, text } from "drizzle-orm/sqlite-core";
import Database from "better-sqlite3";

const sqlite = new Database("sqlite.db");
export const db: BetterSQLite3Database = drizzle(sqlite);

migrate(db, { migrationsFolder: "drizzle" });

export const userTable = sqliteTable(
  "user",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
  },
  (self) => ({
    emailIdx: index("email_idx").on(self.email),
  })
);

export const passwordTable = sqliteTable("password", {
  userId: integer("user_id")
    .primaryKey({ autoIncrement: false })
    .references(() => userTable.id, { onDelete: "cascade" }),
  hashedPassword: text("hashed_password").notNull(),
});

export const openAiApiKeyTable = sqliteTable("open_ai_api_key", {
  userId: integer("user_id")
    .primaryKey({ autoIncrement: false })
    .references(() => userTable.id, { onDelete: "cascade" }),
  apiKey: text("api_key").notNull(),
});

export const componentTable = sqliteTable("component", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
});

export const componentRevisionTable = sqliteTable("component_revision", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prompt: text("prompt").notNull(),
  code: text("code").notNull(),
  componentId: integer("component_id")
    .notNull()
    .references(() => componentTable.id, { onDelete: "cascade" }),
});
