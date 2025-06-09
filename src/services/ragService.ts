// src/services/ragService.ts
import { Anthropic } from '@anthropic-ai/sdk';

interface ExtractedProjectInfo {
  projectSummary: string;
  services: string[];
  pricing: {
    implementationFee?: number | null;
    monthlyFee?: number | null;
    totalAmount?: number | null;
    description?: string;
  };
  timeline?: string;
  benefits: string[];
}

interface TemplateAnalysis {
  templateType: string;
  industry: string;
  tone: string;
  mainSections: string[];
  placeholderCategories: {
    client: string[];
    project: string[];
    pricing: string[];
    dates: string[];
    company: string[];
  };
  contentStyle: string;
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
     projectDescription: string;
   },
   templateContext?: {
     name: string;
     category: string;
     description: string;
   }
 ): Promise<string> {
   
   console.log('🚀 Iniciando generación genérica de cotización...');
   console.log('📊 Contexto del template:', templateContext);

   // 1. Analizar el template para entender su estructura
   const templateAnalysis = await this.analyzeTemplate(fullTemplate, templateContext);
   console.log('🔍 Análisis del template completado:', templateAnalysis.templateType);

   // 2. Extraer información del prompt del usuario
   const extractedInfo = await this.extractProjectInformation(clientData.projectDescription);
   console.log('📊 Información extraída:', extractedInfo);

   // 3. Extraer placeholders del template
   const placeholders = this.extractPlaceholders(fullTemplate);
   console.log('📝 Placeholders encontrados:', placeholders.length);

   // 4. Generar contenido usando análisis inteligente
   const placeholderContent = await this.generateIntelligentContent(
     placeholders,
     clientData,
     extractedInfo,
     templateAnalysis
   );

   // 5. Reemplazar placeholders en el template
   let finalHtml = fullTemplate;
   let replacedCount = 0;
   
   console.log('🔄 Iniciando reemplazos inteligentes...');
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
   
   // 6. Procesar placeholders restantes con IA
   const remainingPlaceholders = finalHtml.match(/\{\{[^}]+\}\}/g);
   if (remainingPlaceholders) {
     console.log('⚠️ Placeholders restantes:', remainingPlaceholders.slice(0, 5));
     
     finalHtml = await this.processRemainingPlaceholders(
       finalHtml,
       remainingPlaceholders,
       clientData,
       extractedInfo,
       templateAnalysis
     );
   }

   console.log('✅ Cotización generada exitosamente con sistema genérico');
   return finalHtml;
 }

 private async analyzeTemplate(
   template: string,
   templateContext?: any
 ): Promise<TemplateAnalysis> {
   const prompt = `
Analiza el siguiente template HTML y proporciona información sobre su estructura y propósito:

TEMPLATE CONTEXT:
${templateContext ? `
- Nombre: ${templateContext.name}
- Categoría: ${templateContext.category}
- Descripción: ${templateContext.description}
` : 'Sin contexto adicional'}

TEMPLATE HTML:
${template.substring(0, 5000)}... (truncado)

Analiza y extrae:
1. TIPO DE TEMPLATE: ¿Es para qué tipo de servicio/producto? (desarrollo web, marketing, consultoría, eventos, etc.)
2. ESTRUCTURA: ¿Qué secciones principales tiene?
3. PLACEHOLDERS: Categoriza los placeholders por tipo (cliente, proyecto, precios, fechas, etc.)
4. ESTILO: ¿Qué tono y estilo de contenido espera? (formal, técnico, comercial, etc.)
5. INDUSTRIA: ¿Para qué industria o sector está diseñado?

FORMATO DE RESPUESTA - JSON:
{
  "templateType": "tipo de servicio",
  "industry": "industria objetivo",
  "tone": "tono del contenido",
  "mainSections": ["sección1", "sección2"],
  "placeholderCategories": {
    "client": ["CLIENT_NAME", "CLIENT_COMPANY"],
    "project": ["PROJECT_NAME", "PROJECT_DESCRIPTION"],
    "pricing": ["TOTAL_AMOUNT", "PRICING_1"],
    "dates": ["PROPOSAL_DATE", "DELIVERY_DATE"],
    "company": ["COMPANY_NAME", "CONSULTANT_NAME"]
  },
  "contentStyle": "descripción del estilo esperado"
}`;

   try {
     const response = await this.anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
       max_tokens: 2000,
       temperature: 0.3,
       messages: [{ role: 'user', content: prompt }]
     });

     const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
     const jsonMatch = content.match(/\{[\s\S]*\}/);
     
     if (jsonMatch) {
       const parsed = JSON.parse(jsonMatch[0]);
       console.log('✅ Template analizado exitosamente');
       return parsed;
     }
   } catch (error) {
     console.warn('⚠️ Error analizando template:', error);
   }

   // Fallback analysis
   return {
     templateType: "servicio general",
     industry: "tecnología",
     tone: "profesional",
     mainSections: ["propuesta", "precios", "cronograma"],
     placeholderCategories: {
       client: [],
       project: [],
       pricing: [],
       dates: [],
       company: []
     },
     contentStyle: "profesional y técnico"
   };
 }

 private async generateIntelligentContent(
   placeholders: string[],
   clientData: any,
   extractedInfo: ExtractedProjectInfo,
   templateAnalysis: TemplateAnalysis
 ): Promise<Record<string, string>> {
   
   // Base values que siempre funcionan
   const baseValues = this.getUniversalBaseValues(clientData, extractedInfo);
   
   // Identificar placeholders que necesitan generación específica
   const dynamicPlaceholders = placeholders.filter(p => !baseValues.hasOwnProperty(p));
   
   if (dynamicPlaceholders.length === 0) {
     console.log('✅ Solo placeholders básicos encontrados');
     return baseValues;
   }

   console.log(`🔄 Procesando ${dynamicPlaceholders.length} placeholders dinámicos...`);

   // Generar contenido inteligente para placeholders dinámicos
   const intelligentContent = await this.generateContextAwareContent(
     dynamicPlaceholders,
     clientData,
     extractedInfo,
     templateAnalysis
   );

   return { ...baseValues, ...intelligentContent };
 }

 private async generateContextAwareContent(
   placeholders: string[],
   clientData: any,
   extractedInfo: ExtractedProjectInfo,
   templateAnalysis: TemplateAnalysis
 ): Promise<Record<string, string>> {
   
   const prompt = `
Genera contenido específico para placeholders basándote en el contexto del template y proyecto.

ANÁLISIS DEL TEMPLATE:
- Tipo: ${templateAnalysis.templateType}
- Industria: ${templateAnalysis.industry}
- Tono: ${templateAnalysis.tone}
- Estilo: ${templateAnalysis.contentStyle}

DATOS DEL CLIENTE:
- Nombre: ${clientData.clientName}
- Empresa: ${clientData.clientCompany || 'N/A'}
- Proyecto: ${clientData.projectName}

INFORMACIÓN DEL PROYECTO:
- Resumen: ${extractedInfo.projectSummary}
- Servicios: ${extractedInfo.services.join(', ')}
- Timeline: ${extractedInfo.timeline || 'No especificado'}

PLACEHOLDERS A COMPLETAR:
${placeholders.map(p => `{{${p}}}`).join('\n')}

INSTRUCCIONES:
1. Genera contenido apropiado para el tipo de template: ${templateAnalysis.templateType}
2. Mantén el tono: ${templateAnalysis.tone}
3. Adapta el contenido a la industria: ${templateAnalysis.industry}
4. Para precios: usa información extraída o genera estimaciones realistas para ${templateAnalysis.industry}
5. Para fechas: calcula basado en el timeline del proyecto
6. Para características: basa en los servicios identificados
7. Mantén coherencia con el estilo: ${templateAnalysis.contentStyle}

FORMATO - JSON:
{
  "PLACEHOLDER_NAME": "contenido generado",
  "OTRO_PLACEHOLDER": "otro contenido"
}`;

   try {
     const response = await this.anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
       max_tokens: 4000,
       temperature: 0.7,
       messages: [{ role: 'user', content: prompt }]
     });

     const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
     const jsonMatch = content.match(/\{[\s\S]*\}/);
     
     if (jsonMatch) {
       const parsed = JSON.parse(jsonMatch[0]);
       console.log(`✅ Contenido inteligente generado para ${Object.keys(parsed).length} placeholders`);
       return parsed;
     }
   } catch (error) {
     console.warn('⚠️ Error generando contenido inteligente:', error);
   }

   return this.generateFallbackContent(placeholders, clientData, extractedInfo);
 }

 private async processRemainingPlaceholders(
   html: string,
   placeholders: string[],
   clientData: any,
   extractedInfo: ExtractedProjectInfo,
   templateAnalysis: TemplateAnalysis
 ): Promise<string> {
   
   const cleanPlaceholders = placeholders.map(p => p.replace(/[{}]/g, ''));
   
   const prompt = `
Hay placeholders sin reemplazar en este HTML. Genera contenido apropiado para completarlos.

CONTEXTO DEL TEMPLATE: ${templateAnalysis.templateType} para ${templateAnalysis.industry}
CLIENTE: ${clientData.clientName} - ${clientData.projectName}
TONO: ${templateAnalysis.tone}

PLACEHOLDERS SIN REEMPLAZAR:
${cleanPlaceholders.join(', ')}

Genera contenido corto y apropiado para cada placeholder manteniendo el tono ${templateAnalysis.tone}. 
Responde SOLO con JSON: {"PLACEHOLDER": "contenido"}`;

   try {
     const response = await this.anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
       max_tokens: 2000,
       temperature: 0.7,
       messages: [{ role: 'user', content: prompt }]
     });

     const content = response.content[0].type === 'text' ? response.content[0].text : '{}';
     const jsonMatch = content.match(/\{[\s\S]*\}/);
     
     if (jsonMatch) {
       const replacements = JSON.parse(jsonMatch[0]);
       
       let finalHtml = html;
       for (const [placeholder, value] of Object.entries(replacements)) {
         const cleanPlaceholder = placeholder.replace(/[{}]/g, '');
         finalHtml = finalHtml.replace(
           new RegExp(`\\{\\{${cleanPlaceholder}\\}\\}`, 'g'), 
           String(value)
         );
       }
       
       console.log(`✅ Procesados ${Object.keys(replacements).length} placeholders restantes`);
       return finalHtml;
     }
   } catch (error) {
     console.warn('⚠️ Error procesando placeholders restantes:', error);
   }

   return html;
 }

 private getUniversalBaseValues(clientData: any, extractedInfo: ExtractedProjectInfo): Record<string, string> {
   const currentDate = new Date().toLocaleDateString('es-ES', {
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   });

   return {
     // Datos del cliente (universales)
     'CLIENT_NAME': clientData.clientName,
     'CLIENT_COMPANY': clientData.clientCompany || clientData.clientName,
     'CLIENT_EMAIL': clientData.clientEmail,
     'CLIENT_PHONE': clientData.clientPhone || '',
     'CLIENT_RUT': clientData.clientRutNit || '',
     'COMPANY_NAME': clientData.clientCompany || clientData.clientName,
     'NOMBRE_CLIENTE': clientData.clientName,
     'EMPRESA_CLIENTE': clientData.clientCompany || clientData.clientName,
     'EMAIL_CLIENTE': clientData.clientEmail,
     'TELEFONO_CLIENTE': clientData.clientPhone || '',
     'RUT_CLIENTE': clientData.clientRutNit || '',
     
     // Datos del proyecto (universales)
     'PROJECT_NAME': clientData.projectName,
     'PROJECT_DESCRIPTION': extractedInfo.projectSummary,
     'SOLUTION_DESCRIPTION': extractedInfo.projectSummary,
     'NOMBRE_PROYECTO': clientData.projectName,
     'DESCRIPCION_PROYECTO': extractedInfo.projectSummary,
     
     // Fechas (universales)
     'PROPOSAL_DATE': currentDate,
     'CURRENT_DATE': currentDate,
     'DATE': currentDate,
     'FECHA_PROPUESTA': currentDate,
     'FECHA_ACTUAL': currentDate,
     'FECHA': currentDate,
    
    // Precios si están disponibles
    'TOTAL_AMOUNT': extractedInfo.pricing.totalAmount ? 
      `$${extractedInfo.pricing.totalAmount.toLocaleString()}` : '$0',
    'IMPLEMENTATION_FEE': extractedInfo.pricing.implementationFee ? 
      `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$0',
    'MONTHLY_FEE': extractedInfo.pricing.monthlyFee ? 
      `$${extractedInfo.pricing.monthlyFee.toLocaleString()}` : '$0',
    'MONTO_TOTAL': extractedInfo.pricing.totalAmount ? 
      `$${extractedInfo.pricing.totalAmount.toLocaleString()}` : '$0',
    'PRECIO_IMPLEMENTACION': extractedInfo.pricing.implementationFee ? 
      `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$0',
    'CUOTA_MENSUAL': extractedInfo.pricing.monthlyFee ? 
      `$${extractedInfo.pricing.monthlyFee.toLocaleString()}` : '$0',
    
    // Timeline si está disponible
    'DELIVERY_TIME': extractedInfo.timeline || '4-6 semanas',
    'TIMELINE': extractedInfo.timeline || '4-6 semanas',
    'TIEMPO_ENTREGA': extractedInfo.timeline || '4-6 semanas',
    'CRONOGRAMA': extractedInfo.timeline || '4-6 semanas',
    
    // Valores por defecto de la empresa
    'PROPOSAL_VALIDITY': '30 días',
    'PROPOSAL_TYPE': 'Propuesta Comercial',
    'VALIDEZ_PROPUESTA': '30 días',
    'TIPO_PROPUESTA': 'Propuesta Comercial'
  };
}

