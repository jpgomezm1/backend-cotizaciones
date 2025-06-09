// src/scripts/loadNewTemplate.ts
import dotenv from 'dotenv';
import { db } from '../db/connection';
import { organizations, templates } from '../db/schema';
import * as fs from 'fs';
import * as path from 'path';
import { eq } from 'drizzle-orm';

dotenv.config();

async function loadNewTemplate() {
  try {
    console.log('📄 Cargando nuevo template...');

    // Buscar el archivo del nuevo template
    const templatePath = path.join(__dirname, '../../marketing-template.html');
    
    if (!fs.existsSync(templatePath)) {
      console.error('❌ No se encontró el archivo del template en:', templatePath);
      console.log('💡 Asegúrate de guardar el nuevo template como "marketing-template.html" en la raíz del proyecto');
      return;
    }

    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    console.log('✅ Template HTML leído:', htmlContent.length, 'caracteres');

    // Buscar o crear organización
    let org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, 'test_org_123')
    });

    if (!org) {
      [org] = await db.insert(organizations).values({
        name: 'Organización de Prueba',
        clerkOrgId: 'test_org_123'
      }).returning();
      console.log('✅ Nueva organización creada:', org.id);
    } else {
      console.log('✅ Organización existente encontrada:', org.id);
    }

    // Analizar el template para extraer información
    const placeholders = (htmlContent.match(/\{\{[^}]+\}\}/g) || []).length;
    
    // Determinar categoría basada en el contenido
    let categoria = 'general';
    const content = htmlContent.toLowerCase();
    if (content.includes('wedding') || content.includes('matrimonio')) categoria = 'eventos';
    if (content.includes('web') || content.includes('app') || content.includes('desarrollo')) categoria = 'desarrollo';
    if (content.includes('marketing')) categoria = 'marketing';
    if (content.includes('consultor')) categoria = 'consultoria';
    if (content.includes('diseño') || content.includes('diseno')) categoria = 'diseno';

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    
    const [template] = await db.insert(templates).values({
      organizationId: org.id,
      name: `Nuevo Template - ${categoria} (${timestamp})`,
      htmlContent: htmlContent
    }).returning();

    console.log('✅ Template cargado exitosamente:');
    console.log('  - ID:', template.id);
    console.log('  - Nombre:', template.name);
    console.log('  - Placeholders encontrados:', placeholders);
    console.log('  - Categoría detectada:', categoria);
    console.log('  - Tamaño:', htmlContent.length, 'caracteres');
    
    return template;
  } catch (error) {
    console.error('❌ Error cargando template:', error);
    throw error;
  }
}

loadNewTemplate()
  .then((template) => {
    console.log('🎉 Template cargado correctamente');
    console.log('📋 ID del template para usar en pruebas:', template?.id);
    console.log('🔥 Listo para usar desde el frontend!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });