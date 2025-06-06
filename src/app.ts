// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { QuotationController } from './controllers/quotationController';
import { TemplateController } from './controllers/templateController';

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

export default app;