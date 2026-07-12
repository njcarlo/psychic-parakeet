import crypto from 'node:crypto';
import { query, withBusinessContext } from '../lib/db.js';
import { config } from '../lib/config.js';

export type PaymentProvider = 'stripe' | 'windcave' | 'paymongo' | 'manual_bank' | 'poli';

export interface NormalizedPaymentEvent {
  provider: PaymentProvider;
  provider_payment_id: string | null;
  invoiceId?: string;
  amountCents: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  raw: unknown;
}

export interface PaymentProviderAdapter {
  provider: PaymentProvider;
  verifySignature(payload: Buffer | string, signatureHeader?: string): boolean;
  normalize(payload: unknown): NormalizedPaymentEvent;
}

function verifyHmac(payload: Buffer | string, signatureHeader: string | undefined, secret: string | undefined): boolean {
  if (!secret || !signatureHeader) return false;
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
}

export const stripeAdapter: PaymentProviderAdapter = {
  provider: 'stripe',
  verifySignature: (payload, signatureHeader) => verifyHmac(payload, signatureHeader, config.STRIPE_WEBHOOK_SECRET),
  normalize: (payload) => {
    const event = payload as Record<string, any>;
    const object = event.data?.object ?? {};
    return {
      provider: 'stripe',
      provider_payment_id: String(object.id ?? event.id),
      invoiceId: object.metadata?.invoice_id,
      amountCents: Number(object.amount_received ?? object.amount ?? 0),
      currency: String(object.currency ?? 'nzd').toUpperCase(),
      status: object.status === 'succeeded' || object.paid === true ? 'succeeded' : 'pending',
      paidAt: object.created ? new Date(Number(object.created) * 1000) : undefined,
      raw: payload
    };
  }
};

export const windcaveAdapter: PaymentProviderAdapter = {
  provider: 'windcave',
  verifySignature: (payload, signatureHeader) => verifyHmac(payload, signatureHeader, config.WINDCAVE_WEBHOOK_SECRET),
  normalize: (payload) => {
    const event = payload as Record<string, any>;
    return {
      provider: 'windcave',
      provider_payment_id: String(event.transactionId ?? event.id),
      invoiceId: event.invoiceId,
      amountCents: Number(event.amountCents ?? 0),
      currency: String(event.currency ?? 'NZD'),
      status: event.authorised === true ? 'succeeded' : 'pending',
      raw: payload
    };
  }
};

export const payMongoAdapter: PaymentProviderAdapter = {
  provider: 'paymongo',
  verifySignature: (payload, signatureHeader) => verifyHmac(payload, signatureHeader, config.PAYMONGO_WEBHOOK_SECRET),
  normalize: (payload) => {
    const event = payload as Record<string, any>;
    const data = event.data?.attributes ?? event;
    return {
      provider: 'paymongo',
      provider_payment_id: String(data.id ?? event.id),
      invoiceId: data.metadata?.invoice_id,
      amountCents: Number(data.amount ?? 0),
      currency: String(data.currency ?? 'PHP'),
      status: data.status === 'paid' || data.status === 'succeeded' ? 'succeeded' : 'pending',
      raw: payload
    };
  }
};

export async function applyPaymentEvent(businessId: string, event: NormalizedPaymentEvent) {
  if (!event.invoiceId) return null;
  return withBusinessContext(businessId, async (client) => {
    const inserted = await query(
      `INSERT INTO payments (business_id, invoice_id, provider, provider_payment_id, amount_cents, currency, status, raw_event, confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $7 = 'succeeded' THEN now() ELSE NULL END)
       ON CONFLICT (provider, provider_payment_id) WHERE provider_payment_id IS NOT NULL
       DO UPDATE SET
         amount_cents = EXCLUDED.amount_cents,
         currency = EXCLUDED.currency,
         status = EXCLUDED.status,
         raw_event = EXCLUDED.raw_event,
         confirmed_at = COALESCE(payments.confirmed_at, EXCLUDED.confirmed_at)
       RETURNING *`,
      [businessId, event.invoiceId, event.provider, event.provider_payment_id, event.amountCents, event.currency, event.status, event.raw],
      client
    );
    if (event.invoiceId && event.status === 'succeeded') {
      const totals = await query<{ total_cents: number; paid_cents: number }>(
        `SELECT i.total_cents, COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'succeeded'), 0) AS paid_cents
           FROM invoices i LEFT JOIN payments p ON p.invoice_id = i.id
          WHERE i.id = $1 AND i.business_id = $2 GROUP BY i.id`,
        [event.invoiceId, businessId],
        client
      );
      const row = totals.rows[0];
      if (row) {
        if (Number(row.paid_cents) >= Number(row.total_cents)) {
          await query("UPDATE invoices SET status = 'paid', paid_at = COALESCE(paid_at, now()), updated_at = now() WHERE id = $1 AND business_id = $2", [event.invoiceId, businessId], client);
        }
      }
    }
    return inserted.rows[0];
  });
}
