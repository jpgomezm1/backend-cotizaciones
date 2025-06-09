// src/services/workflowService.ts
import { db } from '../db/connection';
import { workflows, workflowExecutions, workflowActions, quotations } from '../db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';

export class WorkflowService {
  
  // Método para disparar workflows basado en eventos
  async triggerWorkflowsForQuotation(quotationId: string, triggerType: string, triggerData?: any) {
    console.log(`🔄 Buscando workflows para disparar: ${triggerType} en cotización ${quotationId}`);
    
    try {
      // Obtener la cotización
      const quotation = await db.query.quotations.findFirst({
        where: eq(quotations.id, quotationId)
      });

      if (!quotation || !quotation.workflowsEnabled) {
        console.log('⚠️ Cotización no encontrada o workflows deshabilitados');
        return;
      }

      // Buscar workflows activos del tipo correspondiente
      const activeWorkflows = await db.query.workflows.findMany({
        where: and(
          eq(workflows.organizationId, quotation.organizationId),
          eq(workflows.tipo, triggerType),
          eq(workflows.activo, true)
        )
      });

      console.log(`📋 Encontrados ${activeWorkflows.length} workflows activos para ${triggerType}`);

      // Crear ejecuciones para cada workflow
      for (const workflow of activeWorkflows) {
        await this.createWorkflowExecution(workflow.id, quotationId, triggerType, triggerData);
      }

      // Actualizar timestamp de última actividad
      await db.update(quotations)
        .set({ lastActivityAt: new Date() })
        .where(eq(quotations.id, quotationId));

    } catch (error) {
      console.error('❌ Error disparando workflows:', error);
    }
  }

  // Crear una ejecución de workflow
  private async createWorkflowExecution(workflowId: string, quotationId: string, triggerType: string, triggerData?: any) {
    try {
      const [execution] = await db.insert(workflowExecutions).values({
        workflowId,
        quotationId,
        triggerType,
        triggerData: triggerData || {},
        status: 'pending'
      }).returning();

      console.log(`✅ Ejecución de workflow creada: ${execution.id}`);

      // TODO: Aquí más adelante agregaremos la lógica para ejecutar las acciones
      // Por ahora solo creamos el registro

      return execution;
    } catch (error) {
      console.error('❌ Error creando ejecución de workflow:', error);
      throw error;
    }
  }

