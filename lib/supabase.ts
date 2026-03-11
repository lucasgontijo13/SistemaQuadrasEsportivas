import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cria uma única ligação que vamos reutilizar em todo o site
export const supabase = createClient(supabaseUrl, supabaseAnonKey)