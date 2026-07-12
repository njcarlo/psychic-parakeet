export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'CleanOps API',
    version: '0.1.0',
    description: 'Multi-tenant cleaning business SaaS API foundation'
  },
  servers: [{ url: '/api' }, { url: '/v1', description: 'Public API' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Api-Key' }
    }
  },
  paths: {
    '/auth/register': { post: { summary: 'Register a business and owner user' } },
    '/auth/login': { post: { summary: 'Log in and receive a JWT' } },
    '/auth/me': { get: { summary: 'Get current authenticated user', security: [{ bearerAuth: [] }] } },
    '/clients': { get: { summary: 'List clients', security: [{ bearerAuth: [] }] }, post: { summary: 'Create client', security: [{ bearerAuth: [] }] } },
    '/properties': { get: { summary: 'List properties', security: [{ bearerAuth: [] }] }, post: { summary: 'Create property', security: [{ bearerAuth: [] }] } },
    '/jobs': { get: { summary: 'List jobs', security: [{ bearerAuth: [] }] }, post: { summary: 'Create ad-hoc job', security: [{ bearerAuth: [] }] } },
    '/jobs/find-gaps': { post: { summary: 'Find cleaner schedule gaps', security: [{ bearerAuth: [] }] } },
    '/recurrence': { get: { summary: 'List recurrence rules', security: [{ bearerAuth: [] }] }, post: { summary: 'Create recurrence rule', security: [{ bearerAuth: [] }] } },
    '/time-entries/clock-in': { post: { summary: 'Clock in to a job', security: [{ bearerAuth: [] }] } },
    '/time-entries/clock-out': { post: { summary: 'Clock out of a job', security: [{ bearerAuth: [] }] } },
    '/checklists/templates': { get: { summary: 'List checklist templates', security: [{ bearerAuth: [] }] }, post: { summary: 'Create checklist template', security: [{ bearerAuth: [] }] } },
    '/invoices': { get: { summary: 'List invoices', security: [{ bearerAuth: [] }] }, post: { summary: 'Create invoice from jobs', security: [{ bearerAuth: [] }] } },
    '/payments/record': { post: { summary: 'Record manual payment', security: [{ bearerAuth: [] }] } },
    '/messages': { post: { summary: 'Send templated client message', security: [{ bearerAuth: [] }] } },
    '/sos/trigger': { post: { summary: 'Trigger SOS event', security: [{ bearerAuth: [] }] } },
    '/availability': { get: { summary: 'List cleaner availability', security: [{ bearerAuth: [] }] }, post: { summary: 'Create availability', security: [{ bearerAuth: [] }] } },
    '/earnings': { get: { summary: 'Get cleaner earnings', security: [{ bearerAuth: [] }] } },
    '/tax/jurisdictions': { get: { summary: 'List tax jurisdictions', security: [{ bearerAuth: [] }] } },
    '/v1/clients': { get: { summary: 'Public API list clients', security: [{ apiKeyAuth: [] }] }, post: { summary: 'Public API create client', security: [{ apiKeyAuth: [] }] } },
    '/v1/properties': { get: { summary: 'Public API list properties', security: [{ apiKeyAuth: [] }] }, post: { summary: 'Public API create property', security: [{ apiKeyAuth: [] }] } },
    '/v1/jobs': { get: { summary: 'Public API list jobs', security: [{ apiKeyAuth: [] }] }, post: { summary: 'Public API create job', security: [{ apiKeyAuth: [] }] } }
  }
};
