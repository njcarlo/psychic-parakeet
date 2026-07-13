import { query } from '../lib/db.js';
import type { DbExecutor } from '../lib/db.js';
import { AppError } from '../lib/errors.js';

export type CommChannel = 'sms' | 'email';

export interface MessageInput {
  businessId: string;
  clientId: string;
  template: string;
  variables?: Record<string, string | number>;
  preferredChannel?: CommChannel;
  executor?: DbExecutor;
}

export function renderTemplate(template: string, variables: Record<string, string | number> = {}): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => String(variables[key] ?? ''));
}

async function sendSms(to: string, body: string): Promise<{ providerMessageId: string }> {
  return { providerMessageId: `sms_stub_${Buffer.from(`${to}:${body}`).toString('base64url').slice(0, 16)}` };
}

async function sendEmail(to: string, body: string): Promise<{ providerMessageId: string }> {
  return { providerMessageId: `email_stub_${Buffer.from(`${to}:${body}`).toString('base64url').slice(0, 16)}` };
}

export async function sendTemplatedMessage(input: MessageInput) {
  const clientResult = await query<{ id: string; email: string | null; phone: string | null; comm_preference: string }>(
    'SELECT id, email, phone, comm_preference FROM clients WHERE id = $1 AND business_id = $2',
    [input.clientId, input.businessId],
    input.executor
  );
  const client = clientResult.rows[0];
  if (!client) throw new AppError(404, 'Client not found', 'CLIENT_NOT_FOUND');
  if (client.comm_preference === 'none') throw new AppError(400, 'Client has opted out of messages', 'CLIENT_OPTED_OUT');

  const channel = input.preferredChannel ?? (client.comm_preference === 'sms' ? 'sms' : 'email');
  const body = renderTemplate(input.template, input.variables);
  const destination = channel === 'sms' ? client.phone : client.email;
  if (!destination) throw new AppError(400, `Client has no ${channel} destination`, 'MISSING_MESSAGE_DESTINATION');

  const providerResult = channel === 'sms' ? await sendSms(destination, body) : await sendEmail(destination, body);
  const log = await query(
    `INSERT INTO message_log (business_id, client_id, channel, destination, body, provider_message_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,'sent') RETURNING *`,
    [input.businessId, input.clientId, channel, destination, body, providerResult.providerMessageId],
    input.executor
  );
  return log.rows[0];
}
