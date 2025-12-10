#!/bin/bash

# Test script for Advanced Reporting API endpoints
# Usage: ./test-advanced-reports.sh [TOKEN]

TOKEN="${1:-your_bearer_token_here}"
BASE_URL="http://localhost:5000"

echo "🧪 Testing Advanced Reporting Endpoints..."
echo "==========================================\n"

# Test 1: Balance Sheet
echo "1️⃣  Testing Balance Sheet..."
curl -s -X GET "$BASE_URL/api/advanced-reports/financial/balance-sheet" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq . || echo "❌ Balance Sheet test failed"

echo "\n---\n"

# Test 2: Income Statement
echo "2️⃣  Testing Income Statement..."
curl -s -X GET "$BASE_URL/api/advanced-reports/financial/income-statement?start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq . || echo "❌ Income Statement test failed"

echo "\n---\n"

# Test 3: Cash Flow
echo "3️⃣  Testing Cash Flow..."
curl -s -X GET "$BASE_URL/api/advanced-reports/financial/cash-flow?start_date=2024-01-01&end_date=2024-12-31" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq . || echo "❌ Cash Flow test failed"

echo "\n---\n"

# Test 4: Loan Analytics
echo "4️⃣  Testing Loan Analytics..."
curl -s -X GET "$BASE_URL/api/advanced-reports/analytics/loans" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq . || echo "❌ Loan Analytics test failed"

echo "\n---\n"

# Test 5: Deposit Analytics
echo "5️⃣  Testing Deposit Analytics..."
curl -s -X GET "$BASE_URL/api/advanced-reports/analytics/deposits" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq . || echo "❌ Deposit Analytics test failed"

echo "\n==========================================\n"
echo "✅ Testing complete!"
