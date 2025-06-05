// src/controllers/testController.ts
import { Request, Response } from 'express';
import { db } from '../db/connection';
import { templates } from '../db/schema';

export class TestController {
  async listTemplates(req: Request, res: Response) {
    try {
      const allTemplates = await db.select({
        id: templates.id,
        name: templates.name,
        organizationId: templates.organizationId,
        createdAt: templates.createdAt
      }).from(templates);

      res.json({
        success: true,
        templates: allTemplates
      });
    } catch (error) {
      console.error('Error listing templates:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  async healthCheck(req: Request, res: Response) {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Backend de cotizaciones funcionando correctamente'
    });
  }
}