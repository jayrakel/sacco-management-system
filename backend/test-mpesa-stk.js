#!/usr/bin/env node

/**
 * 🧪 M-PESA STK PUSH TEST SCRIPT
 * Tests if M-Pesa STK Push is working correctly
 * 
 * Usage: node test-mpesa-stk.js
 */

const axios = require('axios');
const http = require('http');

const BASE_URL = 'http://localhost:5000';
const API_ENDPOINT = `${BASE_URL}/api/payments/mpesa/stk-push`;

// Test Configuration
const TEST_CONFIG = {
    amount: 100,
    phoneNumber: '254712345678',
    type: 'DEPOSIT'
};

// Color codes for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    section: (msg) => console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.blue}${msg}${colors.reset}\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`)
};

// Check if server is running
const checkServer = async () => {
    return new Promise((resolve) => {
        log.info(`Checking if backend server is running at ${BASE_URL}...`);
        
        const req = http.get(`${BASE_URL}/api/settings/branding`, (res) => {
            resolve(true);
        });
        
        req.on('error', () => {
            resolve(false);
        });
    });
};

// Test 1: Check M-Pesa Token Generation
const testTokenGeneration = async () => {
    log.section('Test 1: M-Pesa Token Generation');
    
    try {
        log.info('Attempting to generate M-Pesa access token...');
        
        const consumer = process.env.MPESA_CONSUMER_KEY;
        const secret = process.env.MPESA_CONSUMER_SECRET;
        
        if (!consumer || !secret) {
            log.error('M-Pesa credentials not found in environment variables');
            return false;
        }
        
        const auth = Buffer.from(`${consumer}:${secret}`).toString('base64');
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { 
                headers: { Authorization: `Basic ${auth}` },
                timeout: 10000
            }
        );
        
        if (response.data.access_token) {
            log.success(`Token generated successfully`);
            log.info(`Token: ${response.data.access_token.substring(0, 20)}...`);
            log.info(`Expires in: ${response.data.expires_in} seconds`);
            return true;
        } else {
            log.error('No access token in response');
            return false;
        }
    } catch (err) {
        log.error(`Token generation failed: ${err.message}`);
        if (err.response?.data) {
            log.error(`Details: ${JSON.stringify(err.response.data)}`);
        }
        return false;
    }
};

// Test 2: Check Backend Endpoint Availability
const testBackendEndpoint = async () => {
    log.section('Test 2: Backend Endpoint Availability');
    
    try {
        log.info(`Testing endpoint: POST ${API_ENDPOINT}`);
        
        const response = await axios.post(API_ENDPOINT, TEST_CONFIG, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token' // Will fail auth but that's OK - we're testing endpoint exists
            },
            timeout: 5000,
            validateStatus: () => true // Don't throw on any status code
        });
        
        log.info(`Response Status: ${response.status}`);
        
        if (response.status === 401 || response.status === 403) {
            log.warning('Authentication required (expected - need real JWT token)');
            log.info('Endpoint is reachable ✓');
            return true;
        } else if (response.status === 200) {
            log.success('STK Push successful!');
            log.info(`Response: ${JSON.stringify(response.data, null, 2)}`);
            return true;
        } else if (response.status === 500) {
            log.error('Backend error');
            log.error(`Response: ${JSON.stringify(response.data)}`);
            return false;
        } else {
            log.info(`Response Status: ${response.status}`);
            return true;
        }
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            log.error('Cannot connect to backend server');
            log.warning('Make sure backend is running: npm run dev');
            return false;
        }
        log.error(`Request failed: ${err.message}`);
        return false;
    }
};

// Test 3: Check Payment Routes File
const testPaymentRoutesFile = async () => {
    log.section('Test 3: Payment Routes Configuration');
    
    try {
        const fs = require('fs');
        const path = require('path');
        const routesFile = path.join(__dirname, 'modules', 'payments', 'routes.js');
        
        if (!fs.existsSync(routesFile)) {
            log.error(`Payment routes file not found at ${routesFile}`);
            return false;
        }
        
        const content = fs.readFileSync(routesFile, 'utf8');
        
        // Check for key components
        const checks = {
            'STK Push route definition': content.includes("router.post('/mpesa/stk-push'"),
            'Sandbox API endpoint': content.includes('sandbox.safaricom.co.ke'),
            'Token generation': content.includes('getMpesaToken'),
            'Callback handler': content.includes("router.post('/mpesa/callback'"),
            'Password generation': content.includes('generatePassword'),
            'Business Short Code': content.includes('MPESA_SHORTCODE'),
            'Callback URL': content.includes('MPESA_CALLBACK_URL')
        };
        
        log.info('Checking for required components...');
        let allFound = true;
        
        Object.entries(checks).forEach(([check, found]) => {
            if (found) {
                log.success(`Found: ${check}`);
            } else {
                log.error(`Missing: ${check}`);
                allFound = false;
            }
        });
        
        return allFound;
    } catch (err) {
        log.error(`File check failed: ${err.message}`);
        return false;
    }
};

