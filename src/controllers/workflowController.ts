// src/controllers/workflowController.ts
import { Request, Response } from 'express';
import { db } from '../db/connection';
import { workflows, workflowExecutions, workflowActions, organizations } from '../db/schema';
import { eq, and, desc, count, sql } from 'drizzle-orm';

export class WorkflowController {
  
  // Listar todos los workflows
  async listWorkflows(req: Request, res: Response) {
    try {
      console.log('📋 Obteniendo lista de workflows...');
      
      const allWorkflows = await db.query.workflows.findMany({
        orderBy: (workflows, { desc }) => [desc(workflows.createdAt)],
        with: {
          executions: {
            limit: 1,
            orderBy: (executions, { desc }) => [desc(executions.createdAt)]
          }
        }
      });

      // Obtener estadísticas para cada workflow
      const workflowsWithStats = await Promise.all(
        allWorkflows.map(async (workflow) => {
          // Contar ejecuciones totales
          const [executionStats] = await db
            .select({ 
              totalExecutions: count(),
              successfulExecutions: sql<number>`COUNT(CASE WHEN status = 'executed' THEN 1 END)`
            })
            .from(workflowExecutions)
            .where(eq(workflowExecutions.workflowId, workflow.id));

          // Mock de cotizaciones usando este workflow (por ahora)
          const cotizacionesUsando = Math.floor(Math.random() * 20) + 1;

          return {
            id: workflow.id,
            nombre: workflow.nombre,
            descripcion: workflow.descripcion,
            tipo: workflow.tipo,
            activo: workflow.activo,
            config: workflow.config,
            fechaCreacion: workflow.createdAt.toISOString(),
            ultimaModificacion: workflow.updatedAt.toISOString(),
            estadisticas: {
              ejecutado: executionStats?.totalExecutions || 0,
              exitoso: executionStats?.successfulExecutions || 0,
              fallido: (executionStats?.totalExecutions || 0) - (executionStats?.successfulExecutions || 0)
            },
            cotizacionesUsando,
            ultimaEjecucion: workflow.executions?.[0]?.createdAt?.toISOString() || null
          };
        })
      );

      console.log(`✅ Se encontraron ${workflowsWithStats.length} workflows`);

      res.json({
        success: true,
        workflows: workflowsWithStats,
        count: workflowsWithStats.length
      });
    } catch (error) {
      console.error('❌ Error listing workflows:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Obtener un workflow específico
  async getWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🔍 Buscando workflow con ID: ${id}`);
      
      const workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, id),
        with: {
          executions: {
            orderBy: (executions, { desc }) => [desc(executions.createdAt)],
            limit: 10,
            with: {
              actions: true,
              quotation: {
                columns: {
                  id: true,
                  clientName: true,
                  projectName: true
                }
              }
            }
          }
        }
      });

      if (!workflow) {
        console.log(`❌ Workflow no encontrado: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Workflow no encontrado'
        });
      }

      console.log(`✅ Workflow encontrado: ${workflow.nombre}`);

