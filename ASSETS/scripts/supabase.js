import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://tkmaiktxpwqfbgeojbnf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrbWFpa3R4cHdxZmJnZW9qYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MzE4MTcsImV4cCI6MjA4OTMwNzgxN30.TkTZBNWUatk3Y6Vmfv1hIRR3DfVjgwauwa76Pf00J_8'

const authStorage = window.BTSAuthStorage?.storage || {
  getItem(key) {
    return localStorage.getItem('bts_auth_storage_mode') === 'session' ? sessionStorage.getItem(key) : localStorage.getItem(key)
  },
  setItem(key, value) {
    const target = localStorage.getItem('bts_auth_storage_mode') === 'session' ? sessionStorage : localStorage
    target.setItem(key, value)
  },
  removeItem(key) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: authStorage } })
