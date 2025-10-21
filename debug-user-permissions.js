// Debug script to check user permissions in Supabase
// Run with: node debug-user-permissions.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserPermissions() {
  try {
    console.log('🔍 Checking user permissions for munong2@gmail.com...\n');

    // 이메일로 사용자 조회
    const { data: users, error: userError } = await supabase
      .from('employees')
      .select('id, name, email, permission_level, is_active, created_at, updated_at')
      .eq('email', 'munong2@gmail.com');

    if (userError) {
      console.error('❌ User query error:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('❌ No user found with email: munong2@gmail.com');
      return;
    }

    console.log('📊 User Information:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Permission Level: ${user.permission_level} ⭐`);
      console.log(`   Active: ${user.is_active}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Updated: ${user.updated_at}`);
      console.log('');
    });

    // ID로 한번 더 조회 (verify API와 동일한 방식)
    const userId = '502da2f0-fd81-449a-87c3-5be924067d4c';
    console.log(`🔍 Checking specific user ID: ${userId}`);

    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (fetchError) {
      console.error('❌ Specific user query error:', fetchError);
      return;
    }

    if (employee) {
      console.log('✅ User found by ID:');
      console.log(`   Permission Level: ${employee.permission_level} ⭐`);
      console.log(`   Raw Data:`, JSON.stringify(employee, null, 2));
    } else {
      console.log('❌ No user found with that ID');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkUserPermissions();