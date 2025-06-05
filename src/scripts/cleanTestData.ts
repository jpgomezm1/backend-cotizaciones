// src/scripts/cleanTestData.ts
import dotenv from 'dotenv';
import { db } from '../db/connection';
import { organizations, templates, quotations } from '../db/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

async function cleanTestData() {
  try {
    console.log('🧹 Limpiando datos de prueba...');

    // Buscar organización de prueba
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, 'test_org_123')
    });

    if (!org) {
      console.log('ℹ️  No hay datos de prueba para limpiar');
      return;
    }

    // Eliminar cotizaciones
    const deletedQuotations = await db.delete(quotations)
      .where(eq(quotations.organizationId, org.id))
      .returning();

    // Eliminar templates
    const deletedTemplates = await db.delete(templates)
      .where(eq(templates.organizationId, org.id))
      .returning();

    // Eliminar organización
    const deletedOrgs = await db.delete(organizations)
      .where(eq(organizations.id, org.id))
      .returning();

    console.log('✅ Datos limpiados:');
    console.log(`  - ${deletedQuotations.length} cotizaciones eliminadas`);
    console.log(`  - ${deletedTemplates.length} templates eliminados`);
    console.log(`  - ${deletedOrgs.length} organizaciones eliminadas`);

  } catch (error) {
    console.error('❌ Error limpiando datos:', error);
    throw error;
  }
}

cleanTestData()
  .then(() => {
    console.log('🎉 Limpieza completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en limpieza:', error);
    process.exit(1);
  });