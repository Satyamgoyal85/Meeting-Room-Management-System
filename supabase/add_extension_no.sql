-- Migration: Add extension_no column to rooms table
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run multiple times (IF NOT EXISTS guard)

ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS extension_no TEXT DEFAULT NULL;

-- Reload PostgREST schema cache so the new column is immediately visible to the API
NOTIFY pgrst, 'reload schema';
