// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { QuotationController } from './controllers/quotationController';
import { TemplateController } from './controllers/templateController';
import { WorkflowController } from './controllers/workflowController';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:8080',
    process.env.FRONTEND_URL || 'http://localhost:8080'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Instanciar controladores
const quotationController = new QuotationController();
const templateController = new TemplateController();
const workflowController = new WorkflowController();

// Rutas públicas (para desarrollo)
app.get('/api/health', (req, res) => {
  templateController.healthCheck(req, res);
});

// Rutas de templates
app.get('/api/templates', (req, res) => {
  templateController.listTemplates(req, res);
});

app.get('/api/templates/:id', (req, res) => {
  templateController.getTemplate(req, res);
});

app.post('/api/templates/request', (req, res) => {
  templateController.createTemplateRequest(req, res);
});

// Rutas de cotizaciones
app.get('/api/quotations', (req, res) => {
  quotationController.listQuotations(req, res);
});

app.get('/api/quotations/:id', (req, res) => {
  quotationController.getQuotation(req, res);
});

app.post('/api/quotations/generate', (req, res) => {
  // ClerkExpressRequireAuth(), // Comentado por ahora
  quotationController.generateQuotation(req, res);
});

// Ruta de prueba para cotizaciones
app.post('/api/test/quotations/generate', (req, res) => {
  quotationController.generateQuotation(req, res);
});

app.delete('/api/quotations/:id', (req, res) => {
  quotationController.deleteQuotation(req, res);
});

app.put('/api/templates/:id', (req, res) => {
  templateController.updateTemplate(req, res);
});

app.delete('/api/templates/:id', (req, res) => {
  templateController.deleteTemplate(req, res);
});

// Rutas de workflows (agregar después de las rutas existentes)
app.get('/api/workflows', (req, res) => {
  workflowController.listWorkflows(req, res);
});

app.get('/api/workflows/:id', (req, res) => {
  workflowController.getWorkflow(req, res);
});

app.post('/api/workflows', (req, res) => {
  workflowController.createWorkflow(req, res);
});

app.put('/api/workflows/:id', (req, res) => {
  workflowController.updateWorkflow(req, res);
});

app.delete('/api/workflows/:id', (req, res) => {
  workflowController.deleteWorkflow(req, res);
});

export default app;