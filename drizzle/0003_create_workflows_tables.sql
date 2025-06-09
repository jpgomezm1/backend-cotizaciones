-- drizzle/0003_create_workflows_tables.sql
CREATE TABLE "workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "nombre" text NOT NULL,
  "descripcion" text,
  "tipo" text NOT NULL,
  "activo" boolean DEFAULT true NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "workflow_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id"),
  "quotation_id" uuid NOT NULL REFERENCES "quotations"("id"),
  "trigger_type" text NOT NULL,
  "trigger_data" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "executed_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "workflow_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "execution_id" uuid NOT NULL REFERENCES "workflow_executions"("id"),
  "action_type" text NOT NULL,
  "action_data" jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "executed_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Agregar campos a quotations para tracking
ALTER TABLE "quotations" ADD COLUMN "viewed_at" timestamp;
ALTER TABLE "quotations" ADD COLUMN "responded_at" timestamp;
ALTER TABLE "quotations" ADD COLUMN "approved_at" timestamp;
ALTER TABLE "quotations" ADD COLUMN "rejected_at" timestamp;
ALTER TABLE "quotations" ADD COLUMN "last_activity_at" timestamp DEFAULT now();
ALTER TABLE "quotations" ADD COLUMN "workflows_enabled" boolean DEFAULT true NOT NULL;

-- Índices para performance
CREATE INDEX "workflows_organization_id_idx" ON "workflows"("organization_id");
CREATE INDEX "workflows_tipo_idx" ON "workflows"("tipo");
CREATE INDEX "workflows_activo_idx" ON "workflows"("activo");
CREATE INDEX "workflow_executions_workflow_id_idx" ON "workflow_executions"("workflow_id");
CREATE INDEX "workflow_executions_quotation_id_idx" ON "workflow_executions"("quotation_id");
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");
CREATE INDEX "workflow_actions_execution_id_idx" ON "workflow_actions"("execution_id");
CREATE INDEX "quotations_last_activity_at_idx" ON "quotations"("last_activity_at");