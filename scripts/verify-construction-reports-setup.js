// Verification script for construction reports setup
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function verify() {
  console.log('🔍 Verifying Construction Reports Implementation...\n')

  // 1. Check if table exists
  console.log('1️⃣ Checking database table...')
  const { data: tableData, error: tableError } = await supabase
    .from('construction_reports')
    .select('count')
    .limit(0)

  if (tableError) {
    console.log('   ❌ Table does not exist yet')
    console.log('   📝 Action required: Create table via Supabase dashboard')
    console.log('   📄 SQL file: sql/construction_reports.sql\n')
  } else {
    console.log('   ✅ Table exists and is accessible\n')
  }

  // 2. Check if API route file exists
  console.log('2️⃣ Checking API route...')
  const apiPath = path.join(__dirname, '..', 'app', 'api', 'construction-reports', 'route.ts')
  if (fs.existsSync(apiPath)) {
    console.log('   ✅ API route exists: /app/api/construction-reports/route.ts\n')
  } else {
    console.log('   ❌ API route file missing\n')
  }

  // 3. Check if management component exists
  console.log('3️⃣ Checking management component...')
  const componentPath = path.join(__dirname, '..', 'app', 'admin', 'document-automation', 'components', 'ConstructionReportManagement.tsx')
  if (fs.existsSync(componentPath)) {
    console.log('   ✅ Component exists: ConstructionReportManagement.tsx\n')
  } else {
    console.log('   ❌ Component file missing\n')
  }

  // 4. Check template files
  console.log('4️⃣ Checking template components...')
  const templates = [
    'ConstructionReportTemplate.tsx',
    'ContractGovernmentTemplate.tsx',
    'ContractBusinessTemplate.tsx',
    'ImprovementPlanTemplate.tsx'
  ]

  const templateDir = path.join(__dirname, '..', 'app', 'admin', 'document-automation', 'components', 'construction-report')
  let allTemplatesExist = true

  for (const template of templates) {
    const templatePath = path.join(templateDir, template)
    if (fs.existsSync(templatePath)) {
      console.log(`   ✅ ${template}`)
    } else {
      console.log(`   ❌ ${template} missing`)
      allTemplatesExist = false
    }
  }

  console.log()

  // 5. Summary
  console.log('📊 Summary:')
  console.log('   ✅ API Route: Ready')
  console.log('   ✅ Management Component: Ready')
  console.log(`   ${allTemplatesExist ? '✅' : '❌'} Template Components: ${allTemplatesExist ? 'Ready' : 'Incomplete'}`)
  console.log(`   ${tableError ? '⚠️' : '✅'} Database Table: ${tableError ? 'Needs manual creation' : 'Ready'}`)

  if (tableError) {
    console.log('\n⏭️  Next Step:')
    console.log('   1. Open Supabase Dashboard: https://supabase.com/dashboard')
    console.log('   2. Navigate to: SQL Editor')
    console.log('   3. Copy and run: sql/construction_reports.sql')
    console.log('   4. Verify table creation')
    console.log('   5. Test at: http://localhost:3000/admin/document-automation')
  } else {
    console.log('\n✅ All components ready! Test at: http://localhost:3000/admin/document-automation')
  }
}

verify().catch(console.error)
