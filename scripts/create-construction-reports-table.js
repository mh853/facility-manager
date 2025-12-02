// Script to create construction_reports table in Supabase
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function createTable() {
  try {
    console.log('📋 Reading SQL schema...')
    const sqlPath = path.join(__dirname, '..', 'sql', 'construction_reports.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')

    console.log('🔨 Creating construction_reports table...')

    // Execute SQL using Supabase's RPC or direct query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    })

    if (error) {
      // If RPC doesn't exist, try alternative method
      console.log('⚠️  RPC method unavailable, attempting direct execution...')

      // Split SQL into individual statements and execute
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (const statement of statements) {
        console.log(`  Executing: ${statement.substring(0, 50)}...`)
        // Note: Direct SQL execution requires database admin access
        // This might not work with service role key
      }

      throw new Error('Unable to execute SQL. Please run the SQL file manually in Supabase dashboard.')
    }

    console.log('✅ construction_reports table created successfully!')

    // Verify table exists
    const { data: tableCheck, error: checkError } = await supabase
      .from('construction_reports')
      .select('count')
      .limit(0)

    if (checkError) {
      console.log('⚠️  Table created but verification failed:', checkError.message)
    } else {
      console.log('✅ Table verified and ready to use')
    }

  } catch (error) {
    console.error('❌ Error creating table:', error.message)
    console.log('\n📝 Please create the table manually:')
    console.log('   1. Go to Supabase Dashboard > SQL Editor')
    console.log('   2. Copy contents from: sql/construction_reports.sql')
    console.log('   3. Execute the SQL\n')
    process.exit(1)
  }
}

createTable()
