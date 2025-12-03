-- Migration: Update business_model_canvas to support multiple object types
-- This allows linking to contacts, organisations, documents, and tasks
-- instead of just organisations

-- Step 1: Add new JSONB columns for universal object references
-- Format: [{"type": "contact"|"organisation"|"document"|"task", "id": "uuid", "name": "optional display name"}]
ALTER TABLE business_model_canvas
ADD COLUMN IF NOT EXISTS customer_segments_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS key_partnerships_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS key_resources_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS key_activities_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS channels_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS customer_relationships_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS revenue_streams_objects JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS cost_structure_objects JSONB DEFAULT '[]';

-- Step 2: Migrate existing org_ids to the new format
-- Convert existing UUID arrays to JSONB format
UPDATE business_model_canvas
SET customer_segments_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(customer_segments_org_ids) AS id),
  '[]'::jsonb
)
WHERE customer_segments_org_ids IS NOT NULL AND array_length(customer_segments_org_ids, 1) > 0;

UPDATE business_model_canvas
SET key_partnerships_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(key_partnerships_org_ids) AS id),
  '[]'::jsonb
)
WHERE key_partnerships_org_ids IS NOT NULL AND array_length(key_partnerships_org_ids, 1) > 0;

UPDATE business_model_canvas
SET key_resources_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(key_resources_org_ids) AS id),
  '[]'::jsonb
)
WHERE key_resources_org_ids IS NOT NULL AND array_length(key_resources_org_ids, 1) > 0;

UPDATE business_model_canvas
SET key_activities_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(key_activities_org_ids) AS id),
  '[]'::jsonb
)
WHERE key_activities_org_ids IS NOT NULL AND array_length(key_activities_org_ids, 1) > 0;

UPDATE business_model_canvas
SET channels_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(channels_org_ids) AS id),
  '[]'::jsonb
)
WHERE channels_org_ids IS NOT NULL AND array_length(channels_org_ids, 1) > 0;

UPDATE business_model_canvas
SET customer_relationships_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(customer_relationships_org_ids) AS id),
  '[]'::jsonb
)
WHERE customer_relationships_org_ids IS NOT NULL AND array_length(customer_relationships_org_ids, 1) > 0;

UPDATE business_model_canvas
SET revenue_streams_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(revenue_streams_org_ids) AS id),
  '[]'::jsonb
)
WHERE revenue_streams_org_ids IS NOT NULL AND array_length(revenue_streams_org_ids, 1) > 0;

UPDATE business_model_canvas
SET cost_structure_objects = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('type', 'organisation', 'id', id))
   FROM unnest(cost_structure_org_ids) AS id),
  '[]'::jsonb
)
WHERE cost_structure_org_ids IS NOT NULL AND array_length(cost_structure_org_ids, 1) > 0;

-- Note: We keep the old *_org_ids columns for backward compatibility
-- They can be removed in a future migration if needed




