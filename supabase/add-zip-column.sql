-- Add zip code column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS zip TEXT;
