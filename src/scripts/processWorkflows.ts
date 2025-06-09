// src/scripts/processWorkflows.ts
import dotenv from 'dotenv';
import { WorkflowService } from '../services/workflowService';

dotenv.config();

async function processWorkflows() {
  try {
    console.log('🚀 Iniciando procesamiento de workflows...');
    
    const workflowService = new WorkflowService();
    
    // 1. Buscar cotizaciones que necesitan seguimiento
    const needsFollowup = await workflowService.findQuotationsNeedingFollowup();
    
    // 2. Disparar workflows para las que necesitan seguimiento de 3 días
    for (const quotation of needsFollowup.threeDayFollowup) {
      await workflowService.triggerWorkflowsForQuotation(
        quotation.id, 
        'no-response-3'
      );
    }
    
    // 3. Disparar workflows para las que necesitan seguimiento de 7 días
    for (const quotation of needsFollowup.sevenDayFollowup) {
      await workflowService.triggerWorkflowsForQuotation(
        quotation.id, 
        'no-response-7'
      );
    }
    
    // 4. Procesar workflows pendientes
    await workflowService.processPendingWorkflows();
    
    console.log('✅ Procesamiento completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error en procesamiento:', error);
    throw error;
  }
}

processWorkflows()
  .then(() => {
    console.log('🎉 Procesamiento de workflows finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });