import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './lib/config.js';
import { pool } from './lib/db.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import authRoutes from './routes/auth.js';
import availabilityRoutes from './routes/availability.js';
import checklistsRoutes from './routes/checklists.js';
import clientsRoutes from './routes/clients.js';
import devicesRoutes from './routes/devices.js';
import earningsRoutes from './routes/earnings.js';
import invoicesRoutes from './routes/invoices.js';
import jobsRoutes from './routes/jobs.js';
import messagesRoutes from './routes/messages.js';
import paymentsRoutes from './routes/payments.js';
import propertiesRoutes from './routes/properties.js';
import publicApiRoutes from './routes/publicApi.js';
import recurrenceRoutes from './routes/recurrence.js';
import sosRoutes from './routes/sos.js';
import taxRoutes from './routes/tax.js';
import timeEntriesRoutes from './routes/timeEntries.js';
import uploadsRoutes from './routes/uploads.js';
import { openApiDocument } from './openapi.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: '@cleanops/api' }));
app.get('/openapi.json', (_req, res) => res.json(openApiDocument));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/recurrence', recurrenceRoutes);
app.use('/api/time-entries', timeEntriesRoutes);
app.use('/api/checklists', checklistsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/tax', taxRoutes);
app.use('/v1', publicApiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`CleanOps API listening on port ${config.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
