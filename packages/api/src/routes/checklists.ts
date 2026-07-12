import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { buildPatch, db, getBusinessId, idParamSchema, paginationSchema } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const itemSchema = z.object({ label: z.string().min(1), required: z.boolean().default(false), sort_order: z.number().int().default(0) });
const templateSchema = z.object({ name: z.string().min(1), description: z.string().optional(), items: z.array(itemSchema).default([]) });
const templatePatchSchema = templateSchema.omit({ items: true }).partial();
const jobChecklistParamSchema = z.object({ jobId: z.string().uuid() });
const resultSchema = z.object({
  job_id: z.string().uuid(),
  checklist_item_id: z.string().uuid(),
  completed: z.boolean(),
  notes: z.string().optional(),
  photo_url: z.string().url().optional(),
  client_generated_id: z.string().min(1).optional()
});

router.get('/jobs/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = jobChecklistParamSchema.parse(req.params);
  const businessId = getBusinessId(req);
  const items = await query(
    `SELECT ci.*
       FROM jobs j
       JOIN recurrence_rules rr ON rr.id = j.recurrence_rule_id
       JOIN checklist_items ci ON ci.template_id = rr.checklist_template_id
      WHERE j.id = $1 AND j.business_id = $2
      ORDER BY ci.sort_order ASC, ci.label ASC`,
    [jobId, businessId],
    db(req)
  );
  const results = await query(
    `SELECT *
       FROM job_checklist_results
      WHERE business_id = $1 AND job_id = $2
      ORDER BY completed_at DESC NULLS LAST`,
    [businessId, jobId],
    db(req)
  );
  res.json({ data: { items: items.rows, results: results.rows } });
}));

router.get('/templates', asyncHandler(async (req, res) => {
  const page = paginationSchema.parse(req.query);
  const result = await query('SELECT * FROM checklist_templates WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [getBusinessId(req), page.limit, page.offset], db(req));
  res.json({ data: result.rows, ...page });
}));

router.post('/templates', asyncHandler(async (req, res) => {
  const body = templateSchema.parse(req.body);
  const businessId = getBusinessId(req);
  const template = await query('INSERT INTO checklist_templates (business_id, name, description) VALUES ($1,$2,$3) RETURNING *', [businessId, body.name, body.description ?? null], db(req));
  for (const item of body.items) {
    await query('INSERT INTO checklist_items (business_id, template_id, label, required, sort_order) VALUES ($1,$2,$3,$4,$5)', [businessId, template.rows[0].id, item.label, item.required, item.sort_order], db(req));
  }
  res.status(201).json({ data: template.rows[0] });
}));

router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = templatePatchSchema.parse(req.body);
  const patch = buildPatch(body, ['name', 'description']);
  const result = await query(`UPDATE checklist_templates SET ${patch.fields.join(', ')}, updated_at = now() WHERE id = $${patch.values.length + 1} AND business_id = $${patch.values.length + 2} RETURNING *`, [...patch.values, id, getBusinessId(req)], db(req));
  if (!result.rows[0]) throw new AppError(404, 'Checklist template not found', 'CHECKLIST_TEMPLATE_NOT_FOUND');
  res.json({ data: result.rows[0] });
}));

router.post('/templates/:id/items', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = itemSchema.parse(req.body);
  const result = await query('INSERT INTO checklist_items (business_id, template_id, label, required, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *', [getBusinessId(req), id, body.label, body.required, body.sort_order], db(req));
  res.status(201).json({ data: result.rows[0] });
}));

router.post('/results', asyncHandler(async (req, res) => {
  const body = resultSchema.parse(req.body);
  const businessId = getBusinessId(req);
  if (body.client_generated_id) {
    const existing = await query('SELECT * FROM job_checklist_results WHERE business_id = $1 AND client_generated_id = $2', [businessId, body.client_generated_id], db(req));
    if (existing.rows[0]) return res.json({ data: existing.rows[0], idempotent: true });
  }
  const result = await query(
    `INSERT INTO job_checklist_results (business_id, job_id, checklist_item_id, completed, notes, photo_url, client_generated_id, submitted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [businessId, body.job_id, body.checklist_item_id, body.completed, body.notes ?? null, body.photo_url ?? null, body.client_generated_id ?? null, req.user!.id],
    db(req)
  );
  res.status(201).json({ data: result.rows[0] });
}));

export default router;
