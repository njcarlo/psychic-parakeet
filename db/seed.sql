-- Demo seed data for local development.
-- Login: admin@harbourshine.nz / password123
-- Cleaner: mia@harbourshine.nz / password123

WITH
seed_business AS (
  INSERT INTO businesses (
    id,
    name,
    country_code,
    timezone,
    currency,
    pricing_mode
  ) VALUES (
    '11111111-1111-4111-8111-111111111111',
    'Harbour Shine Cleaning',
    'NZ',
    'Pacific/Auckland',
    'NZD',
    'inclusive'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    country_code = EXCLUDED.country_code,
    timezone = EXCLUDED.timezone,
    currency = EXCLUDED.currency,
    pricing_mode = EXCLUDED.pricing_mode
  RETURNING id
),
owner_user AS (
  INSERT INTO users (
    id,
    business_id,
    email,
    password_hash,
    full_name,
    role,
    phone,
    active
  )
  SELECT
    '22222222-2222-4222-8222-222222222222',
    id,
    'admin@harbourshine.nz',
    '$2b$12$1rrpi6qEC4Sa..LXLGXXU.QIfRPPkoNL6/Do7YPDN4ZT4sx.I9TBq',
    'Aroha Taylor',
    'owner',
    '+64210000001',
    true
  FROM seed_business
  ON CONFLICT (email) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    active = EXCLUDED.active
  RETURNING id
),
cleaner_user AS (
  INSERT INTO users (
    id,
    business_id,
    email,
    password_hash,
    full_name,
    role,
    phone,
    pay_type,
    pay_rate_cents,
    active
  )
  SELECT
    '33333333-3333-4333-8333-333333333333',
    id,
    'mia@harbourshine.nz',
    '$2b$12$1rrpi6qEC4Sa..LXLGXXU.QIfRPPkoNL6/Do7YPDN4ZT4sx.I9TBq',
    'Mia Williams',
    'cleaner',
    '+64210000002',
    'hourly',
    2850,
    true
  FROM seed_business
  ON CONFLICT (email) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    pay_type = EXCLUDED.pay_type,
    pay_rate_cents = EXCLUDED.pay_rate_cents,
    active = EXCLUDED.active
  RETURNING id
),
client_one AS (
  INSERT INTO clients (
    id,
    business_id,
    name,
    email,
    phone,
    billing_address,
    comm_preference,
    notes
  )
  SELECT
    '44444444-4444-4444-8444-444444444444',
    id,
    'Harper Family',
    'hello@harper.example',
    '+6495550101',
    '12 Beach Road, Takapuna, Auckland 0622',
    'both',
    'Prefers Tuesday mornings; dog is friendly.'
  FROM seed_business
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    billing_address = EXCLUDED.billing_address,
    comm_preference = EXCLUDED.comm_preference,
    notes = EXCLUDED.notes
  RETURNING id
),
client_two AS (
  INSERT INTO clients (
    id,
    business_id,
    name,
    email,
    phone,
    billing_address,
    comm_preference,
    notes
  )
  SELECT
    '55555555-5555-4555-8555-555555555555',
    id,
    'Kowhai Realty',
    'facilities@kowhairealty.example',
    '+6495550102',
    '88 Queen Street, Auckland Central, Auckland 1010',
    'email',
    'Send invoices to the facilities mailbox.'
  FROM seed_business
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    billing_address = EXCLUDED.billing_address,
    comm_preference = EXCLUDED.comm_preference,
    notes = EXCLUDED.notes
  RETURNING id
),
property_one AS (
  INSERT INTO properties (
    id,
    business_id,
    client_id,
    label,
    address_line1,
    city,
    region,
    postcode,
    country_code,
    lat,
    lng,
    access_notes
  )
  SELECT
    '66666666-6666-4666-8666-666666666666',
    seed_business.id,
    client_one.id,
    'Harper Home',
    '12 Beach Road',
    'Auckland',
    'Auckland',
    '0622',
    'NZ',
    -36.786530,
    174.772390,
    'Key safe by side gate; code shared in booking notes.'
  FROM seed_business, client_one
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    client_id = EXCLUDED.client_id,
    label = EXCLUDED.label,
    address_line1 = EXCLUDED.address_line1,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    postcode = EXCLUDED.postcode,
    country_code = EXCLUDED.country_code,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    access_notes = EXCLUDED.access_notes
  RETURNING id
),
property_two AS (
  INSERT INTO properties (
    id,
    business_id,
    client_id,
    label,
    address_line1,
    address_line2,
    city,
    region,
    postcode,
    country_code,
    lat,
    lng,
    access_notes
  )
  SELECT
    '77777777-7777-4777-8777-777777777777',
    seed_business.id,
    client_two.id,
    'Kowhai Office Suite',
    '88 Queen Street',
    'Level 5',
    'Auckland',
    'Auckland',
    '1010',
    'NZ',
    -36.846860,
    174.766750,
    'Security desk issues visitor badges after 6pm.'
  FROM seed_business, client_two
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    client_id = EXCLUDED.client_id,
    label = EXCLUDED.label,
    address_line1 = EXCLUDED.address_line1,
    address_line2 = EXCLUDED.address_line2,
    city = EXCLUDED.city,
    region = EXCLUDED.region,
    postcode = EXCLUDED.postcode,
    country_code = EXCLUDED.country_code,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    access_notes = EXCLUDED.access_notes
  RETURNING id
),
checklist_template AS (
  INSERT INTO checklist_templates (
    id,
    business_id,
    name,
    job_type
  )
  SELECT
    '88888888-8888-4888-8888-888888888888',
    id,
    'Standard Residential Clean',
    'residential'
  FROM seed_business
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    name = EXCLUDED.name,
    job_type = EXCLUDED.job_type
  RETURNING id, business_id
),
checklist_item_one AS (
  INSERT INTO checklist_items (
    id,
    template_id,
    business_id,
    label,
    sort_order,
    requires_photo
  )
  SELECT
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    id,
    business_id,
    'Kitchen benches, sink, stovetop, and appliance fronts',
    10,
    false
  FROM checklist_template
  ON CONFLICT (id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    business_id = EXCLUDED.business_id,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    requires_photo = EXCLUDED.requires_photo
  RETURNING id
),
checklist_item_two AS (
  INSERT INTO checklist_items (
    id,
    template_id,
    business_id,
    label,
    sort_order,
    requires_photo
  )
  SELECT
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    id,
    business_id,
    'Bathrooms cleaned, mirrors polished, bins emptied',
    20,
    true
  FROM checklist_template
  ON CONFLICT (id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    business_id = EXCLUDED.business_id,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    requires_photo = EXCLUDED.requires_photo
  RETURNING id
),
checklist_item_three AS (
  INSERT INTO checklist_items (
    id,
    template_id,
    business_id,
    label,
    sort_order,
    requires_photo
  )
  SELECT
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    id,
    business_id,
    'Vacuum and mop hard floors',
    30,
    false
  FROM checklist_template
  ON CONFLICT (id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    business_id = EXCLUDED.business_id,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    requires_photo = EXCLUDED.requires_photo
  RETURNING id
)
INSERT INTO recurrence_rules (
  id,
  business_id,
  client_id,
  property_id,
  frequency,
  interval_weeks,
  day_of_week,
  preferred_start_time,
  duration_minutes,
  cleaner_id,
  checklist_template_id,
  price_cents,
  active,
  starts_on,
  notes
)
SELECT
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  seed_business.id,
  client_one.id,
  property_one.id,
  'weekly',
  1,
  2,
  '09:00',
  120,
  cleaner_user.id,
  checklist_template.id,
  9500,
  true,
  CURRENT_DATE,
  'Weekly family home clean; bring eco products.'
FROM seed_business, client_one, property_one, cleaner_user, checklist_template
ON CONFLICT (id) DO UPDATE SET
  business_id = EXCLUDED.business_id,
  client_id = EXCLUDED.client_id,
  property_id = EXCLUDED.property_id,
  frequency = EXCLUDED.frequency,
  interval_weeks = EXCLUDED.interval_weeks,
  day_of_week = EXCLUDED.day_of_week,
  preferred_start_time = EXCLUDED.preferred_start_time,
  duration_minutes = EXCLUDED.duration_minutes,
  cleaner_id = EXCLUDED.cleaner_id,
  checklist_template_id = EXCLUDED.checklist_template_id,
  price_cents = EXCLUDED.price_cents,
  active = EXCLUDED.active,
  starts_on = EXCLUDED.starts_on,
  notes = EXCLUDED.notes;
