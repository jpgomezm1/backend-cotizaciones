// src/controllers/quotationController.ts
import { Request, Response } from 'express';
import { db } from '../db/connection';
import { quotations, templates } from '../db/schema';
import { RAGService } from '../services/ragService';
import { eq } from 'drizzle-orm';

export class QuotationController {
  private ragService: RAGService;

  constructor() {
    this.ragService = new RAGService();
  }

  async generateQuotation(req: Request, res: Response) {
    try {
      console.log('🚀 Iniciando generación de cotización...');
      console.log('📝 Datos recibidos:', req.body);

      const {
        templateId,
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientRutNit,
        projectName,
        projectDescription
      } = req.body;

      // Validar datos requeridos
      if (!templateId || !clientName || !clientEmail || !projectName || !projectDescription) {
        console.log('❌ Datos faltantes:', { templateId: !!templateId, clientName: !!clientName, clientEmail: !!clientEmail, projectName: !!projectName, projectDescription: !!projectDescription });
        return res.status(400).json({
          success: false,
          error: 'Faltan campos requeridos: templateId, clientName, clientEmail, projectName, projectDescription'
        });
      }

      // Obtener el template de la base de datos
      console.log(`🔍 Buscando template: ${templateId}`);
      const template = await db.query.templates.findFirst({
        where: eq(templates.id, templateId)
      });

      if (!template) {
        console.log(`❌ Template no encontrado: ${templateId}`);
        return res.status(404).json({
          success: false,
          error: 'Template no encontrado'
        });
      }

      console.log(`✅ Template encontrado: ${template.name}`);

      // Procesar template con RAG
      console.log('📊 Procesando template...');
      const templateVectorStore = await this.ragService.processTemplate(template.htmlContent);

      // Generar cotización personalizada
      console.log('🤖 Generando cotización con IA...');
      const generatedHtml = await this.ragService.generateQuotation(
        templateVectorStore,
        {
          clientName,
          clientCompany,
          clientEmail,
          clientPhone,
          clientRutNit,
          projectName,
          projectDescription
        }
      );

      console.log(`✅ HTML generado: ${generatedHtml.length} caracteres`);

      // Guardar la cotización en la base de datos
      console.log('💾 Guardando cotización en la base de datos...');
      const [newQuotation] = await db.insert(quotations).values({
        organizationId: template.organizationId,
        templateId,
        clientName,
        clientCompany: clientCompany || null,
        clientEmail,
        clientPhone: clientPhone || null,
        clientRutNit: clientRutNit || null,
        projectName,
        projectDescription,
        generatedHtml,
        status: 'generated'
      }).returning();

      console.log(`✅ Cotización guardada con ID: ${newQuotation.id}`);

      res.json({
        success: true,
        quotation: newQuotation,
        generatedHtml,
        message: 'Cotización generada y guardada exitosamente'
      });

    } catch (error) {
      console.error('❌ Error generating quotation:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Nuevo método para listar cotizaciones
  async listQuotations(req: Request, res: Response) {
    try {
      console.log('📋 Obteniendo lista de cotizaciones...');
      
      const allQuotations = await db.query.quotations.findMany({
        orderBy: (quotations, { desc }) => [desc(quotations.createdAt)],
        with: {
          template: true
        }
      });

      console.log(`✅ Se encontraron ${allQuotations.length} cotizaciones`);

      // Transformar al formato que espera el frontend
      const formattedQuotations = allQuotations.map(quotation => {
        // Calcular días transcurridos
        const diasTranscurridos = Math.floor(
          (new Date().getTime() - new Date(quotation.createdAt).getTime()) / (1000 * 3600 * 24)
        );

        const ultimaActividad = diasTranscurridos === 0 ? 'Creada hoy' : 
                              diasTranscurridos === 1 ? 'Creada ayer' : 
                              `Hace ${diasTranscurridos} días`;

        return {
          id: quotation.id,
          cliente: {
            nombre: quotation.clientName,
            email: quotation.clientEmail,
            telefono: quotation.clientPhone || undefined,
            rut: quotation.clientRutNit || undefined,
            empresa: quotation.clientCompany || undefined
          },
          proyecto: quotation.projectName,
          descripcion: quotation.projectDescription,
          monto: this.extractPriceFromHtml(quotation.generatedHtml || ''),
          estado: this.mapStatus(quotation.status),
          fechaCreacion: quotation.createdAt.toISOString(),
          ultimaActividad,
          plantillaUsada: quotation.template?.name || 'Template desconocido',
          workflowAsignado: 'Workflow Estándar', // Por ahora fijo
          tokensCosto: Math.floor(Math.random() * 50) + 20, // Por ahora aleatorio
          linkPropuesta: `https://propuestas.cotizacionespro.com/${quotation.id}`,
          items: [], // Por ahora vacío
          updates: [
            {
              id: "1",
              fecha: quotation.createdAt.toISOString(),
              tipo: "creada",
              descripcion: `Cotización generada usando template: ${quotation.template?.name}`,
              usuario: "Sistema IA"
            }
          ]
        };
      });

      res.json({
        success: true,
        quotations: formattedQuotations,
        count: formattedQuotations.length
      });
    } catch (error) {
      console.error('❌ Error listing quotations:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Nuevo método para obtener una cotización específica
  async getQuotation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      console.log(`🔍 Buscando cotización con ID: ${id}`);
      
      const quotation = await db.query.quotations.findFirst({
        where: eq(quotations.id, id),
        with: {
          template: true
        }
      });

      if (!quotation) {
        console.log(`❌ Cotización no encontrada: ${id}`);
        return res.status(404).json({
          success: false,
          error: 'Cotización no encontrada'
        });
      }

      console.log(`✅ Cotización encontrada: ${quotation.projectName}`);

      // Transformar al formato del frontend (mismo código que arriba)
      const diasTranscurridos = Math.floor(
        (new Date().getTime() - new Date(quotation.createdAt).getTime()) / (1000 * 3600 * 24)
      );

      const ultimaActividad = diasTranscurridos === 0 ? 'Creada hoy' : 
                            diasTranscurridos === 1 ? 'Creada ayer' : 
                            `Hace ${diasTranscurridos} días`;

      const formattedQuotation = {
        id: quotation.id,
        cliente: {
          nombre: quotation.clientName,
          email: quotation.clientEmail,
          telefono: quotation.clientPhone || undefined,
          rut: quotation.clientRutNit || undefined,
          empresa: quotation.clientCompany || undefined
        },
        proyecto: quotation.projectName,
        descripcion: quotation.projectDescription,
        monto: this.extractPriceFromHtml(quotation.generatedHtml || ''),
        estado: this.mapStatus(quotation.status),
        fechaCreacion: quotation.createdAt.toISOString(),
        ultimaActividad,
        plantillaUsada: quotation.template?.name || 'Template desconocido',
        workflowAsignado: 'Workflow Estándar',
        tokensCosto: Math.floor(Math.random() * 50) + 20,
        linkPropuesta: `https://propuestas.cotizacionespro.com/${quotation.id}`,
        items: [],
        updates: [
          {
            id: "1",
            fecha: quotation.createdAt.toISOString(),
            tipo: "creada",
            descripcion: `Cotización generada usando template: ${quotation.template?.name}`,
            usuario: "Sistema IA"
          }
        ],
        generatedHtml: quotation.generatedHtml // Incluir el HTML para la vista previa
      };

      res.json({
        success: true,
        quotation: formattedQuotation
      });
    } catch (error) {
      console.error('❌ Error getting quotation:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  }

  // Helper methods
  private extractPriceFromHtml(html: string): number {
    // Intentar extraer precio del HTML generado
    const priceMatches = html.match(/\$(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/g);
    if (priceMatches && priceMatches.length > 0) {
      // Tomar el precio más alto encontrado
      const prices = priceMatches.map(match => {
        const numStr = match.replace(/[$,]/g, '').replace(/\./g, '');
        return parseInt(numStr, 10);
      }).filter(num => !isNaN(num) && num > 1000); // Filtrar precios válidos

      return prices.length > 0 ? Math.max(...prices) : 0;
    }
    return 0;
  }

  private mapStatus(dbStatus: string): "borrador" | "enviada" | "vista" | "aprobada" | "rechazada" {
    switch (dbStatus) {
      case 'generated': return 'borrador';
      case 'sent': return 'enviada';
      case 'viewed': return 'vista';
      case 'approved': return 'aprobada';
      case 'rejected': return 'rechazada';
      default: return 'borrador';
    }
  }
}