// src/controllers/templateController.ts
import { Request, Response } from 'express';
import { db } from '../db/connection';
import { templates, quotations } from '../db/schema'; // ✅ Agregar quotations al import
import { eq } from 'drizzle-orm';

export class TemplateController {
  async listTemplates(req: Request, res: Response) {
    try {
      console.log('📋 Obteniendo lista de templates...');
      
      const allTemplates = await db.query.templates.findMany({
        orderBy: (templates, { desc }) => [desc(templates.createdAt)]
      });

      console.log(`✅ Se encontraron ${allTemplates.length} templates`);

      // Transformar al formato que espera el frontend
      const formattedTemplates = allTemplates.map(template => {
        // Extraer información del template
        const placeholders = (template.htmlContent.match(/\{\{[^}]+\}\}/g) || []).length;
        
        return {
          id: template.id,
          nombre: template.name,
          descripcion: `Template con ${placeholders} placeholders personalizables`,
          categoria: this.inferCategory(template.name),
          fechaAsignacion: template.createdAt.toISOString(),
          ultimaModificacion: template.createdAt.toISOString(), // Usar createdAt por ahora
          estado: "activo" as const,
          usos: Math.floor(Math.random() * 50) + 1, // Temporal
          preview: "/templates/preview.jpg", // Temporal
          htmlContent: template.htmlContent,
          estilos: this.extractStyles(template.htmlContent)
        };
      });

      res.json({
        success: true,
        templates: formattedTemplates,
        count: formattedTemplates.length
      });
    } catch (error) {
      console.error('❌ Error listing templates:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor',
        message: 'No se pudieron cargar los templates',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  async getTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🔍 Buscando template con ID: ${id}`);
      
      const template = await db.query.templates.findFirst({
        where: eq(templates.id, id)
      });

      if (!template) {
        console.log(`❌ Template no encontrado: ${id}`);
        return res.status(404).json({
          error: 'Template no encontrado'
        });
      }

      console.log(`✅ Template encontrado: ${template.name}`);
      const placeholders = (template.htmlContent.match(/\{\{[^}]+\}\}/g) || []).length;
      
      const formattedTemplate = {
        id: template.id,
        nombre: template.name,
        descripcion: `Template con ${placeholders} placeholders personalizables`,
        categoria: this.inferCategory(template.name),
        fechaAsignacion: template.createdAt.toISOString(),
        ultimaModificacion: template.createdAt.toISOString(),
        estado: "activo" as const,
        usos: Math.floor(Math.random() * 50) + 1,
        preview: "/templates/preview.jpg",
        htmlContent: template.htmlContent,
        estilos: this.extractStyles(template.htmlContent)
      };

      res.json({
        success: true,
        template: formattedTemplate
      });
    } catch (error) {
      console.error('❌ Error getting template:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  async createTemplateRequest(req: Request, res: Response) {
    try {
      const { nombre, descripcion, categoria, prioridad } = req.body;

      // Validar datos requeridos
      if (!nombre || !descripcion || !categoria) {
        return res.status(400).json({
          error: 'Faltan campos requeridos: nombre, descripcion, categoria'
        });
      }

      // Por ahora solo loggeamos la solicitud
      console.log('📝 Nueva solicitud de template:', {
        nombre,
        descripcion,
        categoria,
        prioridad,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Solicitud de template recibida correctamente',
        requestId: `req_${Date.now()}`
      });
    } catch (error) {
      console.error('❌ Error creating template request:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor'
      });
    }
  }

  async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      console.log(`📝 Actualizando template: ${id}`);

      // Validar datos requeridos
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'El nombre del template es requerido'
        });
      }

      // Verificar que el template existe
      const existingTemplate = await db.query.templates.findFirst({
        where: eq(templates.id, id)
      });

      if (!existingTemplate) {
        console.log(`❌ Template no encontrado: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Template no encontrado'
        });
      }

      // Actualizar el template
      const [updatedTemplate] = await db.update(templates)
        .set({ 
          name: name.trim(),
          // updatedAt: new Date() // Comentar por ahora ya que no existe en el schema
        })
        .where(eq(templates.id, id))
        .returning();

      console.log(`✅ Template actualizado: ${updatedTemplate.name}`);

      // Formatear respuesta
      const placeholders = (updatedTemplate.htmlContent.match(/\{\{[^}]+\}\}/g) || []).length;
      
      const formattedTemplate = {
        id: updatedTemplate.id,
        nombre: updatedTemplate.name,
        descripcion: `Template con ${placeholders} placeholders personalizables`,
        categoria: this.inferCategory(updatedTemplate.name),
        fechaAsignacion: updatedTemplate.createdAt.toISOString(),
        ultimaModificacion: updatedTemplate.createdAt.toISOString(), // Usar createdAt por ahora
        estado: "activo" as const,
        usos: Math.floor(Math.random() * 50) + 1,
        preview: "/templates/preview.jpg",
        htmlContent: updatedTemplate.htmlContent,
        estilos: this.extractStyles(updatedTemplate.htmlContent)
      };

      res.json({
        success: true,
        template: formattedTemplate,
        message: 'Template actualizado exitosamente'
      });

    } catch (error) {
      console.error('❌ Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🗑️ Eliminando template: ${id}`);

      // Verificar que el template existe
      const existingTemplate = await db.query.templates.findFirst({
        where: eq(templates.id, id)
      });

      if (!existingTemplate) {
        console.log(`❌ Template no encontrado: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Template no encontrado'
        });
      }

      // Verificar si hay cotizaciones que usan este template
      const quotationsUsingTemplate = await db.query.quotations.findMany({
        where: eq(quotations.templateId, id),
        limit: 1
      });

      if (quotationsUsingTemplate.length > 0) {
        console.log(`⚠️ Template tiene cotizaciones asociadas: ${id}`);
        return res.status(400).json({
          success: false,
          error: 'No se puede eliminar el template porque tiene cotizaciones asociadas'
        });
      }

      // Eliminar el template
      const [deletedTemplate] = await db.delete(templates)
        .where(eq(templates.id, id))
        .returning();

      console.log(`✅ Template eliminado: ${deletedTemplate.name}`);

      res.json({
        success: true,
        message: 'Template eliminado exitosamente',
        deletedTemplate: {
          id: deletedTemplate.id,
          nombre: deletedTemplate.name
        }
      });

    } catch (error) {
      console.error('❌ Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  private inferCategory(templateName: string): string {
    const name = templateName.toLowerCase();
    
    if (name.includes('web') || name.includes('desarrollo')) return 'desarrollo';
    if (name.includes('mobile') || name.includes('app')) return 'mobile';
    if (name.includes('consultoria') || name.includes('consultoría')) return 'consultoria';
    if (name.includes('servicio')) return 'servicios';
    if (name.includes('diseño') || name.includes('diseno')) return 'diseno';
    if (name.includes('marketing')) return 'marketing';
    if (name.includes('mcp') || name.includes('server') || name.includes('análisis')) return 'desarrollo';
    
    return 'desarrollo'; // Por defecto
  }

  private extractStyles(htmlContent: string) {
    // Extraer colores del CSS
    const primaryColorMatch = htmlContent.match(/--primary-color:\s*([^;]+)/);
    const accentColorMatch = htmlContent.match(/--secondary-color:\s*([^;]+)/);
    const fontMatch = htmlContent.match(/font-family:\s*'([^']+)'/);

    return {
      primaryColor: primaryColorMatch?.[1]?.trim() || '#6045FF',
      accentColor: accentColorMatch?.[1]?.trim() || '#05C876',
      fontFamily: fontMatch?.[1]?.trim() || 'Poppins, sans-serif'
    };
  }

  async healthCheck(req: Request, res: Response) {
    try {
      // Verificar conexión a base de datos
      const templatesCount = await db.query.templates.findMany({ limit: 1 });
      
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Backend de cotizaciones funcionando correctamente',
        database: 'connected',
        templatesAvailable: templatesCount.length > 0
      });
    } catch (error) {
      console.error('❌ Error en health check:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Error de conexión a base de datos',
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }
}