// src/db/connection.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en las variables de entorno');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });