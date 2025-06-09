// src/scripts/testWorkflows.ts
import dotenv from 'dotenv';
import { db } from '../db/connection';
import { organizations, workflows } from '../db/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

async function testWorkflowsSetup() {
  try {
    console.log('🧪 Configurando datos de prueba para workflows...');

    // Buscar organización de prueba
    let org = await db.query.organizations.findFirst({
      where: eq(organizations.clerkOrgId, 'test_org_123')
    });

    if (!org) {
      [org] = await db.insert(organizations).values({
        name: 'Organización de Prueba',
        clerkOrgId: 'test_org_123'
      }).returning();
      console.log('✅ Organización creada:', org.id);
    }

    // Crear workflows de ejemplo
    const testWorkflows = [
      {
        nombre: 'Notificación Vista',
        descripcion: 'Notifica cuando el cliente ve la cotización',
        tipo: 'quote-viewed',
        config: {
          triggerType: 'quote-viewed',
          enableEmailNotification: true,
          emailRecipients: 'ventas@empresa.com',
          emailSubject: '👀 Cliente vio la cotización - [NOMBRE_PROYECTO]',
          enableInternalNotification: true
        }
      },
      {
        nombre: 'Recordatorio 3 días',
        descripcion: 'Recordatorio después de 3 días sin respuesta',
        tipo: 'no-response-3',
        config: {
          triggerType: 'no-response-3',
          days: 3,
          enableEmailNotification: true,
          enableWhatsApp: true,
          whatsappMessage: '¡Hola [NOMBRE_CLIENTE]! ¿Tuviste chance de revisar nuestra propuesta? 😊'
        }
      }
    ];

    for (const workflowData of testWorkflows) {
      const [workflow] = await db.insert(workflows).values({
        organizationId: org.id,
        ...workflowData
      }).returning();

      console.log(`✅ Workflow creado: ${workflow.nombre} (${workflow.id})`);
   }

   console.log('🎉 Setup de workflows completado exitosamente');
   
   // Listar workflows creados
   const allWorkflows = await db.query.workflows.findMany({
     where: eq(workflows.organizationId, org.id)
   });

   console.log('\n📋 Workflows disponibles:');
   allWorkflows.forEach((w, i) => {
     console.log(`  ${i + 1}. ${w.nombre} (${w.tipo}) - ${w.activo ? 'Activo' : 'Inactivo'}`);
   });

   return { orgId: org.id, workflows: allWorkflows };

 } catch (error) {
   console.error('❌ Error en setup de workflows:', error);
   throw error;
 }
}

testWorkflowsSetup()
 .then((result) => {
   console.log('\n🎯 Setup completado exitosamente');
   console.log(`📊 Organización: ${result.orgId}`);
   console.log(`📈 Workflows creados: ${result.workflows.length}`);
   process.exit(0);
 })
 .catch((error) => {
   console.error('💥 Error en test:', error);
   process.exit(1);
 });