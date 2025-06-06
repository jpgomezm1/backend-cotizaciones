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

     // Extraer el resumen del proyecto generado
     const projectSummary = this.extractProjectSummary(generatedHtml);
     console.log(`📋 Resumen extraído: ${projectSummary.substring(0, 100)}...`);

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
       projectDescription: projectSummary, // ✅ Guardar el resumen generado en lugar del prompt
       generatedHtml,
       status: 'generated'
     }).returning();

     console.log(`✅ Cotización guardada con ID: ${newQuotation.id}`);

     res.json({
       success: true,
       quotation: {
         ...newQuotation,
         extractedSummary: projectSummary // ✅ Devolver el resumen extraído
       },
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
         descripcion: quotation.projectDescription, // ✅ Ahora contiene el resumen generado
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
       descripcion: quotation.projectDescription, // ✅ Ahora contiene el resumen generado
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

 // Nuevo método para eliminar cotización
 async deleteQuotation(req: Request, res: Response) {
   try {
     const { id } = req.params;
     console.log(`🗑️ Eliminando cotización con ID: ${id}`);
     
     // Verificar que la cotización existe
     const existingQuotation = await db.query.quotations.findFirst({
       where: eq(quotations.id, id)
     });

     if (!existingQuotation) {
       console.log(`❌ Cotización no encontrada: ${id}`);
       return res.status(404).json({
         success: false,
         error: 'Cotización no encontrada'
       });
     }

     // Eliminar la cotización
     const [deletedQuotation] = await db.delete(quotations)
       .where(eq(quotations.id, id))
       .returning();

     console.log(`✅ Cotización eliminada: ${deletedQuotation.projectName}`);

     res.json({
       success: true,
       message: 'Cotización eliminada exitosamente',
       deletedQuotation
     });

   } catch (error) {
     console.error('❌ Error deleting quotation:', error);
     res.status(500).json({ 
       success: false,
       error: 'Error interno del servidor',
       details: process.env.NODE_ENV === 'development' ? String(error) : undefined
     });
   }
 }

 // Helper methods
 private extractPriceFromHtml(html: string): number {
   // Intentar extraer precio del HTML generado con patrones mejorados
   const pricePatterns = [
     /\$\s*(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/g, // $1,000,000 o $1.000.000
     /(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)\s*COP/g, // 1,000,000 COP
     /precio[^:]*:?\s*\$?(\d{1,3}(?:[,\.]\d{3})*)/gi, // precio: $1,000,000
     /total[^:]*:?\s*\$?(\d{1,3}(?:[,\.]\d{3})*)/gi, // total: $1,000,000
     /inversión[^:]*:?\s*\$?(\d{1,3}(?:[,\.]\d{3})*)/gi // inversión: $1,000,000
   ];

   let allPrices: number[] = [];

   pricePatterns.forEach(pattern => {
     let match;
     while ((match = pattern.exec(html)) !== null) {
       const priceStr = match[1].replace(/[,$\.]/g, '');
       const price = parseInt(priceStr, 10);
       if (!isNaN(price) && price > 10000) { // Solo precios mayores a 10,000
         allPrices.push(price);
       }
     }
   });

   // Devolver el precio más alto encontrado, o 0 si no se encuentra ninguno
   return allPrices.length > 0 ? Math.max(...allPrices) : 0;
 }

 private extractProjectSummary(html: string): string {
   // Intentar extraer el resumen del proyecto del HTML generado
   const summaryPatterns = [
     /<p[^>]*class="[^"]*summary[^"]*"[^>]*>(.*?)<\/p>/i,
     /<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)<\/div>/i,
     /<p[^>]*class="[^"]*project[^"]*description[^"]*"[^>]*>(.*?)<\/p>/i,
     /<div[^>]*class="[^"]*project[^"]*summary[^"]*"[^>]*>(.*?)<\/div>/i,
     // Buscar en secciones comunes
     /<h3[^>]*>(?:Descripción|Resumen|Proyecto)[^<]*<\/h3>\s*<p[^>]*>(.*?)<\/p>/i,
     /<h2[^>]*>(?:Descripción|Resumen|Proyecto)[^<]*<\/h2>\s*<p[^>]*>(.*?)<\/p>/i,
     // Buscar el primer párrafo después de títulos específicos
     /(?:descripción del proyecto|resumen del proyecto|sobre el proyecto)[^<]*<\/[^>]*>\s*<p[^>]*>(.*?)<\/p>/i
   ];

   for (const pattern of summaryPatterns) {
     const match = html.match(pattern);
     if (match && match[1]) {
       let summary = match[1]
         .replace(/<[^>]*>/g, '') // Remover tags HTML
         .replace(/&nbsp;/g, ' ') // Reemplazar &nbsp;
         .replace(/&amp;/g, '&') // Reemplazar &amp;
         .replace(/&lt;/g, '<') // Reemplazar &lt;
         .replace(/&gt;/g, '>') // Reemplazar &gt;
         .trim();

       // Si el resumen es muy largo, tomar solo las primeras 2-3 oraciones
       if (summary.length > 300) {
         const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
         summary = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
       }

       if (summary.length > 50) { // Solo devolver si tiene contenido significativo
         return summary;
       }
     }
   }

   // Si no se encuentra un resumen específico, buscar el primer párrafo con contenido sustancial
   const paragraphs = html.match(/<p[^>]*>(.*?)<\/p>/gi);
   if (paragraphs) {
     for (const paragraph of paragraphs) {
       const content = paragraph
         .replace(/<[^>]*>/g, '')
         .replace(/&nbsp;/g, ' ')
         .trim();
       
       if (content.length > 100 && !content.toLowerCase().includes('lorem')) {
         return content.length > 300 ? content.substring(0, 300) + '...' : content;
       }
     }
   }
   
   return 'Proyecto personalizado desarrollado según requerimientos específicos del cliente';
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