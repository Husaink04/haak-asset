import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Copy .env.example to .env and set your PostgreSQL password.");
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "db"]);
const isLocal = localDatabaseHosts.has(databaseUrl.hostname);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal
    ? false
    : { rejectUnauthorized: false }
});

export async function query(text, params) {
  return pool.query(text, params);
}
