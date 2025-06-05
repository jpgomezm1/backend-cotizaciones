// src/db/migrate.ts
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

// Cargar variables de entorno PRIMERO
dotenv.config();

async function runMigrate() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está configurada en el archivo .env');
    process.exit(1);
  }

  console.log('⏳ Ejecutando migraciones...');
  console.log('🔗 Conectando a la base de datos...');
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('✅ Migraciones completadas exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    console.error('Detalles:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigrate();