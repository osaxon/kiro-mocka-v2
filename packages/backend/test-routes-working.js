#!/usr/bin/env node

/**
 * Quick test to verify routes are working after oRPC attempt
 */

import { spawn } from 'child_process'
import { setTimeout } from 'timers/promises'

const BASE_URL = 'http://localhost:3000'

async function makeRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  })

  const data = await response.json()
  return { status: response.status, data }
}

async function testRoutes() {
  console.log('🧪 Testing that routes are still working...\n')

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...')
    const health = await makeRequest('/health')
    console.log(`   ✅ Health: ${health.status}`)

    // Test API creation
    console.log('2. Testing API creation...')
    const createApi = await makeRequest('/api/apis', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test API',
        description: 'Quick test'
      })
    })
    console.log(`   ✅ Create API: ${createApi.status}`)

    if (createApi.status === 201) {
      const apiId = createApi.data.data.id

      // Test endpoint creation
      console.log('3. Testing endpoint creation...')
      const createEndpoint = await makeRequest(`/api/apis/${apiId}/endpoints`, {
        method: 'POST',
        body: JSON.stringify({
          method: 'GET',
          path: '/test',
          description: 'Test endpoint'
        })
      })
      console.log(`   ✅ Create endpoint: ${createEndpoint.status}`)

      if (createEndpoint.status === 201) {
        const endpointId = createEndpoint.data.data.id

        // Test scenario creation
        console.log('4. Testing scenario creation...')
        const createScenario = await makeRequest(`/api/endpoints/${endpointId}/scenarios`, {
          method: 'POST',
          body: JSON.stringify({
            name: 'Success',
            statusCode: 200,
            responseBody: { message: 'Hello World' },
            isDefault: true
          })
        })
        console.log(`   ✅ Create scenario: ${createScenario.status}`)

        // Cleanup
        console.log('5. Cleaning up...')
        await makeRequest(`/api/apis/${apiId}`, { method: 'DELETE' })
        console.log(`   ✅ Cleanup complete`)
      }
    }

    console.log('\n🎉 All routes are working correctly!')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    process.exit(1)
  }
}

async function main() {
  console.log('🚀 Starting server...')

  const server = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  })

  let serverReady = false

  server.stdout.on('data', (data) => {
    const output = data.toString()
    if (output.includes('Server running on port')) {
      serverReady = true
    }
  })

  server.stderr.on('data', (data) => {
    console.error('Server error:', data.toString())
  })

  // Wait for server to start
  let attempts = 0
  while (!serverReady && attempts < 50) {
    await setTimeout(100)
    attempts++
  }

  if (!serverReady) {
    console.error('❌ Server failed to start')
    server.kill()
    process.exit(1)
  }

  console.log('✅ Server started\n')

  try {
    await testRoutes()
  } finally {
    console.log('\n🛑 Stopping server...')
    server.kill()
  }
}

main().catch(console.error)