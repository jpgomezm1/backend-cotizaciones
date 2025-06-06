// src/services/ragService.ts
import { Anthropic } from '@anthropic-ai/sdk';

interface ExtractedProjectInfo {
  projectSummary: string;
  services: string[];
  pricing: {
    implementationFee?: number | null; // ✅ Permitir null
    monthlyFee?: number | null; // ✅ Permitir null
    totalAmount?: number | null; // ✅ Permitir null
    description?: string;
  };
  timeline?: string;
  benefits: string[];
}

export class RAGService {
 private anthropic: Anthropic;

 constructor() {
   this.anthropic = new Anthropic({
     apiKey: process.env.ANTHROPIC_API_KEY!
   });
 }

 async processTemplate(htmlTemplate: string): Promise<string> {
   return htmlTemplate;
 }

 async generateQuotation(
   fullTemplate: string,
   clientData: {
     clientName: string;
     clientCompany?: string;
     clientEmail: string;
     clientPhone?: string;
     clientRutNit?: string;
     projectName: string;
     projectDescription: string; // Este es el prompt del usuario
   }
 ): Promise<string> {
   
   console.log('🚀 Iniciando generación con extracción de información estructurada...');

   // 1. Extraer información estructurada del prompt del usuario
   const extractedInfo = await this.extractProjectInformation(clientData.projectDescription);
   console.log('📊 Información extraída:', extractedInfo);

   // 2. Extraer placeholders del template
   const placeholders = this.extractPlaceholders(fullTemplate);
   console.log('📝 Placeholders encontrados:', placeholders.length);

   // 3. Generar contenido usando la información extraída
   const placeholderContent = await this.generatePlaceholderContentWithExtractedInfo(
     placeholders, 
     clientData, 
     extractedInfo
   );

   // 4. Reemplazar placeholders en el template
   let finalHtml = fullTemplate;
   let replacedCount = 0;
   
   console.log('🔄 Iniciando reemplazos...');
   for (const [placeholder, content] of Object.entries(placeholderContent)) {
     const regex = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
     const matches = finalHtml.match(regex);
     if (matches) {
       finalHtml = finalHtml.replace(regex, content);
       replacedCount += matches.length;
       console.log(`   ✅ ${placeholder}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
     } else {
       console.log(`   ⚠️ ${placeholder}: No encontrado en template`);
     }
   }

   console.log(`✅ Reemplazados ${replacedCount} placeholders de ${placeholders.length} encontrados`);
   
   // 5. Verificar si quedan placeholders sin reemplazar
   const remainingPlaceholders = finalHtml.match(/\{\{[^}]+\}\}/g);
   if (remainingPlaceholders) {
     console.log('⚠️ Placeholders sin reemplazar:', remainingPlaceholders.slice(0, 5));
     
     // Reemplazar placeholders restantes con valores genéricos
     for (const remaining of remainingPlaceholders) {
       const placeholderName = remaining.replace(/[{}]/g, '');
       const genericValue = this.generateGenericValue(placeholderName, clientData, extractedInfo);
       finalHtml = finalHtml.replace(new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g'), genericValue);
       console.log(`   🔧 ${placeholderName}: Reemplazado con valor genérico`);
     }
   }

   console.log('✅ Cotización generada exitosamente');
   return finalHtml;
 }

 private async extractProjectInformation(projectPrompt: string): Promise<ExtractedProjectInfo> {
   console.log('🔍 Extrayendo información estructurada del prompt...');

   const extractionPrompt = `
Analiza el siguiente prompt de proyecto y extrae información estructurada:

PROMPT DEL PROYECTO:
"${projectPrompt}"

Extrae y estructura la siguiente información:

1. RESUMEN DEL PROYECTO: Un resumen profesional de 2-3 líneas de lo que se va a entregar
2. SERVICIOS: Lista de servicios/funcionalidades principales mencionados
3. PRECIOS: Cualquier mención de costos, fees, precios (busca números + COP, pesos, USD, etc.)
4. TIMELINE: Cualquier mención de tiempos de entrega o implementación
5. BENEFICIOS: Beneficios o valor agregado mencionados

FORMATO DE RESPUESTA - SOLO JSON VÁLIDO:
{
  "projectSummary": "Resumen profesional del proyecto en 2-3 líneas",
  "services": ["Servicio 1", "Servicio 2", "etc"],
  "pricing": {
    "implementationFee": número_o_null,
    "monthlyFee": número_o_null,
    "totalAmount": número_o_null,
    "description": "descripción de la estructura de precios"
  },
  "timeline": "tiempo estimado o null",
  "benefits": ["Beneficio 1", "Beneficio 2", "etc"]
}

IMPORTANTE: 
- Si mencionan precios específicos, úsalos EXACTAMENTE
- Si dicen "5000.000 COP" = 5000000 (sin puntos como separadores de miles)
- Si dicen "100.000 COP" = 100000
- El projectSummary debe ser profesional y comercial, NO el prompt original

Responde únicamente con el JSON válido:`;

   try {
     const response = await this.anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
       max_tokens: 1500,
       temperature: 0.3,
       messages: [{ role: 'user', content: extractionPrompt }]
     });

     const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
     
     const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
     if (!jsonMatch) {
       console.warn('⚠️ No se pudo extraer información estructurada, usando fallback');
       return this.createFallbackProjectInfo(projectPrompt);
     }

     try {
       const extractedInfo = JSON.parse(jsonMatch[0]);
       console.log('✅ Información extraída exitosamente');
       return extractedInfo;
     } catch (parseError) {
       console.warn('⚠️ Error parseando información extraída, usando fallback');
       return this.createFallbackProjectInfo(projectPrompt);
     }

   } catch (error) {
     console.error('❌ Error extrayendo información:', error);
     return this.createFallbackProjectInfo(projectPrompt);
   }
 }

 private createFallbackProjectInfo(projectPrompt: string): ExtractedProjectInfo {
   return {
     projectSummary: `Proyecto personalizado según requerimientos específicos del cliente`,
     services: ['Desarrollo personalizado', 'Implementación', 'Soporte técnico'],
     pricing: {
       implementationFee: null,
       monthlyFee: null,
       totalAmount: null,
       description: 'Precio a definir según alcance'
     },
     timeline: '4-6 semanas',
     benefits: ['Solución personalizada', 'Soporte especializado', 'Implementación completa']
   };
 }

 private async generatePlaceholderContentWithExtractedInfo(
   placeholders: string[],
   clientData: any,
   extractedInfo: ExtractedProjectInfo
 ): Promise<Record<string, string>> {
   
   console.log('🤖 Generando contenido con información extraída...');

   // Valores base con la información extraída
   const baseValues = this.getEnhancedDefaultValues(clientData, extractedInfo);
   
   // Identificar placeholders que necesitan generación dinámica
   const dynamicPlaceholders = placeholders.filter(p => !baseValues.hasOwnProperty(p));
   
   if (dynamicPlaceholders.length === 0) {
     console.log('✅ Solo placeholders básicos encontrados');
     return baseValues;
   }

   console.log(`🔄 Procesando ${dynamicPlaceholders.length} placeholders dinámicos...`);

   // Procesar placeholders en lotes para mayor eficiencia
   const batchSize = 20;
   let allGeneratedContent: Record<string, string> = {};
   
   for (let i = 0; i < dynamicPlaceholders.length; i += batchSize) {
     const batch = dynamicPlaceholders.slice(i, i + batchSize);
     console.log(`   📦 Procesando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(dynamicPlaceholders.length/batchSize)} (${batch.length} placeholders)...`);
     
     const batchContent = await this.generateBatchContentWithInfo(batch, clientData, extractedInfo);
     allGeneratedContent = { ...allGeneratedContent, ...batchContent };
   }
   
   // Combinar valores por defecto con contenido generado
   const finalContent = { ...baseValues, ...allGeneratedContent };
   console.log(`✅ Contenido generado para ${Object.keys(finalContent).length} placeholders en total`);
   
   return finalContent;
 }

 private getEnhancedDefaultValues(clientData: any, extractedInfo: ExtractedProjectInfo): Record<string, string> {
   const currentDate = new Date().toLocaleDateString('es-ES', {
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   });

   return {
     'COMPANY_NAME': clientData.clientCompany || clientData.clientName,
     'CLIENT_COMPANY_NAME': clientData.clientCompany || clientData.clientName,
     'CLIENT_NIT': clientData.clientRutNit || 'Por definir',
     'PROJECT_NAME': clientData.projectName,
     'PROJECT_DESCRIPTION': extractedInfo.projectSummary, // ✅ Usar el resumen generado
     'SOLUTION_DESCRIPTION': extractedInfo.projectSummary,
     'PROPOSAL_DATE': currentDate,
     'PROPOSAL_TYPE': 'Propuesta de Desarrollo Tecnológico',
     'COMPANY_TAGLINE': 'Automatización que Transforma',
     'CONSULTANT_NAME': 'Equipo irrelevant',
     'PROPOSAL_VALIDITY': '30 días calendario',
     'SOLUTION_NAME': clientData.projectName.split(' ').slice(0, 3).join(' '),
     
     // ✅ Precios extraídos del prompt
     'PRICING_AMOUNT_1': extractedInfo.pricing.implementationFee ? 
       `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$25.000.000',
     'MONTHLY_FEE': extractedInfo.pricing.monthlyFee ? 
       `$${extractedInfo.pricing.monthlyFee.toLocaleString()}` : '$1.200.000',
     'TOTAL_INVESTMENT': extractedInfo.pricing.implementationFee ? 
       `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$25.000.000',
     'PRICING_CONCEPT_1': extractedInfo.services[0] || 'Desarrollo e Implementación',
     'PRICING_DETAIL_1': extractedInfo.pricing.description || 'Incluye desarrollo completo e implementación',
     
     // Timeline extraído
     'TOTAL_DELIVERY_TIME': extractedInfo.timeline || '4-6 semanas',
     'PHASE_1_TIME': '2-3 semanas',
     'PHASE_2_TIME': '2-3 semanas',
     'PHASE_3_TIME': '1 semana',
   };
 }

 private async generateBatchContentWithInfo(
   placeholderBatch: string[],
   clientData: any,
   extractedInfo: ExtractedProjectInfo
 ): Promise<Record<string, string>> {
   
   const prompt = `
Genera contenido específico para una cotización basándote en la información extraída.

DATOS DEL CLIENTE:
- Nombre: ${clientData.clientName}
- Empresa: ${clientData.clientCompany}
- Proyecto: ${clientData.projectName}

INFORMACIÓN DEL PROYECTO EXTRAÍDA:
- Resumen: ${extractedInfo.projectSummary}
- Servicios: ${extractedInfo.services.join(', ')}
- Precios: Fee implementación: ${extractedInfo.pricing.implementationFee || 'No especificado'}, Mensual: ${extractedInfo.pricing.monthlyFee || 'No especificado'}
- Timeline: ${extractedInfo.timeline || 'No especificado'}
- Beneficios: ${extractedInfo.benefits.join(', ')}

PLACEHOLDERS A COMPLETAR:
${placeholderBatch.map(p => `{{${p}}}`).join('\n')}

INSTRUCCIONES:
1. USA EXACTAMENTE los precios especificados en la información extraída
2. Mantén coherencia con los servicios mencionados
3. Para precios: Si hay fee de implementación, úsalo; si hay mensual, úsalo
4. Para problemas/features: Basar en los servicios y beneficios extraídos
5. Mantén el tono profesional y específico al proyecto

FORMATO DE RESPUESTA - SOLO JSON VÁLIDO:
{
 "PLACEHOLDER_NAME": "contenido específico",
 "OTRO_PLACEHOLDER": "otro contenido"
}

Responde únicamente con el JSON válido:`;

   try {
     const response = await this.anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
       max_tokens: 4000,
       temperature: 0.7,
       messages: [{ role: 'user', content: prompt }]
     });

     const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
     
     // Extraer JSON de la respuesta con mejor manejo
     let jsonContent = content.trim();
     
     // Buscar el JSON en la respuesta
     const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
     if (!jsonMatch) {
       console.warn(`   ⚠️ No se encontró JSON válido en la respuesta`);
       return this.generateFallbackBatch(placeholderBatch, clientData, extractedInfo);
     }

     try {
       const parsedContent = JSON.parse(jsonMatch[0]);
       console.log(`   ✅ Contenido generado para ${Object.keys(parsedContent).length} placeholders del lote`);
       return parsedContent;
     } catch (parseError) {
       console.warn(`   ⚠️ Error parseando JSON: ${parseError}`);
       return this.generateFallbackBatch(placeholderBatch, clientData, extractedInfo);
     }

   } catch (error) {
     console.error(`   ❌ Error generando contenido del lote:`, error);
     return this.generateFallbackBatch(placeholderBatch, clientData, extractedInfo);
   }
 }

 private generateFallbackBatch(
   placeholders: string[], 
   clientData: any, 
   extractedInfo?: ExtractedProjectInfo
 ): Record<string, string> {
   const fallback: Record<string, string> = {};
   
   placeholders.forEach(placeholder => {
     fallback[placeholder] = this.generateGenericValue(placeholder, clientData, extractedInfo);
   });
   
   return fallback;
 }

 private extractPlaceholders(template: string): string[] {
   const matches = template.match(/\{\{([^}]+)\}\}/g);
   if (!matches) return [];
   
   const uniquePlaceholders = [...new Set(matches.map(match => match.replace(/[{}]/g, '')))];
   return uniquePlaceholders;
 }

 private generateGenericValue(placeholder: string, clientData: any, extractedInfo?: ExtractedProjectInfo): string {
   const ph = placeholder.toUpperCase();
   
   // Usar precios extraídos si están disponibles
   if (extractedInfo?.pricing) {
     if (ph.includes('PRICING_AMOUNT_1') && extractedInfo.pricing.implementationFee) {
       return `$${extractedInfo.pricing.implementationFee.toLocaleString()}`;
     }
     if (ph.includes('MONTHLY_FEE') && extractedInfo.pricing.monthlyFee) {
       return `$${extractedInfo.pricing.monthlyFee.toLocaleString()}`;
     }
     if (ph.includes('TOTAL_INVESTMENT') && extractedInfo.pricing.implementationFee) {
       return `$${extractedInfo.pricing.implementationFee.toLocaleString()}`;
     }
   }

   // Usar servicios extraídos para features
   if (extractedInfo?.services && ph.includes('FEATURE_')) {
     const serviceIndex = parseInt(ph.match(/\d+/)?.[0] || '1') - 1;
     if (extractedInfo.services[serviceIndex]) {
       return extractedInfo.services[serviceIndex];
     }
   }

   // ✅ Corrección para los beneficios - validar que extractedInfo existe
   if (extractedInfo && extractedInfo.benefits && (ph.includes('BENEFIT_') || ph.includes('SAVINGS_BENEFIT_'))) {
     const benefitIndex = parseInt(ph.match(/\d+/)?.[0] || '1') - 1;
     if (extractedInfo.benefits[benefitIndex]) {
       return extractedInfo.benefits[benefitIndex];
     }
   }

   // Problemas empresariales
   if (ph.includes('PROBLEM_1')) {
     return 'Procesos manuales de análisis que consumen demasiado tiempo y recursos del equipo';
   } else if (ph.includes('PROBLEM_2')) {
     return 'Falta de insights predictivos para la toma de decisiones estratégicas';
   } else if (ph.includes('PROBLEM_3')) {
     return 'Datos dispersos en múltiples sistemas sin integración ni análisis centralizado';
   }
   
   // Características del producto
   else if (ph.includes('FEATURE_1')) {
     return 'Dashboard interactivo con visualizaciones en tiempo real y KPIs personalizables';
   } else if (ph.includes('FEATURE_2')) {
     return 'Algoritmos de machine learning para predicciones y recomendaciones automáticas';
   } else if (ph.includes('FEATURE_3')) {
     return 'Sistema ETL automatizado para integración de múltiples fuentes de datos';
   } else if (ph.includes('FEATURE_4')) {
     return 'Reportes ejecutivos automatizados con insights y alertas inteligentes';
   } else if (ph.includes('FEATURE_5')) {
     return 'API REST para integración con sistemas existentes y escalabilidad';
   } else if (ph.includes('FEATURE_6')) {
     return 'Módulo de seguridad avanzada con control de acceso por roles';
   }
   
   // Pasos del proceso
   else if (ph.includes('STEP_1_TITLE')) {
     return 'Análisis y Mapeo de Datos';
   } else if (ph.includes('STEP_1_DESCRIPTION')) {
     return 'Identificación de fuentes de datos, estructura actual y definición de objetivos analíticos';
   } else if (ph.includes('STEP_2_TITLE')) {
     return 'Desarrollo del Pipeline ETL';
   } else if (ph.includes('STEP_2_DESCRIPTION')) {
     return 'Construcción del sistema de extracción, transformación y carga de datos automatizado';
   } else if (ph.includes('STEP_3_TITLE')) {
     return 'Implementación de Algoritmos ML';
   } else if (ph.includes('STEP_3_DESCRIPTION')) {
     return 'Desarrollo y entrenamiento de modelos de machine learning específicos para el negocio';
   } else if (ph.includes('STEP_4_TITLE')) {
     return 'Dashboard y Visualizaciones';
   } else if (ph.includes('STEP_4_DESCRIPTION')) {
     return 'Creación de interfaces intuitivas para visualización de datos y generación de reportes';
   }
   
   // Fases del proyecto
   else if (ph.includes('PHASE_1_NAME')) {
     return 'Análisis y Diseño';
   } else if (ph.includes('PHASE_1_DESCRIPTION')) {
     return 'Levantamiento de requerimientos, análisis de datos existentes y diseño de arquitectura';
   } else if (ph.includes('PHASE_1_TIME')) {
     return '3-4 semanas';
   } else if (ph.includes('PHASE_2_NAME')) {
     return 'Desarrollo y Configuración';
   } else if (ph.includes('PHASE_2_DESCRIPTION')) {
     return 'Implementación del pipeline de datos, desarrollo de algoritmos ML y dashboard';
   } else if (ph.includes('PHASE_2_TIME')) {
     return '8-10 semanas';
   } else if (ph.includes('PHASE_3_NAME')) {
     return 'Testing y Despliegue';
   } else if (ph.includes('PHASE_3_DESCRIPTION')) {
     return 'Pruebas exhaustivas, capacitación del equipo y puesta en producción';
   } else if (ph.includes('PHASE_3_TIME')) {
     return '2-3 semanas';
   }
   
   // Precios y costos (usar extraídos si están disponibles)
   else if (ph.includes('PRICING_CONCEPT_1')) {
     return extractedInfo?.services[0] || 'Desarrollo Plataforma de Análisis ML';
   } else if (ph.includes('PRICING_DETAIL_1')) {
     return extractedInfo?.pricing.description || 'Incluye pipeline ETL, algoritmos ML, dashboard y API';
   } else if (ph.includes('PRICING_AMOUNT_1')) {
     return extractedInfo?.pricing.implementationFee ? 
       `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$28.500.000';
   } else if (ph.includes('TOTAL_INVESTMENT')) {
     return extractedInfo?.pricing.implementationFee ? 
       `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$28.500.000';
   } else if (ph.includes('MONTHLY_FEE')) {
     return extractedInfo?.pricing.monthlyFee ? 
       `$${extractedInfo.pricing.monthlyFee.toLocaleString()}` : '$1.200.000';
   } else if (ph.includes('TOTAL_DELIVERY_TIME')) {
     return extractedInfo?.timeline || '13-17 semanas (3-4 meses)';
   }
   
   // Beneficios y ahorros
   else if (ph.includes('SAVINGS_BENEFIT_1')) {
     return 'Reducir en 80% el tiempo dedicado a análisis manuales de datos';
   } else if (ph.includes('SAVINGS_BENEFIT_2')) {
     return 'Aumentar la precisión en predicciones empresariales en un 65%';
   } else if (ph.includes('SAVINGS_BENEFIT_3')) {
     return 'Automatizar la generación de reportes ejecutivos semanales';
   } else if (ph.includes('SAVINGS_BENEFIT_4')) {
     return 'Centralizar información dispersa en una sola plataforma inteligente';
   } else if (ph.includes('MONTHLY_SAVINGS_AMOUNT')) {
     return '$4.200.000';
   } else if (ph.includes('MONTHLY_SAVINGS_DESCRIPTION')) {
     return 'Ahorro mensual estimado por optimización de procesos y mejor toma de decisiones';
   } else if (ph.includes('ROI_TIME')) {
     return '7 meses';
   } else if (ph.includes('ROI_DESCRIPTION')) {
     return 'Tiempo estimado para recuperar la inversión basado en ahorros operativos';
   }
   
   // Características de implementación
   else if (ph.includes('IMPLEMENTATION_FEATURE_1')) {
     return 'Configuración completa del entorno cloud (AWS/Azure)';
   } else if (ph.includes('IMPLEMENTATION_FEATURE_2')) {
     return 'Capacitación del equipo técnico (8 horas)';
   } else if (ph.includes('IMPLEMENTATION_FEATURE_3')) {
     return 'Documentación técnica y manual de usuario';
   } else if (ph.includes('IMPLEMENTATION_FEATURE_4')) {
     return 'Soporte técnico durante los primeros 2 meses';
   } else if (ph.includes('IMPLEMENTATION_FEATURE_5')) {
     return 'Migraciones de datos y configuraciones iniciales';
   }
   
   // Plan de pagos
   else if (ph.includes('PAYMENT_PLAN_1')) {
     return '40% al firmar el contrato (inicio del proyecto)';
   } else if (ph.includes('PAYMENT_PLAN_2')) {
     return '30% al completar la fase de análisis y diseño';
   } else if (ph.includes('PAYMENT_PLAN_3')) {
     return '20% al entregar el MVP funcional';
   } else if (ph.includes('PAYMENT_PLAN_4')) {
     return '10% al finalizar pruebas y puesta en producción';
   }
   
   // Descripción de solución
   else if (ph.includes('SOLUTION_DESCRIPTION')) {
     return extractedInfo?.projectSummary || 
       `Una plataforma integral de análisis de datos que utiliza machine learning para transformar información dispersa en insights accionables. El sistema automatiza la recolección, procesamiento y análisis de datos empresariales, generando predicciones y recomendaciones que impulsan la toma de decisiones estratégicas en ${clientData.clientCompany}.`;
   } else if (ph.includes('SOLUTION_BENEFIT_SUMMARY')) {
     return `Con esta solución, ${clientData.clientCompany} tendrá acceso a análisis predictivos avanzados, automatización de reportes y una visión integral de sus datos en tiempo real, reduciendo significativamente los tiempos de análisis manual y mejorando la precisión en la toma de decisiones.`;
   }
   
   // Valores por defecto para casos no contemplados
   else if (ph.includes('PRICE') || ph.includes('COST') || ph.includes('TOTAL')) {
     return '$25.000.000';
   } else if (ph.includes('TIME') || ph.includes('WEEK') || ph.includes('MONTH')) {
     return '4-6 semanas';
   } else if (ph.includes('DESCRIPTION')) {
     return `Componente especializado del proyecto ${clientData.projectName} para ${clientData.clientCompany}`;
   } else {
     return `Contenido personalizado para ${clientData.clientCompany} - ${placeholder}`;
   }
 }

 async generateQuotationFallback(
   fullTemplate: string,
   clientData: any
 ): Promise<string> {
   console.log('🔄 Usando método de fallback con reemplazos básicos...');
   
   const defaultValues = this.getDefaultValues(clientData);
   const placeholders = this.extractPlaceholders(fullTemplate);
   let result = fullTemplate;
   
   // Aplicar valores por defecto
   for (const [key, value] of Object.entries(defaultValues)) {
     result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
   }
   
   // Reemplazar placeholders restantes con valores genéricos
   const remainingPlaceholders = result.match(/\{\{[^}]+\}\}/g);
   if (remainingPlaceholders) {
     for (const placeholder of remainingPlaceholders) {
       const placeholderName = placeholder.replace(/[{}]/g, '');
       const genericValue = this.generateGenericValue(placeholderName, clientData);
       result = result.replace(new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g'), genericValue);
     }
   }
   
   console.log(`✅ Fallback completado: ${placeholders.length} placeholders procesados`);
   return result;
 }

 private getDefaultValues(clientData: any): Record<string, string> {
   const currentDate = new Date().toLocaleDateString('es-ES', {
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   });

   return {
     'COMPANY_NAME': clientData.clientCompany || clientData.clientName,
     'CLIENT_COMPANY_NAME': clientData.clientCompany || clientData.clientName,
     'CLIENT_NIT': clientData.clientRutNit || 'Por definir',
     'PROJECT_NAME': clientData.projectName,
     'PROJECT_DESCRIPTION': clientData.projectDescription,
     'PROPOSAL_DATE': currentDate,
     'PROPOSAL_TYPE': 'Propuesta de Desarrollo Tecnológico',
     'COMPANY_TAGLINE': 'Automatización que Transforma',
     'CONSULTANT_NAME': 'Equipo irrelevant',
     'PROPOSAL_VALIDITY': '30 días calendario',
     'SOLUTION_NAME': clientData.projectName.split(' ').slice(0, 3).join(' '),
   };
 }
}