import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable('scarto_rooms', {
  code: text('code').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
  updated: integer('updated').notNull(),
});
