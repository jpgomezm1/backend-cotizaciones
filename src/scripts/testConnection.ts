// src/scripts/testConnection.ts
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Cargar variables de entorno
dotenv.config();

async function testConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no configurada');
    }

    console.log('🔍 Probando conexión a la base de datos...');
    console.log('🔗 URL (parcial):', process.env.DATABASE_URL.split('@')[1]?.split('?')[0]);
    
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT NOW() as current_time, version() as db_version`;
    
    console.log('✅ Conexión exitosa!');
    console.log('⏰ Hora del servidor:', result[0].current_time);
    console.log('🗄️  Versión PostgreSQL:', result[0].db_version.split(' ')[0]);
    
  } catch (error) {
    console.error('❌ Error de conexión:', error);
  }
}

testConnection();