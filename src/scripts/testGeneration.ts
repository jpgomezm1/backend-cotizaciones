// src/scripts/testGeneration.ts
import dotenv from 'dotenv';
import { db } from '../db/connection';
import { quotations, templates } from '../db/schema';
import { RAGService } from '../services/ragService';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function validateHtmlStructure(html: string): Promise<{
 isValid: boolean;
 issues: string[];
 stats: {
   hasDoctype: boolean;
   hasHtml: boolean;
   hasHead: boolean;
   hasBody: boolean;
   hasStyles: boolean;
   hasCSSRules: number;
   totalLength: number;
 };
}> {
 const issues: string[] = [];
 
 const stats = {
   hasDoctype: html.includes('<!DOCTYPE html>'),
   hasHtml: html.includes('<html') && html.includes('</html>'),
   hasHead: html.includes('<head>') && html.includes('</head>'),
   hasBody: html.includes('<body') && html.includes('</body>'),
   hasStyles: html.includes('<style>') && html.includes('</style>'),
   hasCSSRules: (html.match(/\{[\s\S]*?\}/g) || []).length,
   totalLength: html.length
 };

 if (!stats.hasDoctype) issues.push('Falta DOCTYPE');
 if (!stats.hasHtml) issues.push('Etiquetas HTML incompletas');
 if (!stats.hasHead) issues.push('Sección HEAD faltante o incompleta');
 if (!stats.hasBody) issues.push('Sección BODY faltante o incompleta');
 if (!stats.hasStyles) issues.push('Estilos CSS faltantes');
 if (stats.hasCSSRules < 10) issues.push('CSS insuficiente o perdido');

 return {
   isValid: issues.length === 0,
   issues,
   stats
 };
}

