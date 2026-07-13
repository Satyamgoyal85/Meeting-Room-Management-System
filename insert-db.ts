import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase.from('employees').upsert({
    id: '33333333-3333-3333-3333-333333333332',
    auth_id: null,
    employee_id: 'ECN-9000',
    name: 'Reception Desk',
    email: 'reception@dhanuka.com',
    password_hash: 'rece9000',
    department_id: '11111111-1111-1111-1111-111111111110',
    role: 'receptionist',
    is_active: true,
    must_reset_password: true,
    failed_login_attempts: 0
  }, { onConflict: 'employee_id' }).select();

  console.log('Insert Result:');
  console.log(JSON.stringify({ data, error }, null, 2));
}

run();
