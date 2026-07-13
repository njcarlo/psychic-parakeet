import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { AppError, asyncHandler } from '../lib/errors.js';
import { getStorageBucket, isFirebaseEnabled } from '../lib/firebase.js';
import { authenticateJwt, tenancy } from '../middleware/auth.js';
import { db, ensureOwned, getBusinessId } from './helpers.js';

const router = Router();
router.use(authenticateJwt, tenancy);

const checklistPhotoSchema = z.object({
  job_id: z.string().uuid(),
  content_type: z.string().trim().regex(/^image\/[a-z0-9.+-]+$/i, 'content_type must be an image MIME type')
});

router.post('/checklist-photo', asyncHandler(async (req, res) => {
  const body = checklistPhotoSchema.parse(req.body);
  const businessId = getBusinessId(req);

  if (!isFirebaseEnabled()) {
    throw new AppError(503, 'Firebase Storage is not configured', 'FIREBASE_STORAGE_UNAVAILABLE');
  }

  await ensureOwned('jobs', body.job_id, businessId, db(req));

  const path = `businesses/${businessId}/jobs/${body.job_id}/checklist/${randomUUID()}.jpg`;
  let bucket;
  try {
    bucket = getStorageBucket();
  } catch {
    throw new AppError(503, 'Firebase Storage is not configured', 'FIREBASE_STORAGE_UNAVAILABLE');
  }

  const file = bucket.file(path);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: body.content_type
  });

  res.status(201).json({
    uploadUrl,
    publicUrl: file.publicUrl(),
    path
  });
}));

export default router;
