// src/db/schema.ts
import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  clerkOrgId: text('clerk_org_id').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const templates = pgTable('templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  name: text('name').notNull(),
  htmlContent: text('html_content').notNull(),
  // Removemos description y updatedAt por ahora ya que no existen en la BD
  createdAt: timestamp('created_at').defaultNow().notNull()
  // updatedAt: timestamp('updated_at').defaultNow().notNull() // Comentado por ahora
});

export const quotations = pgTable('quotations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  templateId: uuid('template_id').references(() => templates.id).notNull(),
  clientName: text('client_name').notNull(),
  clientCompany: text('client_company'),
  clientEmail: text('client_email').notNull(),
  clientPhone: text('client_phone'),
  clientRutNit: text('client_rut_nit'),
  projectName: text('project_name').notNull(),
  projectDescription: text('project_description').notNull(),
  generatedHtml: text('generated_html'),
  status: text('status').default('draft').notNull(), // draft, generated, sent
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  templates: many(templates),
  quotations: many(quotations)
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [templates.organizationId],
    references: [organizations.id]
  }),
  quotations: many(quotations)
}));

export const quotationsRelations = relations(quotations, ({ one }) => ({
  organization: one(organizations, {
    fields: [quotations.organizationId],
    references: [organizations.id]
  }),
  template: one(templates, {
    fields: [quotations.templateId],
    references: [templates.id]
  })
}));