import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('Checking if receptionist exists...');
  const { data: existingEmp } = await supabase.from('employees').select('*').eq('employee_id', 'ECN-9000').single();
  
  if (existingEmp) {
    console.log('Receptionist already exists in public.employees:', existingEmp);
    return;
  }

  console.log('Creating auth user for receptionist...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'reception@dhanuka.com',
    password: 'rece9000',
    email_confirm: true,
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    return;
  }

  const authUserId = authData.user.id;
  console.log('Auth user created with ID:', authUserId);

  console.log('Inserting into public.employees...');
  const { data: empData, error: empError } = await supabase.from('employees').insert({
    auth_user_id: authUserId,
    employee_id: 'ECN-9000',
    name: 'Reception Desk',
    role: 'receptionist',
    is_active: true
  }).select();

  if (empError) {
    console.error('Error inserting into employees:', empError);
  } else {
    console.log('Successfully created Receptionist ECN-9000 in Supabase!');
    console.log(empData);
  }
}

run();
