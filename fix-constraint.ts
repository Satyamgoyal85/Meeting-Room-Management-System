import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log('Fixing CHECK constraint on employees.role...');
  const { data: rlsData, error: rlsError } = await supabase.rpc('exec_sql', {
    sql_string: `
      ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;
      ALTER TABLE public.employees ADD CONSTRAINT employees_role_check CHECK (role IN ('employee', 'admin', 'receptionist'));
    `
  });
  
  if (rlsError) {
    console.log('RPC exec_sql failed (maybe not defined?). Will use postgres direct or we just ignore if it worked:', rlsError);
  } else {
    console.log('Constraint fixed via RPC!');
  }
}

run();
