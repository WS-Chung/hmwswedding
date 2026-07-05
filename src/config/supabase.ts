// Supabase configuration constants.
//
// Wedding_Planner is a static frontend + Supabase two-tier app with no server
// side environment variable injection step (Requirement 11.2). The project URL
// and the anon-public API key are hardcoded here as source-code constants so
// the deployed Vercel bundle can talk to Wedding_DB directly using the anon
// role (Requirements 9.5, 9.6).
//
// SUPABASE_URL is the fixed project URL specified in Requirement 9.5.
//
// SUPABASE_ANON_KEY is intentionally left as the placeholder literal
// `__REPLACE_WITH_SUPABASE_ANON_KEY__` in the repository. Before running
// `vite build` or deploying to Vercel, replace this value with the actual
// anon-public key from the Supabase dashboard
// (Project Settings → API → Project API keys → `anon` `public`).
// The insertion procedure is documented in README.md (see task 16.2).
// Do NOT commit a real service_role key here; only the anon-public key is
// safe to ship in a static frontend bundle.

export const SUPABASE_URL = 'https://nhfoilaqgramxafgaood.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZm9pbGFxZ3JhbXhhZmdhb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NDM4MDQsImV4cCI6MjA4OTUxOTgwNH0.12oCxXkka3MRuyl53bQ8HSLDfzm6JJ58LVfprsUJQcQ';
