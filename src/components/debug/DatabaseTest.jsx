import { useState } from 'react'
import { supabase } from '../../services/supabase'
import { useCategories } from '../../hooks/useCategories.jsx'
import Button from '../ui/Button'

export default function DatabaseTest() {
  const [results, setResults] = useState(null)
  const [testCompanyData, setTestCompanyData] = useState({
    company_name: '',
    city: '',
    state: ''
  })

  const { categories, isLoading: categoriesLoading } = useCategories()

  const testDatabaseConnection = async () => {
    setResults('Testing...')
    const testResults = []

    try {
      // Test 1: Check company schema
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .limit(1)

      testResults.push({
        test: 'Company Schema Discovery',
        success: !companiesError,
        data: companiesError ? companiesError : companies?.[0] ? Object.keys(companies[0]) : [],
        error: companiesError
      })

      // Test 2: Check customer schema
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .limit(1)

      testResults.push({
        test: 'Customer Schema Discovery',
        success: !customersError,
        data: customersError ? customersError : customers?.[0] ? Object.keys(customers[0]) : [],
        error: customersError
      })

      // Test 3: Check SKU schema
      const { data: skus, error: skusError } = await supabase
        .from('skus')
        .select('*')
        .limit(1)

      testResults.push({
        test: 'SKU Schema Discovery',
        success: !skusError,
        data: skusError ? skusError : skus?.[0] ? Object.keys(skus[0]) : [],
        error: skusError
      })

      // Test 4: Check categories
      const { data: cats, error: catsError } = await supabase
        .from('sku_categories')
        .select('*')
        .limit(1)

      testResults.push({
        test: 'Category Schema Discovery',
        success: !catsError,
        data: catsError ? catsError : cats?.[0] ? Object.keys(cats[0]) : [],
        error: catsError
      })

    } catch (err) {
      testResults.push({
        test: 'General Connection',
        success: false,
        error: err.message
      })
    }

    setResults(testResults)
  }

  const testAllMasterCreation = async () => {
    setResults('Testing all master creation...')
    const testResults = []

    try {
      // Test 1: Company Creation
      console.log('Testing company creation...')
      const companyData = {
        company_name: 'Test Company ' + Date.now(),
        address_line1: 'Test Address Line 1',
        address_line2: 'Test Address Line 2',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '9876543210',
        email: 'test@company.com',
        gstin: '27ABCDE1234F1Z5',
        pan_number: 'ABCDE1234F',
        invoice_prefix: 'INV-',
        invoice_start_number: 1,
        invoice_current_number: 1
      }

      const { data: companyResult, error: companyError } = await supabase
        .from('companies')
        .insert(companyData)
        .select()

      testResults.push({
        test: 'Company Creation Test',
        success: !companyError,
        data: companyError ? companyError : companyResult,
        error: companyError
      })

      // Test 2: Customer Creation with correct field mapping
      console.log('Testing customer creation...')
      const customerData = {
        customer_name: 'Test Customer ' + Date.now(),
        contact_person: 'John Doe',
        phone: '9876543210',
        email: 'customer@test.com',
        billing_address_line1: 'Customer Address 1',
        billing_address_line2: 'Customer Address 2',
        billing_city: 'Delhi',
        billing_state: 'Delhi',
        billing_pincode: '110001',
        customer_type: 'Retail',
        gstin: '07ABCDE1234F1Z5',
        pan_number: 'CDEFG1234H'
      }

      const { data: customerResult, error: customerError } = await supabase
        .from('customers')
        .insert(customerData)
        .select()

      testResults.push({
        test: 'Customer Creation Test',
        success: !customerError,
        data: customerError ? customerError : customerResult,
        error: customerError
      })

      // Test 3: Get a category for SKU test
      const { data: categories } = await supabase
        .from('sku_categories')
        .select('*')
        .limit(1)

      if (categories && categories.length > 0) {
        // Test 4: SKU Creation with correct field mapping
        console.log('Testing SKU creation...')
        const skuData = {
          sku_name: 'Test SKU ' + Date.now(),
          description: 'Test SKU Description',
          category_id: categories[0].id,
          unit_of_measure: 'PCS',  // Correct database field name
          secondary_uom: 'BOX',
          conversion_factor: 10,
          gst_rate: 18,
          hsn_code: '76061190',
          reorder_level: 100
          // Removed default_selling_price as it doesn't exist in schema
        }

        const { data: skuResult, error: skuError } = await supabase
          .from('skus')
          .insert(skuData)
          .select()

        testResults.push({
          test: 'SKU Creation Test',
          success: !skuError,
          data: skuError ? skuError : skuResult,
          error: skuError
        })

        // Test 5: Create inventory record for SKU if successful
        if (!skuError && skuResult[0]) {
          const { error: inventoryError } = await supabase
            .from('inventory')
            .insert({
              sku_id: skuResult[0].id,
              current_stock: 0,
              available_stock: 0
            })

          testResults.push({
            test: 'SKU Inventory Creation Test',
            success: !inventoryError,
            data: inventoryError ? inventoryError : 'Inventory record created',
            error: inventoryError
          })
        }
      } else {
        testResults.push({
          test: 'SKU Creation Test',
          success: false,
          error: 'No categories found - cannot test SKU creation'
        })
      }

    } catch (err) {
      testResults.push({
        test: 'General Test Error',
        success: false,
        error: err.message
      })
    }

    setResults(testResults)
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Database Connection Test</h2>

      {/* Environment Check */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="font-medium mb-2">Environment Variables:</h3>
        <p><strong>URL:</strong> {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
        <p><strong>Key:</strong> {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
      </div>

      {/* Hook Test */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h3 className="font-medium mb-2">useCategories Hook Test:</h3>
        <p><strong>Loading:</strong> {categoriesLoading ? 'Yes' : 'No'}</p>
        <p><strong>Categories Count:</strong> {categories.length}</p>
        {categories.length > 0 && (
          <div className="mt-2">
            <p><strong>Categories:</strong></p>
            <ul className="list-disc list-inside">
              {categories.map(cat => (
                <li key={cat.id}>{cat.category_name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Connection Test */}
      <div className="mb-6">
        <Button onClick={testDatabaseConnection}>
          Test Database Schema
        </Button>
      </div>

      {/* All Master Creation Test */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h3 className="font-medium mb-4">🧪 COMPREHENSIVE MASTER CREATION TEST</h3>
        <p className="text-sm text-gray-600 mb-4">
          This will test actual database record creation for Company, Customer, and SKU masters with proper field mapping.
        </p>
        <Button onClick={testAllMasterCreation} className="bg-blue-600 text-white">
          🚀 Test All Master Creation (with DB Verification)
        </Button>
      </div>

      {/* Results */}
      {results && (
        <div className="mt-6">
          <h3 className="font-medium mb-4">Test Results:</h3>
          {typeof results === 'string' ? (
            <p>{results}</p>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className={`p-4 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  <h4 className="font-medium">{result.test}: {result.success ? '✅' : '❌'}</h4>
                  {result.error && (
                    <div className="mt-2">
                      <p className="text-red-600"><strong>Error:</strong></p>
                      <pre className="text-sm bg-white p-2 rounded overflow-auto">
                        {JSON.stringify(result.error, null, 2)}
                      </pre>
                    </div>
                  )}
                  {result.data && result.success && (
                    <div className="mt-2">
                      <p className="text-green-600"><strong>Data:</strong></p>
                      <pre className="text-sm bg-white p-2 rounded overflow-auto max-h-40">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}