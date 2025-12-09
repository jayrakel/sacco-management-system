# API Documentation: Dividends & Advanced Reports

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints require:
```
Header: Authorization: Bearer {jwt_token}
```

---

# DIVIDEND ENDPOINTS

## 1. Declare Dividend

**Endpoint:** `POST /dividends/declare`  
**Auth Required:** TREASURER, ADMIN  
**Rate Limit:** 200 req/5min

### Request
```json
{
  "financial_year": 2025,
  "dividend_rate": 5.5,
  "total_amount": 50000,
  "description": "Optional description"
}
```

### Response (201)
```json
{
  "success": true,
  "message": "Dividend declared successfully",
  "dividend": {
    "id": 1,
    "financial_year": 2025,
    "declaration_date": "2025-01-15T10:30:00Z",
    "dividend_rate": "5.50",
    "total_amount": "50000.00",
    "status": "PENDING",
    "declared_by": 5,
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### Errors
- `400`: Missing required fields
- `400`: Dividend already exists for this year
- `401`: Insufficient permissions
- `500`: Database error

---

## 2. Calculate Dividend Allocations

**Endpoint:** `POST /dividends/:dividendId/calculate`  
**Auth Required:** TREASURER, ADMIN  
**Rate Limit:** 200 req/5min  
**Parameters:** 
- `dividendId` (path, required): Dividend ID

### Request
```json
{
  "calculation_method": "SHARE_BASED"
}
```

### Calculation Methods
- `SHARE_BASED`: Allocate proportional to share capital
- `FIXED`: Allocate equally to all members

### Response (200)
```json
{
  "success": true,
  "message": "Dividend allocations calculated",
  "summary": {
    "total_members": 150,
    "total_share_capital": 1500000,
    "calculation_method": "SHARE_BASED",
    "total_dividend_amount": 50000,
    "allocations_count": 150
  }
}
```

### Algorithm (SHARE_BASED)
```
For each member:
  percentage = member_share_capital / total_share_capital
  allocation = total_dividend_amount * percentage
  Insert into dividend_allocations table
```

### Errors
- `404`: Dividend not found
- `400`: No active members with share capital
- `400`: Invalid calculation method
- `500`: Database transaction error

---

## 3. Approve Dividend

**Endpoint:** `POST /dividends/:dividendId/approve`  
**Auth Required:** ADMIN only  
**Rate Limit:** 200 req/5min  
**Parameters:**
- `dividendId` (path, required): Dividend ID

### Request
```json
{}
```

### Response (200)
```json
{
  "success": true,
  "message": "Dividend approved",
  "dividend": {
    "id": 1,
    "financial_year": 2025,
    "status": "APPROVED",
    "approval_date": "2025-01-15T11:00:00Z",
    "approved_by": 1
  }
}
```

### Errors
- `404`: Dividend not found
- `401`: Only ADMIN can approve
- `500`: Database error

---

## 4. Process Dividend Payments

**Endpoint:** `POST /dividends/:dividendId/process-payments`  
**Auth Required:** TREASURER, ADMIN  
**Rate Limit:** 200 req/5min  
**Parameters:**
- `dividendId` (path, required): Dividend ID

### Request
```json
{
  "payment_method": "INTERNAL"
}
```

### Payment Methods
- `INTERNAL`: Credit to member's general account (instant)
- `MPESA`: Queue for M-Pesa B2C (requires integration)
- `BANK`: Manual bank transfer

### Response (200)
```json
{
  "success": true,
  "message": "Processed 145/150 dividend payments",
  "processed_count": 145,
  "total_count": 150,
  "results": [
    {
      "allocation_id": 1,
      "status": "SUCCESS",
      "transaction_id": 12345
    },
    {
      "allocation_id": 2,
      "status": "PENDING_MPESA_TRANSFER",
      "payment_id": 1,
      "phone": "254712345678"
    },
    {
      "allocation_id": 3,
      "status": "FAILED",
      "error": "Member account inactive"
    }
  ]
}
```

### INTERNAL Payment Flow
```
For each pending allocation:
  1. Create CREDIT transaction for member
     - type: CREDIT
     - category: DIVIDEND
     - amount: allocation.dividend_amount
     - status: COMPLETED
  2. Update allocation to PAID
  3. Add to results array