private generateFallbackContent(
  placeholders: string[], 
  clientData: any, 
  extractedInfo: ExtractedProjectInfo
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

  // Beneficios extraídos
  if (extractedInfo && extractedInfo.benefits && (ph.includes('BENEFIT_') || ph.includes('SAVINGS_BENEFIT_'))) {
    const benefitIndex = parseInt(ph.match(/\d+/)?.[0] || '1') - 1;
    if (extractedInfo.benefits[benefitIndex]) {
      return extractedInfo.benefits[benefitIndex];
    }
  }

  // Valores genéricos basados en el nombre del placeholder
  if (ph.includes('PROBLEM_1')) {
    return 'Procesos manuales que consumen tiempo y recursos del equipo';
  } else if (ph.includes('PROBLEM_2')) {
    return 'Falta de eficiencia en los procesos actuales';
  } else if (ph.includes('PROBLEM_3')) {
    return 'Necesidad de optimización y automatización';
  } else if (ph.includes('FEATURE_1')) {
    return 'Funcionalidad principal personalizada según requerimientos';
  } else if (ph.includes('FEATURE_2')) {
    return 'Sistema de gestión y administración integral';
  } else if (ph.includes('FEATURE_3')) {
    return 'Interfaz intuitiva y fácil de usar';
  } else if (ph.includes('STEP_1_TITLE')) {
    return 'Análisis y Planificación';
  } else if (ph.includes('STEP_1_DESCRIPTION')) {
    return 'Evaluación detallada de requerimientos y planificación del proyecto';
  } else if (ph.includes('STEP_2_TITLE')) {
    return 'Desarrollo e Implementación';
  } else if (ph.includes('STEP_2_DESCRIPTION')) {
    return 'Construcción y configuración de la solución personalizada';
  } else if (ph.includes('STEP_3_TITLE')) {
    return 'Pruebas y Entrega';
  } else if (ph.includes('STEP_3_DESCRIPTION')) {
    return 'Validación, pruebas y puesta en funcionamiento';
  } else if (ph.includes('PHASE_1_NAME')) {
    return 'Fase de Análisis';
  } else if (ph.includes('PHASE_1_DESCRIPTION')) {
    return 'Levantamiento de requerimientos y análisis de necesidades';
  } else if (ph.includes('PHASE_1_TIME')) {
    return '1-2 semanas';
  } else if (ph.includes('PHASE_2_NAME')) {
    return 'Fase de Desarrollo';
  } else if (ph.includes('PHASE_2_DESCRIPTION')) {
    return 'Implementación y desarrollo de la solución';
  } else if (ph.includes('PHASE_2_TIME')) {
    return '3-4 semanas';
  } else if (ph.includes('PHASE_3_NAME')) {
    return 'Fase de Entrega';
  } else if (ph.includes('PHASE_3_DESCRIPTION')) {
    return 'Pruebas finales y puesta en producción';
  } else if (ph.includes('PHASE_3_TIME')) {
    return '1 semana';
  } else if (ph.includes('PRICING_CONCEPT_1')) {
    return extractedInfo?.services[0] || 'Desarrollo de Solución Personalizada';
  } else if (ph.includes('PRICING_DETAIL_1')) {
    return extractedInfo?.pricing.description || 'Incluye desarrollo completo y puesta en funcionamiento';
  } else if (ph.includes('PRICING_AMOUNT_1')) {
    return extractedInfo?.pricing.implementationFee ? 
      `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$15.000.000';
  } else if (ph.includes('TOTAL_INVESTMENT')) {
    return extractedInfo?.pricing.implementationFee ? 
      `$${extractedInfo.pricing.implementationFee.toLocaleString()}` : '$15.000.000';
  } else if (ph.includes('MONTHLY_FEE')) {
    return extractedInfo?.pricing.monthlyFee ? 
      `$${extractedInfo.pricing.monthlyFee.toLocaleString()}` : '$500.000';
  } else if (ph.includes('TOTAL_DELIVERY_TIME')) {
    return extractedInfo?.timeline || '4-6 semanas';
  } else if (ph.includes('SAVINGS_BENEFIT_1')) {
    return 'Optimización de procesos y reducción de tiempos';
  } else if (ph.includes('SAVINGS_BENEFIT_2')) {
    return 'Mejora en la eficiencia operativa';
  } else if (ph.includes('SAVINGS_BENEFIT_3')) {
    return 'Automatización de tareas repetitivas';
  } else if (ph.includes('MONTHLY_SAVINGS_AMOUNT')) {
    return '$2.000.000';
  } else if (ph.includes('MONTHLY_SAVINGS_DESCRIPTION')) {
    return 'Ahorro mensual estimado por optimización de procesos';
  } else if (ph.includes('ROI_TIME')) {
    return '8-12 meses';
  } else if (ph.includes('ROI_DESCRIPTION')) {
    return 'Tiempo estimado para recuperar la inversión';
  } else if (ph.includes('IMPLEMENTATION_FEATURE_1')) {
    return 'Configuración completa del sistema';
  } else if (ph.includes('IMPLEMENTATION_FEATURE_2')) {
    return 'Capacitación del equipo';
  } else if (ph.includes('IMPLEMENTATION_FEATURE_3')) {
    return 'Documentación técnica completa';
  } else if (ph.includes('IMPLEMENTATION_FEATURE_4')) {
    return 'Soporte técnico post-implementación';
  } else if (ph.includes('PAYMENT_PLAN_1')) {
    return '50% al iniciar el proyecto';
  } else if (ph.includes('PAYMENT_PLAN_2')) {
    return '30% en la entrega del primer entregable';
  } else if (ph.includes('PAYMENT_PLAN_3')) {
    return '20% al finalizar el proyecto';
  } else if (ph.includes('SOLUTION_DESCRIPTION')) {
    return extractedInfo?.projectSummary || 
      `Solución personalizada que aborda las necesidades específicas de ${clientData.clientCompany || clientData.clientName} para optimizar sus procesos y mejorar su eficiencia operativa.`;
  } else if (ph.includes('SOLUTION_BENEFIT_SUMMARY')) {
    return `Con esta solución, ${clientData.clientCompany || clientData.clientName} obtendrá una herramienta robusta y escalable que mejorará significativamente su productividad y competitividad en el mercado.`;
  } else if (ph.includes('PRICE') || ph.includes('COST') || ph.includes('TOTAL')) {
    return '$15.000.000';
  } else if (ph.includes('TIME') || ph.includes('WEEK') || ph.includes('MONTH')) {
    return '4-6 semanas';
  } else if (ph.includes('DESCRIPTION')) {
    return `Componente especializado del proyecto ${clientData.projectName} para ${clientData.clientCompany || clientData.clientName}`;
  } else {
    return `Contenido personalizado para ${clientData.clientCompany || clientData.clientName} - ${placeholder}`;
  }
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

async generateQuotationFallback(
  fullTemplate: string,
  clientData: any
): Promise<string> {
  console.log('🔄 Usando método de fallback con reemplazos básicos...');
  
  const extractedInfo = await this.extractProjectInformation(clientData.projectDescription);
  const defaultValues = this.getUniversalBaseValues(clientData, extractedInfo);
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
      const genericValue = this.generateGenericValue(placeholderName, clientData, extractedInfo);
      result = result.replace(new RegExp(`\\{\\{${placeholderName}\\}\\}`, 'g'), genericValue);
    }
  }
  
  console.log(`✅ Fallback completado: ${placeholders.length} placeholders procesados`);
  return result;
}

async generateProjectSummary(generatedHtml: string, clientData: any): Promise<string> {
  console.log('🤖 Generando resumen del proyecto con AI...');
  
  const prompt = `
Analiza la siguiente cotización HTML generada y crea un resumen ejecutivo del proyecto.

DATOS DEL CLIENTE:
- Empresa: ${clientData.clientCompany || clientData.clientName}
- Proyecto: ${clientData.projectName}

COTIZACIÓN HTML:
${generatedHtml}

INSTRUCCIONES:
1. Lee TODO el contenido de la cotización HTML
2. Identifica los servicios principales que se están ofreciendo
3. Extrae el alcance del proyecto
4. Identifica los beneficios clave mencionados
5. Crea un resumen ejecutivo de 2-3 líneas que describa QUÉ se va a entregar

FORMATO DE RESPUESTA:
Responde únicamente con el resumen ejecutivo en texto plano, sin formateo HTML, sin comillas, máximo 300 caracteres.

El resumen debe ser profesional y describir específicamente lo que se va a desarrollar/entregar.

Ejemplo: "Desarrollo de plataforma web de gestión de inventarios con dashboard en tiempo real, sistema de alertas automáticas y módulo de reportes avanzados para optimizar la operación logística."
`;

  try {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    
    // Limpiar el resumen de cualquier formateo adicional
    const cleanSummary = summary
      .replace(/"/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Limitar a 300 caracteres
    const finalSummary = cleanSummary.length > 300 
      ? cleanSummary.substring(0, 297) + '...'
      : cleanSummary;

    console.log(`✅ Resumen generado: "${finalSummary}"`);
    return finalSummary;

  } catch (error) {
    console.error('❌ Error generando resumen:', error);
    // Fallback simple
    return `Proyecto de desarrollo personalizado para ${clientData.clientCompany || clientData.clientName}`;
  }
}
}