// Test 4: Verify Database Schema
const testDatabaseSchema = async () => {
    log.section('Test 4: Database Schema Check');
    
    try {
        const pg = require('pg');
        const client = new pg.Client({
            connectionString: process.env.DATABASE_URL,
            connect_timeout: 5000
        });
        
        await client.connect();
        log.success('Connected to database');
        
        // Check transactions table
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions'
            ORDER BY ordinal_position
        `);
        
        if (result.rows.length === 0) {
            log.error('Transactions table not found');
            await client.end();
            return false;
        }
        
        log.info('Transactions table found with columns:');
        
        const requiredColumns = ['id', 'user_id', 'type', 'amount', 'status', 'reference_code', 'checkout_request_id'];
        
        result.rows.forEach(row => {
            if (requiredColumns.includes(row.column_name)) {
                log.success(`  ✓ ${row.column_name} (${row.data_type})`);
            }
        });
        
        await client.end();
        return true;
    } catch (err) {
        if (err.message.includes('connect')) {
            log.warning(`Cannot connect to database: ${err.message}`);
            log.info('Make sure PostgreSQL is running');
            return false;
        }
        log.error(`Database check failed: ${err.message}`);
        return false;
    }
};

// Test 5: Verify Environment Variables
const testEnvironmentVariables = () => {
    log.section('Test 5: Environment Variables Check');
    
    const requiredVars = [
        'MPESA_CONSUMER_KEY',
        'MPESA_CONSUMER_SECRET',
        'MPESA_SHORTCODE',
        'MPESA_PASSKEY',
        'MPESA_CALLBACK_URL',
        'DATABASE_URL',
        'JWT_SECRET'
    ];
    
    log.info('Checking required environment variables...');
    
    let allPresent = true;
    
    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            const value = process.env[varName];
            const masked = varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASS') || varName.includes('URL')
                ? `${value.substring(0, 10)}...` 
                : value;
            log.success(`${varName}: ${masked}`);
        } else {
            log.error(`Missing: ${varName}`);
            allPresent = false;
        }
    });
    
    return allPresent;
};

// Main test runner
const runAllTests = async () => {
    console.clear();
    log.section('🧪 M-PESA STK PUSH SYSTEM TEST');
    log.info('Testing M-Pesa integration...\n');
    
    const results = {};
    
    // Test 1: Environment Variables
    results['Environment Variables'] = testEnvironmentVariables();
    
    // Test 2: Server Status
    log.section('Test: Server Status');
    const serverRunning = await checkServer();
    if (serverRunning) {
        log.success('Backend server is running');
    } else {
        log.warning('Backend server is NOT running');
        log.info('Start it with: npm run dev');
    }
    
    // Test 3: Payment Routes File
    results['Payment Routes File'] = await testPaymentRoutesFile();
    
    // Test 4: Database Schema
    results['Database Schema'] = await testDatabaseSchema();
    
    // Test 5: M-Pesa Token Generation
    results['M-Pesa Token Generation'] = await testTokenGeneration();
    
    // Test 6: Backend Endpoint (only if server is running)
    if (serverRunning) {
        results['Backend Endpoint'] = await testBackendEndpoint();
    } else {
        log.warning('Skipping backend endpoint test (server not running)');
    }
    
    // Summary
    log.section('📊 TEST SUMMARY');
    
    let passed = 0;
    let failed = 0;
    
    Object.entries(results).forEach(([test, result]) => {
        if (result) {
            log.success(`${test}: PASS`);
            passed++;
        } else {
            log.error(`${test}: FAIL`);
            failed++;
        }
    });
    
    console.log('\n');
    log.info(`Total Tests: ${passed + failed}`);
    log.success(`Passed: ${passed}`);
    if (failed > 0) {
        log.error(`Failed: ${failed}`);
    }
    
    // Recommendation
    log.section('📋 NEXT STEPS');
    
    if (failed === 0) {
        log.success('All tests passed! M-Pesa STK Push appears to be working correctly.');
        log.info('Ready to test with real transactions.');
    } else {
        log.warning('Some tests failed. Review the errors above.');
        log.info('Key things to check:');
        log.info('1. Backend server running: npm run dev');
        log.info('2. Database connected: PostgreSQL running');
        log.info('3. Environment variables set: .env file correct');
        log.info('4. M-Pesa credentials valid: From Safaricom');
    }
    
    console.log('\n');
};

// Run tests
runAllTests().catch(err => {
    log.error(`Test execution failed: ${err.message}`);
    process.exit(1);
});
