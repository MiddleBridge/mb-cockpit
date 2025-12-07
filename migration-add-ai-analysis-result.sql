-- Migration: Add ai_analysis_result field to organisation_documents
-- This enables saving AI analysis results (comments, terms, summary) for each document

ALTER TABLE organisation_documents
ADD COLUMN IF NOT EXISTS ai_analysis_result JSONB;

-- Add comment for documentation
COMMENT ON COLUMN organisation_documents.ai_analysis_result IS 'Stores complete AI analysis result including comments, terms (current and after_comments), and summary';