  // Método para buscar cotizaciones que necesitan seguimiento
  async findQuotationsNeedingFollowup() {
    console.log('🔍 Buscando cotizaciones que necesitan seguimiento...');
    
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

      // Buscar cotizaciones sin respuesta hace 3+ días
      const quotationsFor3DayFollowup = await db.query.quotations.findMany({
        where: and(
          eq(quotations.status, 'sent'),
          lt(quotations.lastActivityAt, threeDaysAgo),
          eq(quotations.workflowsEnabled, true),
          sql`${quotations.respondedAt} IS NULL`
        ),
        with: {
          workflowExecutions: {
            where: eq(workflowExecutions.triggerType, 'no-response-3')
          }
        }
      });

      // Filtrar las que no han tenido workflow de 3 días ya ejecutado
      const needsThreeDayFollowup = quotationsFor3DayFollowup.filter(q => 
        q.workflowExecutions.length === 0
      );

      // Buscar cotizaciones sin respuesta hace 7+ días
      const quotationsFor7DayFollowup = await db.query.quotations.findMany({
        where: and(
          eq(quotations.status, 'sent'),
          lt(quotations.lastActivityAt, sevenDaysAgo),
          eq(quotations.workflowsEnabled, true),
          sql`${quotations.respondedAt} IS NULL`
        ),
        with: {
          workflowExecutions: {
            where: eq(workflowExecutions.triggerType, 'no-response-7')
          }
        }
      });

      const needsSevenDayFollowup = quotationsFor7DayFollowup.filter(q => 
        q.workflowExecutions.length === 0
      );

      console.log(`📊 Encontradas:`);
      console.log(`  - ${needsThreeDayFollowup.length} cotizaciones para seguimiento de 3 días`);
      console.log(`  - ${needsSevenDayFollowup.length} cotizaciones para seguimiento de 7 días`);

      return {
        threeDayFollowup: needsThreeDayFollowup,
        sevenDayFollowup: needsSevenDayFollowup
      };

    } catch (error) {
      console.error('❌ Error buscando cotizaciones para seguimiento:', error);
      return { threeDayFollowup: [], sevenDayFollowup: [] };
    }
  }

  // Método para procesar workflows pendientes (para futuro job/cron)
  async processPendingWorkflows() {
    console.log('⚙️ Procesando workflows pendientes...');
    
    try {
      // Buscar ejecuciones pendientes
      const pendingExecutions = await db.query.workflowExecutions.findMany({
        where: eq(workflowExecutions.status, 'pending'),
        with: {
          workflow: true,
          quotation: true
        },
        limit: 50 // Procesar en lotes
      });

      console.log(`📋 Encontradas ${pendingExecutions.length} ejecuciones pendientes`);

      for (const execution of pendingExecutions) {
        try {
          await this.executeWorkflowActions(execution);
        } catch (error) {
          console.error(`❌ Error ejecutando workflow ${execution.id}:`, error);
          
          // Marcar como fallido
          await db.update(workflowExecutions)
            .set({ 
              status: 'failed',
              errorMessage: String(error)
            })
            .where(eq(workflowExecutions.id, execution.id));
        }
      }

      console.log('✅ Procesamiento de workflows completado');

    } catch (error) {
      console.error('❌ Error procesando workflows pendientes:', error);
    }
  }

  // Ejecutar acciones de un workflow (placeholder para futuro)
  private async executeWorkflowActions(execution: any) {
    console.log(`⚙️ Ejecutando acciones para workflow: ${execution.workflow.nombre}`);
    
    const config = execution.workflow.config;
    const quotation = execution.quotation;

    // TODO: Implementar lógica real de ejecución
    // Por ahora solo simulamos que se ejecutó correctamente
    
    // Crear registros de acciones
    const actions = [];
    
    if (config.enableEmailNotification) {
      actions.push({
        actionType: 'email',
        actionData: {
          recipients: config.emailRecipients,
          subject: this.replaceVariables(config.emailSubject, quotation),
          message: this.replaceVariables(config.emailMessage, quotation)
        }
      });
    }

    if (config.enableWhatsApp) {
      actions.push({
        actionType: 'whatsapp',
        actionData: {
          message: this.replaceVariables(config.whatsappMessage, quotation),
          phone: quotation.clientPhone
        }
      });
    }

    if (config.enableInternalNotification) {
      actions.push({
        actionType: 'notification',
        actionData: {
          message: this.replaceVariables(config.notificationMessage, quotation)
        }
      });
    }

    // Insertar acciones
    for (const actionData of actions) {
      await db.insert(workflowActions).values({
        executionId: execution.id,
        actionType: actionData.actionType,
        actionData: actionData.actionData,
        status: 'executed', // Por ahora simulamos que se ejecutó
        executedAt: new Date()
      });
    }

    // Marcar ejecución como completada
    await db.update(workflowExecutions)
      .set({ 
        status: 'executed',
        executedAt: new Date()
      })
      .where(eq(workflowExecutions.id, execution.id));

    console.log(`✅ Workflow ejecutado: ${actions.length} acciones completadas`);
  }

  // Reemplazar variables en mensajes
  private replaceVariables(template: string, quotation: any): string {
    return template
      .replace(/\[NOMBRE_CLIENTE\]/g, quotation.clientName || '')
      .replace(/\[EMPRESA_CLIENTE\]/g, quotation.clientCompany || '')
      .replace(/\[NOMBRE_PROYECTO\]/g, quotation.projectName || '')
      .replace(/\[EMAIL_CLIENTE\]/g, quotation.clientEmail || '')
      .replace(/\[TELEFONO_CLIENTE\]/g, quotation.clientPhone || '')
      .replace(/\[FECHA\]/g, new Date().toLocaleDateString('es-ES'));
  }
}