import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const endpoints = sqliteTable("endpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  protocol: text("protocol").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  httpMethod: text("http_method"),
  path: text("path"),
  requestBody: text("request_body"),
  hasResponse: integer("has_response", { mode: "boolean" }).notNull(),
  responseBody: text("response_body"),
});
