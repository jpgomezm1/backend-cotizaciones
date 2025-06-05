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
        return res.status(400).json({
          error: 'Faltan campos requeridos'
        });
      }

      // Obtener el template de la base de datos
      const template = await db.query.templates.findFirst({
        where: eq(templates.id, templateId)
      });

      if (!template) {
        return res.status(404).json({
          error: 'Template no encontrado'
        });
      }

      // Procesar template con RAG
      const templateVectorStore = await this.ragService.processTemplate(template.htmlContent);

      // Generar cotización personalizada
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

      // Guardar la cotización en la base de datos
      const newQuotation = await db.insert(quotations).values({
        organizationId: template.organizationId,
        templateId,
        clientName,
        clientCompany,
        clientEmail,
        clientPhone,
        clientRutNit,
        projectName,
        projectDescription,
        generatedHtml,
        status: 'generated'
      }).returning();

      res.json({
        success: true,
        quotation: newQuotation[0],
        generatedHtml
      });

    } catch (error) {
      console.error('Error generating quotation:', error);
      res.status(500).json({
        error: 'Error interno del servidor'
      });
    }
  }
}