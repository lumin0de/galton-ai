import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Todas as queries usam o schema galton
// Requer que 'galton' esteja em: Supabase Dashboard → Settings → API → Extra schemas
export const db = supabase.schema('galton')