async function testQuotationGeneration() {
 try {
   console.log('🧪 Iniciando prueba con estrategia mejorada...');

   // Obtener el template más reciente
   const template = await db.query.templates.findFirst({
     orderBy: (templates, { desc }) => [desc(templates.createdAt)]
   });

   if (!template) {
     throw new Error('No se encontró ningún template. Ejecuta primero: npm run test:setup');
   }

   console.log('📄 Template encontrado:', template.name);
   console.log('📏 Tamaño del template:', template.htmlContent.length, 'caracteres');

   // AÑADIR DIAGNÓSTICO
   console.log('🔍 DIAGNÓSTICO DEL TEMPLATE:');
   console.log('   📅 Creado:', template.createdAt);
   console.log('   🆔 ID:', template.id);

   // Buscar placeholders manualmente
   const placeholderMatches = template.htmlContent.match(/\{\{[^}]+\}\}/g);
   console.log('   🏷️  Placeholders encontrados:', placeholderMatches?.length || 0);
   if (placeholderMatches && placeholderMatches.length > 0) {
     const uniquePlaceholders = [...new Set(placeholderMatches.map(p => p.replace(/[{}]/g, '')))];
     console.log('   📝 Primeros 10 placeholders:', uniquePlaceholders.slice(0, 10));
   }

   // Mostrar templates disponibles
   const allTemplates = await db.query.templates.findMany({
     orderBy: (templates, { desc }) => [desc(templates.createdAt)],
     limit: 3
   });

   console.log('📋 Templates disponibles (últimos 3):');
   allTemplates.forEach((t, i) => {
     const placeholders = (t.htmlContent.match(/\{\{[^}]+\}\}/g) || []).length;
     console.log(`   ${i + 1}. ${t.name.substring(0, 50)}... (${t.htmlContent.length} chars, ${placeholders} placeholders)`);
   });

   // Validar que el template tiene placeholders
   if (!placeholderMatches || placeholderMatches.length === 0) {
     console.log('❌ ERROR: El template seleccionado no tiene placeholders válidos');
     console.log('💡 Parece que se seleccionó un template antiguo sin placeholders');
     console.log('🔧 Solución: Asegurar que test:setup creó el template correctamente');
     throw new Error('Template sin placeholders - no se puede personalizar');
   }

   console.log('✅ Template válido con', placeholderMatches.length, 'placeholders encontrado');

   // Validar template original
   const templateValidation = await validateHtmlStructure(template.htmlContent);
   console.log('🔍 Validación del template original:');
   console.log('   ✅ Válido:', templateValidation.isValid ? 'SÍ' : 'NO');
   console.log('   📊 CSS Rules:', templateValidation.stats.hasCSSRules);
   if (templateValidation.issues.length > 0) {
     console.log('   ⚠️ Issues:', templateValidation.issues.join(', '));
   }

   // Datos de prueba más específicos
   const clientData = {
     clientName: 'Roberto Silva',
     clientCompany: 'Digital Dynamics',
     clientEmail: 'roberto@digitaldynamics.com',
     clientPhone: '+57 314 567 8901',
     clientRutNit: '900234567-1',
     projectName: 'Plataforma de Análisis de Datos con Machine Learning',
     projectDescription: 'Desarrollo de una plataforma integral de análisis de datos que utilice algoritmos de machine learning para procesar grandes volúmenes de información, generar insights predictivos, crear dashboards interactivos en tiempo real, automatizar reportes ejecutivos y proporcionar recomendaciones inteligentes para la toma de decisiones empresariales. La plataforma debe manejar múltiples fuentes de datos, tener capacidades de ETL automatizado y escalabilidad para procesar petabytes de información.'
   };

   console.log('👤 Cliente de prueba:', clientData.clientName, '-', clientData.clientCompany);
   console.log('🎯 Proyecto:', clientData.projectName.substring(0, 50) + '...');

   // Inicializar RAG Service
   const ragService = new RAGService();

   // Procesar template
   console.log('📊 Preparando template...');
   const processedTemplate = await ragService.processTemplate(template.htmlContent);

   // Generar cotización con estrategia mejorada
   console.log('🤖 Generando cotización con estrategia mejorada...');
   console.log('⏱️  Esto tomará algunos minutos...');
   const startTime = Date.now();
   
   let generatedHtml: string;
   
   try {
     generatedHtml = await ragService.generateQuotation(processedTemplate, clientData);
   } catch (error) {
     console.warn('⚠️  Método principal falló, probando método de respaldo...');
     generatedHtml = await ragService.generateQuotationFallback(processedTemplate, clientData);
   }
   
   const endTime = Date.now();
   console.log(`✅ Cotización generada en ${(endTime - startTime) / 1000}s`);

   // Validación completa del HTML generado
   console.log('\n🔍 VALIDACIÓN COMPLETA DEL HTML GENERADO:');
   const validation = await validateHtmlStructure(generatedHtml);
   
   console.log('📊 Estadísticas del HTML:');
   console.log('   📏 Tamaño:', validation.stats.totalLength, 'caracteres');
   console.log('   📐 Ratio vs original:', (validation.stats.totalLength / template.htmlContent.length * 100).toFixed(1) + '%');
   console.log('   🏗️  DOCTYPE:', validation.stats.hasDoctype ? '✅' : '❌');
   console.log('   🌐 HTML tags:', validation.stats.hasHtml ? '✅' : '❌');
   console.log('   🧠 HEAD section:', validation.stats.hasHead ? '✅' : '❌');
   console.log('   🎨 CSS styles:', validation.stats.hasStyles ? '✅' : '❌');
   console.log('   📱 BODY content:', validation.stats.hasBody ? '✅' : '❌');
   console.log('   🎨 CSS rules:', validation.stats.hasCSSRules);

   // Verificación de personalización - criterios más realistas basados en placeholders reales
   const hasCompanyName = generatedHtml.toLowerCase().includes(clientData.clientCompany!.toLowerCase());
   const hasProjectName = generatedHtml.toLowerCase().includes(clientData.projectName.toLowerCase().substring(0, 20));
   const hasRutNit = generatedHtml.includes(clientData.clientRutNit!);
   const hasProposalDate = generatedHtml.includes('junio de 2025') || generatedHtml.includes('2025');

   console.log('\n🔍 VERIFICACIÓN DE PERSONALIZACIÓN:');
   console.log('   🏢 Nombre de la empresa:', hasCompanyName ? '✅' : '❌');
   console.log('   🎯 Nombre del proyecto:', hasProjectName ? '✅' : '❌');
   console.log('   🏛️ RUT/NIT del cliente:', hasRutNit ? '✅' : '❌');
   console.log('   📅 Fecha de propuesta:', hasProposalDate ? '✅' : '❌');

   const successRate = [hasCompanyName, hasProjectName, hasRutNit, hasProposalDate].filter(Boolean).length;
   console.log(`   📈 Tasa de personalización: ${successRate}/4 (${(successRate/4*100).toFixed(0)}%)`);

   // Verificación adicional de contenido generado
   const hasMLContent = generatedHtml.toLowerCase().includes('machine learning') || 
                       generatedHtml.toLowerCase().includes('algoritmos') || 
                       generatedHtml.toLowerCase().includes('análisis de datos');
   const hasPricingContent = generatedHtml.includes('$') && generatedHtml.includes('COP');
   const hasTimelineContent = generatedHtml.includes('semanas') || generatedHtml.includes('meses');

   console.log('\n🔍 VERIFICACIÓN DE CONTENIDO ESPECÍFICO:');
   console.log('   🤖 Contenido de ML/Datos:', hasMLContent ? '✅' : '❌');
   console.log('   💰 Información de precios:', hasPricingContent ? '✅' : '❌');
   console.log('   ⏰ Cronograma definido:', hasTimelineContent ? '✅' : '❌');

   const contentRate = [hasMLContent, hasPricingContent, hasTimelineContent].filter(Boolean).length;
   console.log(`   📊 Calidad del contenido: ${contentRate}/3 (${(contentRate/3*100).toFixed(0)}%)`);

   // Validación final con criterios más realistas
   console.log('\n🎯 RESULTADO FINAL:');
   console.log('   ✅ HTML válido:', validation.isValid ? '✅ SÍ' : '❌ NO');
   console.log('   🎨 Estilos preservados:', validation.stats.hasCSSRules > 20 ? '✅ SÍ' : '❌ NO');
   console.log('   👤 Personalización exitosa:', successRate >= 3 ? '✅ SÍ' : '❌ NO');
   console.log('   📋 Contenido especializado:', contentRate >= 2 ? '✅ SÍ' : '❌ NO');
   
   if (validation.issues.length > 0) {
     console.log('   ⚠️  Issues encontrados:', validation.issues.join(', '));
   }

   // Criterios de éxito más realistas
   const overallSuccess = validation.isValid && 
                         validation.stats.hasCSSRules > 20 && 
                         successRate >= 3 && 
                         contentRate >= 2;
   
   console.log('   🏆 Generación exitosa:', overallSuccess ? '✅ SÍ' : '❌ NO');

   // Verificación de placeholders restantes
   const remainingPlaceholders = generatedHtml.match(/\{\{[^}]+\}\}/g);
   if (remainingPlaceholders) {
     console.log(`   ⚠️ Placeholders sin reemplazar: ${remainingPlaceholders.length}`);
     console.log('   📝 Primeros placeholders sin reemplazar:', remainingPlaceholders.slice(0, 3));
   } else {
     console.log('   ✅ Todos los placeholders fueron reemplazados correctamente');
   }

   if (!overallSuccess) {
     console.log('\n❌ FALLO EN LA GENERACIÓN - Revise los issues reportados');
     
     // Mostrar más detalles para debugging
     if (successRate < 3) {
       console.log('💡 Sugerencia: Verificar que los placeholders están siendo reemplazados correctamente');
     }
     if (contentRate < 2) {
       console.log('💡 Sugerencia: Revisar que el contenido específico se está generando apropiadamente');
     }
   }

   // Guardar en base de datos solo si es exitosa
   if (overallSuccess) {
     console.log('\n💾 Guardando en base de datos...');
     const [quotation] = await db.insert(quotations).values({
       organizationId: template.organizationId,
       templateId: template.id,
       clientName: clientData.clientName,
       clientCompany: clientData.clientCompany,
       clientEmail: clientData.clientEmail,
       clientPhone: clientData.clientPhone,
       clientRutNit: clientData.clientRutNit,
       projectName: clientData.projectName,
       projectDescription: clientData.projectDescription,
       generatedHtml: generatedHtml,
       status: 'generated'
     }).returning();

     // Guardar archivo con timestamp
     const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
     const outputPath = path.join(__dirname, `../../generated-quotation-${timestamp}.html`);
     fs.writeFileSync(outputPath, generatedHtml);
     console.log('📄 HTML generado guardado en:', outputPath);

     return quotation;
   } else {
     // Guardar archivo para debugging aunque falle
     const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
     const outputPath = path.join(__dirname, `../../failed-quotation-${timestamp}.html`);
     fs.writeFileSync(outputPath, generatedHtml);
     console.log('🐛 HTML fallido guardado para debug en:', outputPath);
     
     throw new Error('La generación de la cotización no cumplió con los estándares de calidad');
   }

 } catch (error) {
   console.error('❌ Error en generación:', error);
   throw error;
 }
}

testQuotationGeneration()
 .then((quotation) => {
   console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE');
   console.log('📋 Resumen:');
   console.log('  - ID:', quotation.id);
   console.log('  - Cliente:', quotation.clientName);
   console.log('  - Empresa:', quotation.clientCompany);
   console.log('  - Proyecto:', quotation.projectName.substring(0, 50) + '...');
   console.log('\n💡 El archivo HTML está listo para usar');
   console.log('🌐 Puedes abrir el archivo HTML en tu navegador para ver el resultado');
   console.log('📧 La cotización está lista para enviar al cliente');
   process.exit(0);
 })
 .catch((error) => {
   console.error('💥 ERROR EN LA PRUEBA:', error.message);
   console.log('\n🔧 Recomendaciones:');
   console.log('  1. Verificar el template original');
   console.log('  2. Revisar el archivo de debug generado');
   console.log('  3. Ajustar los prompts si es necesario');
   console.log('  4. Verificar que todos los placeholders están definidos en el template');
   process.exit(1);
 });