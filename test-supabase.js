// Simple test script to check Supabase connection
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lwxhjtdnxntfyaompfth.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3eGhqdGRueG50Znlhb21wZnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDM5NjksImV4cCI6MjA4NzE3OTk2OX0.kfd2nhmoJ7aNKUWgWSb-tJavPwAdi1fxVmXp8HfCtRY'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
  console.log('🔍 Testing Supabase connection...')

  // Test 1: Check if we can connect
  try {
    const { data, error } = await supabase.from('roles').select('*')

    if (error) {
      console.error('❌ Database connection error:', error)
      return
    }

    console.log('✅ Connected to Supabase successfully!')
    console.log('📋 Roles found:', data)

    // Test 2: Check categories
    const { data: categories, error: catError } = await supabase
      .from('sku_categories')
      .select('*')

    if (catError) {
      console.error('❌ Categories table error:', catError)
    } else {
      console.log('📂 Categories found:', categories)
    }

    // Test 3: Try to create a test company
    console.log('🧪 Testing company creation...')
    const { data: company, error: compError } = await supabase
      .from('companies')
      .insert({
        company_name: 'Test Company',
        city: 'Test City',
        state: 'Test State'
      })
      .select()

    if (compError) {
      console.error('❌ Company creation error:', compError)
    } else {
      console.log('✅ Company created successfully:', company)
    }

  } catch (err) {
    console.error('❌ Connection failed:', err)
  }
}

testConnection()