```

### Errors
- `404`: Dividend not found
- `400`: No pending allocations
- `400`: Invalid payment method
- `500`: Transaction processing error

---

## 5. Get Dividend Details

**Endpoint:** `GET /dividends/:dividendId`  
**Auth Required:** Any authenticated user  
**Rate Limit:** 200 req/5min  
**Parameters:**
- `dividendId` (path, required): Dividend ID

### Response (200)
```json
{
  "dividend": {
    "id": 1,
    "financial_year": 2025,
    "dividend_rate": "5.50",
    "total_amount": "50000.00",
    "status": "PROCESSING",
    "allocation_count": 150,
    "paid_count": 145
  },
  "allocations": [
    {
      "id": 1,
      "member_id": 10,
      "full_name": "John Doe",
      "phone": "254712345678",
      "share_value": "10000.00",
      "dividend_amount": "333.33",
      "status": "PAID",
      "payment_date": "2025-01-15T12:00:00Z"
    }
  ],
  "calculation": {
    "id": 1,
    "total_members": 150,
    "total_share_capital": "1500000.00",
    "calculation_method": "SHARE_BASED",
    "calculated_by": 2,
    "calculation_date": "2025-01-15T11:30:00Z"
  }
}
```

### Errors
- `404`: Dividend not found
- `500`: Database error

---

## 6. List All Dividends

**Endpoint:** `GET /dividends`  
**Auth Required:** Any authenticated user  
**Rate Limit:** 200 req/5min  
**Query Parameters:**
- None (list all dividends)

### Response (200)
```json
[
  {
    "id": 1,
    "financial_year": 2025,
    "dividend_rate": "5.50",
    "total_amount": "50000.00",
    "status": "PROCESSING",
    "declared_by_name": "Admin User",
    "approved_by_name": "Chief Admin",
    "allocation_count": 150,
    "paid_count": 145
  },
  {
    "id": 2,
    "financial_year": 2024,
    "dividend_rate": "3.50",
    "total_amount": "35000.00",
    "status": "COMPLETED",
    "declared_by_name": "Admin User",
    "approved_by_name": "Chief Admin",
    "allocation_count": 142,
    "paid_count": 142
  }
]
```

### Errors
- `500`: Database error

---

## 7. Get Member Dividend History

**Endpoint:** `GET /dividends/member/:memberId/history`  
**Auth Required:** MEMBER (own) or ADMIN/TREASURER (any)  
**Rate Limit:** 200 req/5min  
**Parameters:**
- `memberId` (path, required): Member user ID

### Response (200)
```json
[
  {
    "id": 1,
    "member_id": 10,
    "dividend_id": 1,
    "financial_year": 2024,
    "dividend_rate": "3.50",
    "share_value": "10000.00",
    "dividend_amount": "350.00",
    "status": "PAID",
    "payment_method": "INTERNAL",
    "payment_date": "2024-12-20T10:00:00Z"
  }
]
```

### Errors
- `403`: Insufficient permissions (member trying to view other)
- `404`: Member not found
- `500`: Database error

---

# ADVANCED REPORTING ENDPOINTS

## Financial Reports

### 1. Balance Sheet

**Endpoint:** `GET /advanced-reports/financial/balance-sheet`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min  
**Query Parameters:**
- `date` (optional): Date for point-in-time report (YYYY-MM-DD)

### Response (200)
```json
{
  "report_type": "BALANCE_SHEET",
  "report_date": "2025-01-15",
  "assets": {
    "share_capital": "1500000.00",
    "member_savings": "3200000.00",
    "loans_outstanding": "5000000.00",
    "emergency_fund": "800000.00",
    "total": "10500000.00"
  },
  "liabilities": {
    "member_liabilities": "4500000.00",
    "total": "4500000.00"
  },
  "equity": "6000000.00",
  "total_liabilities_equity": "10500000.00"
}
```

---

### 2. Income Statement

**Endpoint:** `GET /advanced-reports/financial/income-statement`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min  
**Query Parameters:**
- `start_date` (optional): Start date (YYYY-MM-DD)
- `end_date` (optional): End date (YYYY-MM-DD)
- Default: Last 30 days

### Response (200)
```json
{
  "report_type": "INCOME_STATEMENT",
  "period": {
    "start": "2024-12-15",
    "end": "2025-01-15"
  },
  "revenue": {
    "interest_earned": "450000.00",
    "total": "450000.00"
  },
  "expenses": {
    "penalties": "25000.00",
    "dividends_paid": "75000.00",
    "total": "100000.00"
  },
  "net_income": "350000.00",
  "profit_margin": "77.78%"
}
```

---

### 3. Cash Flow

**Endpoint:** `GET /advanced-reports/financial/cash-flow`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min  
**Query Parameters:**
- `start_date` (optional): Start date (YYYY-MM-DD)
- `end_date` (optional): End date (YYYY-MM-DD)

### Response (200)
```json
{
  "report_type": "CASH_FLOW",
  "period": {
    "start": "2024-12-15",
    "end": "2025-01-15"
  },
  "operating_activities": {
    "inflow": {
      "member_deposits": "2000000.00",
      "loan_repayments": "1500000.00",
      "total": "3500000.00"
    },
    "outflow": {
      "withdrawals": "800000.00",
      "loan_disbursements": "2500000.00",
      "total": "3300000.00"
    },
    "net": "200000.00"
  },
  "investing_activities": {
    "outflow": {
      "dividend_distributions": "75000.00",
      "total": "75000.00"
    },
    "net": "-75000.00"
  },
  "net_cash_flow": "125000.00"
}
```

---

## Analytics Reports

### 4. Loan Analytics

**Endpoint:** `GET /advanced-reports/analytics/loans`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min

### Response (200)
```json
{
  "summary": {
    "active_loans": 85,
    "total_loans": 230,
    "total_portfolio": "5000000.00",
    "total_repaid": "3200000.00",
    "total_defaulted": "150000.00",
    "total_overdue": "320000.00"
  },
  "ratios": {
    "default_rate": "3.0%",
    "overdue_rate": "6.4%",
    "repayment_rate": "96.5%"
  },
  "averages": {
    "average_loan": "21739.13",
    "average_interest": "2156.52",
    "average_term_days": 365
  }
}
```

---

### 5. Deposit Analytics

**Endpoint:** `GET /advanced-reports/analytics/deposits`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min

### Response (200)
```json
{
  "summary": {
    "total_members": 150,
    "total_deposits": 4800,
    "total_amount": "5200000.00"
  },
  "by_category": {
    "share_capital": "1500000.00",
    "emergency_fund": "800000.00",
    "welfare": "250000.00"
  },
  "averages": {
    "average_deposit": "1083.33",
    "average_per_member": "34666.67"
  }
}
```

---

### 6. Member Performance

**Endpoint:** `GET /advanced-reports/member-performance`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min  
**Query Parameters:**
- `limit` (optional, default 20): Records per page
- `offset` (optional, default 0): Pagination offset

### Response (200)
```json
[
  {
    "id": 5,
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "254712345678",
    "total_deposits": 45,
    "total_deposit_amount": "85000.00",
    "active_loans": 1,
    "completed_loans": 3,
    "defaulted_amount": "0.00",
    "repayments": 8,
    "total_repaid": "15000.00",
    "account_status": "ACTIVE"
  }
]
```

---

### 7. Transaction Summary

**Endpoint:** `GET /advanced-reports/transaction-summary`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min  
**Query Parameters:**
- `period` (optional, default 'daily'): 'daily', 'weekly', 'monthly'
- `start_date` (optional): Start date (YYYY-MM-DD)
- `end_date` (optional): End date (YYYY-MM-DD)

### Response (200)
```json
{
  "period_type": "daily",
  "date_range": {
    "start": "2024-12-15",
    "end": "2025-01-15"
  },
  "summary": [
    {
      "period": "2025-01-15",
      "inflow": "125000.00",
      "outflow": "85000.00",
      "net_flow": "40000.00",
      "transaction_count": 45,
      "unique_members": 40,
      "depositors": 30,
      "withdrawers": 10
    }
  ]
}
```

---

## Export Endpoints

### 8. Export Report

**Endpoint:** `GET /advanced-reports/export/:reportType`  
**Auth Required:** ADMIN, TREASURER, CHAIRPERSON  
**Rate Limit:** 200 req/5min  
**Parameters:**
- `reportType` (path, required): 'balance-sheet', 'income-statement', 'loans', 'deposits'

**Query Parameters:**
- `format` (optional, default 'json'): 'json', 'csv'
- `start_date` (optional): For period-based reports
- `end_date` (optional): For period-based reports

### Response (200 - CSV)
```
Header: Content-Type: text/csv
Header: Content-Disposition: attachment; filename="loans_report_2025-01-15.csv"
Body: CSV-formatted data
```

### Response (200 - JSON)
```json
{
  "report_type": "loans",
  "data": { ... }
}
```

### Errors
- `501`: PDF format not yet implemented
- `400`: Invalid report type
- `500`: Export generation error

---

## Error Response Format

All errors return JSON:
```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes
- `200`: Success
- `201`: Resource created
- `400`: Bad request (invalid params)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient role)
- `404`: Not found
- `500`: Server error
- `501`: Not implemented

