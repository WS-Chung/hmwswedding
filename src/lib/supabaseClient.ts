// Supabase client singleton.
//
// This module is the single source of truth for the `@supabase/supabase-js`
// client instance used by every `features/**/**Api.ts` module in the app.
// Sharing one instance avoids duplicate WebSocket/HTTP connections and keeps
// the anon-role credentials centralized (Requirements 9.5, 9.6, 11.2).
//
// `auth.persistSession: false` is required because Wedding_Planner runs
// entirely under the anon role and does not use Supabase Auth sessions.
// Disabling persistence prevents the client from writing an auth session to
// localStorage, which is unnecessary here and would otherwise leak state
// across browser refreshes for a role that has no user identity.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
