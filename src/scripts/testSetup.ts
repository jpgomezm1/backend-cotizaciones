// src/scripts/testSetup.ts
import dotenv from 'dotenv';
import { db } from '../db/connection';
import { organizations, templates } from '../db/schema';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';

dotenv.config();

async function setupTestData() {
  try {
    console.log('🔧 Configurando datos de prueba...');

    // Leer el template HTML completo
    const templatePath = path.join(__dirname, '../../paste2.txt');
    let htmlContent: string;
    
    try {
      htmlContent = fs.readFileSync(templatePath, 'utf8');
      console.log('📄 Template HTML leído exitosamente, tamaño:', htmlContent.length, 'caracteres');
    } catch (error) {
      console.error('❌ No se pudo leer paste2.txt desde:', templatePath);
      console.error('   Asegúrate de que el archivo paste2.txt existe en la raíz del proyecto');
      throw error;
    }

    // Buscar organización existente o crear una nueva
    let org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, 'test_org_123')
    });

    if (org) {
      console.log('✅ Organización existente encontrada:', org.id);
    } else {
      [org] = await db.insert(organizations).values({
        name: 'Organización de Prueba',
        clerkOrgId: 'test_org_123'
      }).returning();
      console.log('✅ Nueva organización creada:', org.id);
    }

    // Crear nuevo template con timestamp para evitar duplicados
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const [template] = await db.insert(templates).values({
      organizationId: org.id,
      name: `Template Irrelevant - MCP Server (${timestamp})`,
      htmlContent: htmlContent
    }).returning();

    console.log('✅ Template creado:', template.id);
    console.log('📝 Template ID para usar en pruebas:', template.id);
    console.log('📏 Tamaño del template guardado:', template.htmlContent.length, 'caracteres');

    // Verificar que el template se guardó correctamente
    if (template.htmlContent.length < 10000) {
      console.warn('⚠️  El template parece ser muy pequeño. Verifica que paste2.txt tenga el contenido completo.');
    }

    return { orgId: org.id, templateId: template.id };
  } catch (error) {
    console.error('❌ Error en setup:', error);
    throw error;
  }
}

setupTestData()
  .then((result) => {
    console.log('🎉 Setup completado exitosamente');
    console.log('📋 Usar este Template ID en las pruebas:', result.templateId);
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en setup:', error);
    process.exit(1);
  });