      // Calcular estadísticas
      const [stats] = await db
        .select({ 
          totalExecutions: count(),
          successfulExecutions: sql<number>`COUNT(CASE WHEN status = 'executed' THEN 1 END)`
        })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, workflow.id));

      const formattedWorkflow = {
        id: workflow.id,
        nombre: workflow.nombre,
        descripcion: workflow.descripcion,
        tipo: workflow.tipo,
        activo: workflow.activo,
        config: workflow.config,
        fechaCreacion: workflow.createdAt.toISOString(),
        ultimaModificacion: workflow.updatedAt.toISOString(),
        estadisticas: {
          ejecutado: stats?.totalExecutions || 0,
          exitoso: stats?.successfulExecutions || 0,
          fallido: (stats?.totalExecutions || 0) - (stats?.successfulExecutions || 0)
        },
        ejecuciones: workflow.executions.map(execution => ({
          id: execution.id,
          triggerType: execution.triggerType,
          status: execution.status,
          executedAt: execution.executedAt?.toISOString(),
          cotizacion: execution.quotation ? {
            id: execution.quotation.id,
            cliente: execution.quotation.clientName,
            proyecto: execution.quotation.projectName
          } : null,
          acciones: execution.actions.map(action => ({
            id: action.id,
            tipo: action.actionType,
            status: action.status,
            executedAt: action.executedAt?.toISOString()
          }))
        }))
      };

      res.json({
        success: true,
        workflow: formattedWorkflow
      });
    } catch (error) {
      console.error('❌ Error getting workflow:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Crear nuevo workflow
  async createWorkflow(req: Request, res: Response) {
    try {
      console.log('📝 Creando nuevo workflow...');
      console.log('📝 Datos recibidos:', req.body);

      const {
        nombre,
        descripcion,
        tipo,
        template,
        config = {}
      } = req.body;

      // Validar datos requeridos
      if (!nombre || !tipo) {
        console.log('❌ Datos faltantes:', { nombre: !!nombre, tipo: !!tipo });
        return res.status(400).json({
          success: false,
          error: 'Faltan campos requeridos: nombre, tipo'
        });
      }

      // Buscar o crear organización de prueba con UUID válido
      let org = await db.query.organizations.findFirst({
        where: eq(organizations.clerkOrgId, 'test_org_123')
      });

      if (!org) {
        console.log('📝 Creando organización de prueba...');
        [org] = await db.insert(organizations).values({
          name: 'Organización de Prueba',
          clerkOrgId: 'test_org_123'
        }).returning();
        console.log('✅ Organización creada:', org.id);
      } else {
        console.log('✅ Organización encontrada:', org.id);
      }

      // Configuración por defecto basada en el tipo
      const defaultConfig = this.getDefaultConfigForType(tipo, template);
      const finalConfig = { ...defaultConfig, ...config };

      console.log('🔧 Configuración final:', finalConfig);

      // Crear el workflow usando el ID real de la organización
      const [newWorkflow] = await db.insert(workflows).values({
        organizationId: org.id,
        nombre: nombre.trim(),
        descripcion: descripcion || `Workflow automático de tipo ${tipo}`,
        tipo,
        activo: true,
        config: finalConfig
      }).returning();

      console.log(`✅ Workflow creado con ID: ${newWorkflow.id}`);

      // Formatear respuesta
      const formattedWorkflow = {
        id: newWorkflow.id,
        nombre: newWorkflow.nombre,
        descripcion: newWorkflow.descripcion,
        tipo: newWorkflow.tipo,
        activo: newWorkflow.activo,
        config: newWorkflow.config,
        fechaCreacion: newWorkflow.createdAt.toISOString(),
        ultimaModificacion: newWorkflow.updatedAt.toISOString(),
        estadisticas: {
          ejecutado: 0,
          exitoso: 0,
          fallido: 0
        },
        cotizacionesUsando: 0
      };

      res.json({
        success: true,
        workflow: formattedWorkflow,
        message: 'Workflow creado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error creating workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Actualizar workflow
  async updateWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`📝 Actualizando workflow: ${id}`);

      const updateData = req.body;
      console.log('📝 Datos de actualización:', updateData);

      // Verificar que el workflow existe
      const existingWorkflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, id)
      });

      if (!existingWorkflow) {
        console.log(`❌ Workflow no encontrado: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Workflow no encontrado'
        });
      }

      // Preparar datos para actualizar
      const updateValues: any = {
        updatedAt: new Date()
      };

      if (updateData.nombre !== undefined) updateValues.nombre = updateData.nombre.trim();
      if (updateData.descripcion !== undefined) updateValues.descripcion = updateData.descripcion;
      if (updateData.activo !== undefined) updateValues.activo = updateData.activo;
      if (updateData.config !== undefined) {
        // Verificar que existingWorkflow.config es un objeto antes del spread
        const existingConfig = existingWorkflow.config && typeof existingWorkflow.config === 'object' 
          ? existingWorkflow.config as Record<string, any>
          : {};
        const newConfig = updateData.config && typeof updateData.config === 'object' 
          ? updateData.config as Record<string, any>
          : {};
        
        updateValues.config = { ...existingConfig, ...newConfig };
      }

      // Actualizar el workflow
      const [updatedWorkflow] = await db.update(workflows)
        .set(updateValues)
        .where(eq(workflows.id, id))
        .returning();

      console.log(`✅ Workflow actualizado: ${updatedWorkflow.nombre}`);

      // Obtener estadísticas actuales
      const [stats] = await db
        .select({ 
          totalExecutions: count(),
          successfulExecutions: sql<number>`COUNT(CASE WHEN status = 'executed' THEN 1 END)`
        })
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, updatedWorkflow.id));

      const formattedWorkflow = {
        id: updatedWorkflow.id,
        nombre: updatedWorkflow.nombre,
        descripcion: updatedWorkflow.descripcion,
        tipo: updatedWorkflow.tipo,
        activo: updatedWorkflow.activo,
        config: updatedWorkflow.config,
        fechaCreacion: updatedWorkflow.createdAt.toISOString(),
        ultimaModificacion: updatedWorkflow.updatedAt.toISOString(),
        estadisticas: {
          ejecutado: stats?.totalExecutions || 0,
          exitoso: stats?.successfulExecutions || 0,
          fallido: (stats?.totalExecutions || 0) - (stats?.successfulExecutions || 0)
        }
      };

      res.json({
        success: true,
        workflow: formattedWorkflow,
        message: 'Workflow actualizado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error updating workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Eliminar workflow
  async deleteWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🗑️ Eliminando workflow: ${id}`);

      // Verificar que el workflow existe
      const existingWorkflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, id)
      });

      if (!existingWorkflow) {
        console.log(`❌ Workflow no encontrado: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Workflow no encontrado'
        });
      }

      // Verificar si hay ejecuciones asociadas
      const executions = await db.query.workflowExecutions.findMany({
        where: eq(workflowExecutions.workflowId, id),
        limit: 1
      });

      if (executions.length > 0) {
        console.log(`⚠️ Workflow tiene ejecuciones asociadas: ${id}`);
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar el workflow porque tiene ejecuciones asociadas'
        });
      }

      // Eliminar el workflow
      const [deletedWorkflow] = await db.delete(workflows)
        .where(eq(workflows.id, id))
        .returning();

      console.log(`✅ Workflow eliminado: ${deletedWorkflow.nombre}`);

      res.json({
        success: true,
        message: 'Workflow eliminado exitosamente',
        deletedWorkflow: {
          id: deletedWorkflow.id,
          nombre: deletedWorkflow.nombre
        }
      });

    } catch (error) {
      console.error('❌ Error deleting workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Helper method para configuración por defecto
  private getDefaultConfigForType(tipo: string, template?: any): Record<string, any> {
    const baseConfig = {
      // Configuración de trigger
      triggerType: tipo,
      days: tipo.includes('no-response') ? (tipo.includes('3') ? 3 : 7) : undefined,
      
      // Configuración de acciones
      enableEmailNotification: true,
      emailRecipients: '',
      emailSubject: this.getDefaultEmailSubject(tipo),
      emailMessage: this.getDefaultEmailMessage(tipo),
      
      enableWhatsApp: false,
      whatsappMessage: this.getDefaultWhatsAppMessage(tipo),
      
      enableInternalNotification: true,
      notificationMessage: this.getDefaultNotificationMessage(tipo)
    };

    return baseConfig;
  }

  private getDefaultEmailSubject(tipo: string): string {
    switch (tipo) {
      case 'quote-viewed':
        return '👀 Cliente vio la cotización - [NOMBRE_PROYECTO]';
      case 'no-response-3':
        return '⏰ Recordatorio: Sin respuesta hace 3 días - [NOMBRE_PROYECTO]';
      case 'no-response-7':
        return '🚨 Seguimiento urgente: Sin respuesta hace 7 días - [NOMBRE_PROYECTO]';
      case 'quote-approved':
        return '🎉 ¡Cotización aprobada! - [NOMBRE_PROYECTO]';
      case 'quote-rejected':
        return '❌ Cotización rechazada - [NOMBRE_PROYECTO]';
      default:
        return '🔔 Notificación de seguimiento - [NOMBRE_PROYECTO]';
    }
  }

  private getDefaultEmailMessage(tipo: string): string {
    switch (tipo) {
      case 'quote-viewed':
        return 'Hola equipo,\n\nEl cliente [NOMBRE_CLIENTE] de [EMPRESA_CLIENTE] acaba de ver la cotización para el proyecto [NOMBRE_PROYECTO].\n\nEs un buen momento para hacer seguimiento.\n\nSaludos.';
      case 'no-response-3':
        return 'Hola,\n\nHan pasado 3 días desde que enviamos la cotización a [NOMBRE_CLIENTE] para el proyecto [NOMBRE_PROYECTO] y aún no hemos recibido respuesta.\n\n¿Podrías hacer seguimiento?\n\nGracias.';
      case 'no-response-7':
        return 'Atención,\n\nHa pasado una semana desde que enviamos la cotización a [NOMBRE_CLIENTE] para [NOMBRE_PROYECTO] sin recibir respuesta.\n\nEs importante hacer seguimiento urgente para no perder esta oportunidad.\n\nSaludos.';
      case 'quote-approved':
        return '¡Excelentes noticias!\n\n[NOMBRE_CLIENTE] de [EMPRESA_CLIENTE] acaba de aprobar la cotización para [NOMBRE_PROYECTO].\n\nPodemos proceder con el siguiente paso.\n\n¡Felicitaciones al equipo!';
      case 'quote-rejected':
        return 'Hola equipo,\n\n[NOMBRE_CLIENTE] de [EMPRESA_CLIENTE] ha rechazado la cotización para [NOMBRE_PROYECTO].\n\nSería bueno hacer seguimiento para entender los motivos y ver si podemos ajustar la propuesta.\n\nSaludos.';
      default:
        return 'Notificación automática del workflow para el proyecto [NOMBRE_PROYECTO] del cliente [NOMBRE_CLIENTE].';
    }
  }

  private getDefaultWhatsAppMessage(tipo: string): string {
    switch (tipo) {
      case 'quote-viewed':
        return '¡Hola [NOMBRE_CLIENTE]! 👋 Veo que revisaste nuestra propuesta para [NOMBRE_PROYECTO]. ¿Tienes alguna pregunta? Estoy aquí para ayudarte 😊';
      case 'no-response-3':
        return 'Hola [NOMBRE_CLIENTE] 😊 ¿Tuviste oportunidad de revisar nuestra propuesta para [NOMBRE_PROYECTO]? Me encantaría conocer tus comentarios 💭';
      case 'no-response-7':
        return 'Hola [NOMBRE_CLIENTE] 👋 Solo quería saber si necesitas más información sobre nuestra propuesta para [NOMBRE_PROYECTO]. ¿Hay algo específico que te gustaría aclarar? 🤔';
      case 'quote-approved':
        return '¡Fantástico [NOMBRE_CLIENTE]! 🎉 Gracias por aprobar nuestra propuesta para [NOMBRE_PROYECTO]. Te contactaremos pronto para coordinar los siguientes pasos 🚀';
      case 'quote-rejected':
        return 'Hola [NOMBRE_CLIENTE] 😊 Entiendo que nuestra propuesta no fue la indicada en esta ocasión. ¿Te parece si conversamos para entender mejor tus necesidades? 💡';
      default:
        return 'Hola [NOMBRE_CLIENTE] 👋 Te escribo en relación al proyecto [NOMBRE_PROYECTO]. ¿Tienes un momento para conversar? 😊';
    }
  }

  private getDefaultNotificationMessage(tipo: string): string {
    switch (tipo) {
      case 'quote-viewed':
        return '👀 [NOMBRE_CLIENTE] vio la cotización de [NOMBRE_PROYECTO]';
      case 'no-response-3':
        return '⏰ [NOMBRE_CLIENTE] - Sin respuesta hace 3 días en [NOMBRE_PROYECTO]';
      case 'no-response-7':
        return '🚨 [NOMBRE_CLIENTE] - Sin respuesta hace 7 días en [NOMBRE_PROYECTO]';
      case 'quote-approved':
        return '🎉 [NOMBRE_CLIENTE] aprobó la cotización de [NOMBRE_PROYECTO]';
      case 'quote-rejected':
        return '❌ [NOMBRE_CLIENTE] rechazó la cotización de [NOMBRE_PROYECTO]';
      default:
        return '🔔 Notificación de workflow para [NOMBRE_PROYECTO]';
    }
  }
}