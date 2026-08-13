import knex, { type Knex } from "knex";

function resolveSqliteFilename(url?: string) {
  if (!url) return "./dev.db";
  if (url.startsWith("file:")) return url.slice(5);
  return url;
}

const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_FILE;
const filename = resolveSqliteFilename(databaseUrl);

const config: Knex.Config = {
  client: "better-sqlite3",
  connection: { filename },
  useNullAsDefault: true,
  pool: { min: 1, max: 5 },
};

const db = knex(config);

export default db;
