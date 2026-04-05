import path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema';

const sqlite = new Database(path.join(__dirname, '..', 'repos', 'db.sqlite'));

ensureSchema(sqlite);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

const db = drizzle(sqlite, { schema });

export default db;

function ensureSchema(dbFile: Database.Database): void {
  dbFile.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      protocol TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      http_method TEXT,
      path TEXT,
      request_body TEXT,
      has_response INTEGER NOT NULL DEFAULT 0,
      response_body TEXT
    );
  `);

  const columns = dbFile
    .prepare('PRAGMA table_info(endpoints);')
    .all() as Array<{ name: string }>;

  const existing = new Set(columns.map((column) => column.name));
  const addColumnStatements: Record<string, string> = {
    description: 'ALTER TABLE endpoints ADD COLUMN description TEXT;',
    http_method: 'ALTER TABLE endpoints ADD COLUMN http_method TEXT;',
    path: 'ALTER TABLE endpoints ADD COLUMN path TEXT;',
    request_body: 'ALTER TABLE endpoints ADD COLUMN request_body TEXT;',
    has_response: 'ALTER TABLE endpoints ADD COLUMN has_response INTEGER NOT NULL DEFAULT 0;',
    response_body: 'ALTER TABLE endpoints ADD COLUMN response_body TEXT;',
  };

  for (const [column, statement] of Object.entries(addColumnStatements)) {
    if (!existing.has(column)) {
      dbFile.exec(statement);
    }
  }
}
