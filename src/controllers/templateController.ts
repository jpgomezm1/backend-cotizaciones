// src/controllers/templateController.ts
import { Request, Response } from 'express';
import { db } from '../db/connection';
import { templates } from '../db/schema';
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