---

## Rate Limiting

All endpoints are rate limited:
- **Limit:** 200 requests per 5 minutes per user
- **Response Header:** `X-RateLimit-Remaining`

When limit exceeded:
```
Status: 429 Too Many Requests
Body: { error: "Too many requests. Try again later." }
```

---

## Pagination

For endpoints returning lists (member performance):
```
GET /endpoint?limit=20&offset=0
```

- `limit`: Records per page (default 20, max 100)
- `offset`: Number of records to skip (default 0)

---

## Date Formats

- **Query Parameters:** `YYYY-MM-DD` (e.g., `2025-01-15`)
- **Response Fields:** ISO 8601 (e.g., `2025-01-15T10:30:00Z`)

---

## Examples Using cURL

### Declare Dividend
```bash
curl -X POST http://localhost:5000/api/dividends/declare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "financial_year": 2025,
    "dividend_rate": 5.5,
    "total_amount": 50000,
    "description": "Annual dividend"
  }'
```

### Get Balance Sheet
```bash
curl -X GET http://localhost:5000/api/advanced-reports/financial/balance-sheet \
  -H "Authorization: Bearer eyJhbGc..."
```

### Get Loan Analytics
```bash
curl -X GET http://localhost:5000/api/advanced-reports/analytics/loans \
  -H "Authorization: Bearer eyJhbGc..."
```

### Export Report as CSV
```bash
curl -X GET "http://localhost:5000/api/advanced-reports/export/loans?format=csv" \
  -H "Authorization: Bearer eyJhbGc..." \
  -o loans_report.csv
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-01-15 | Initial release - Dividends & Advanced Reports |

---

**Last Updated:** January 15, 2025  
**API Status:** ✅ Stable  
**Maintained By:** Sacco Development Team
