-- Migration: Update business_model_canvas to use organisation IDs instead of text
-- This allows linking to actual organisations in the system

-- Step 1: Add new columns for organisation IDs (as UUID arrays)
ALTER TABLE business_model_canvas
ADD COLUMN IF NOT EXISTS customer_segments_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS key_partnerships_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS key_resources_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS key_activities_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS channels_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS customer_relationships_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS revenue_streams_org_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cost_structure_org_ids UUID[] DEFAULT '{}';

-- Step 2: Keep old TEXT columns for backward compatibility (we can remove them later if needed)
-- The old columns will be used as fallback or for additional notes

-- Note: We're keeping value_propositions as TEXT since it's not about organisations
-- If you want to link value propositions to organisations later, you can add that column




