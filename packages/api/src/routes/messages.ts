import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { sendTemplatedMessage } from '../services/comms.js';
import { db, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const messageSchema = z.object({
  client_id: z.string().uuid(),
  template: z.string().min(1),
  variables: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  preferred_channel: z.enum(['sms', 'email']).optional()
});

router.post('/', asyncHandler(async (req, res) => {
  const body = messageSchema.parse(req.body);
  const result = await sendTemplatedMessage({
    businessId: getBusinessId(req),
    clientId: body.client_id,
    template: body.template,
    variables: body.variables,
    preferredChannel: body.preferred_channel,
    executor: db(req)
  });
  res.status(201).json({ data: result });
}));

export default router;
