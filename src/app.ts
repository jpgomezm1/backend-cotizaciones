// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ClerkExpressRequireAuth } from '@clerk/express';
import { QuotationController } from './controllers/quotationController';
import { TestController } from './controllers/testController';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Instanciar controladores
const quotationController = new QuotationController();
const testController = new TestController();

// Rutas de prueba (sin autenticación)
app.get('/api/health', testController.healthCheck.bind(testController));
app.get('/api/test/templates', testController.listTemplates.bind(testController));

// Rutas protegidas con Clerk
app.post('/api/quotations/generate', 
  ClerkExpressRequireAuth(),
  quotationController.generateQuotation.bind(quotationController)
);

// Ruta de prueba sin autenticación (solo para desarrollo)
app.post('/api/test/quotations/generate', 
  quotationController.generateQuotation.bind(quotationController)
);

export default app;