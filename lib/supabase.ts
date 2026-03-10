import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bfshqclxrfpqymcjqcxo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmc2hxY2x4cmZwcXltY2pxY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjQ4NDgsImV4cCI6MjA4ODQwMDg0OH0.kISLqdos8vNzU5dcSIHVXD5wsamkAj9gXO4R2nb5KAQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)