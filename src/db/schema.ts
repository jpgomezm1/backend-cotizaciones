// src/db/schema.ts
import { pgTable, text, timestamp, uuid, jsonb, boolean, integer } from 'drizzle-orm/pg-core';
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
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
  aiGeneratedSummary: text('ai_generated_summary'),
  generatedHtml: text('generated_html'),
  status: text('status').default('draft').notNull(),
  viewedAt: timestamp('viewed_at'),
  respondedAt: timestamp('responded_at'),
  approvedAt: timestamp('approved_at'),
  rejectedAt: timestamp('rejected_at'),
  lastActivityAt: timestamp('last_activity_at').defaultNow(),
  workflowsEnabled: boolean('workflows_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id).notNull(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  tipo: text('tipo').notNull(),
  activo: boolean('activo').default(true).notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const workflowExecutions = pgTable('workflow_executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id').references(() => workflows.id).notNull(),
  quotationId: uuid('quotation_id').references(() => quotations.id).notNull(),
  triggerType: text('trigger_type').notNull(),
  triggerData: jsonb('trigger_data'),
  status: text('status').default('pending').notNull(),
  executedAt: timestamp('executed_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const workflowActions = pgTable('workflow_actions', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionId: uuid('execution_id').references(() => workflowExecutions.id).notNull(),
  actionType: text('action_type').notNull(),
  actionData: jsonb('action_data').notNull(),
  status: text('status').default('pending').notNull(),
  executedAt: timestamp('executed_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  templates: many(templates),
  quotations: many(quotations),
  workflows: many(workflows)
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [templates.organizationId],
    references: [organizations.id]
  }),
  quotations: many(quotations)
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [quotations.organizationId],
    references: [organizations.id]
  }),
  template: one(templates, {
    fields: [quotations.templateId],
    references: [templates.id]
  }),
  workflowExecutions: many(workflowExecutions)
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflows.organizationId],
    references: [organizations.id]
  }),
  executions: many(workflowExecutions)
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id]
  }),
  quotation: one(quotations, {
    fields: [workflowExecutions.quotationId],
    references: [quotations.id]
  }),
  actions: many(workflowActions)
}));

export const workflowActionsRelations = relations(workflowActions, ({ one }) => ({
  execution: one(workflowExecutions, {
    fields: [workflowActions.executionId],
    references: [workflowExecutions.id]
  })
}));