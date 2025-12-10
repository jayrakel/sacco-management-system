# Quick Start: Dividend Distribution & Advanced Reporting

## Dividend Distribution - 5-Minute Setup

### Step 1: Database Migration
The schema is auto-created on backend start. Check database for these tables:
```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'dividend%';
```

### Step 2: Access the UI
Navigate to: **Admin Dashboard → Dividends**

### Step 3: Declare a Dividend
```javascript
// In DividendDashboard component
- Fill: Financial Year, Dividend Rate (%), Total Amount, Description
- Click: "Declare Dividend"
- Status changes to: PENDING
```

### Step 4: Calculate Allocations
```javascript
- Click "Calculate" button on dividend row
- Method: SHARE_BASED (proportional to each member's shares)
- System processes all active members
- Creates allocation records per member
```

### Step 5: Approve & Pay
```javascript
- Click "Approve" (Admin only)
- Click "Pay Internal" to credit member accounts
- Or "Pay M-Pesa" to queue for M-Pesa transfers
```

### Workflow Diagram
```
Declare (PENDING)
    ↓
Calculate (allocations created)
    ↓
Approve (APPROVED)
    ↓
Process Payments (COMPLETED)
    ↓
Members see dividend in their account
```

### API Call Examples

**Declare Dividend:**
```bash
POST /api/dividends/declare
{
  "financial_year": 2025,
  "dividend_rate": 5.5,
  "total_amount": 50000,
  "description": "Annual dividend FY2025"
}
```

**Calculate:**
```bash
POST /api/dividends/1/calculate
{ "calculation_method": "SHARE_BASED" }
```

**Pay:**
```bash
POST /api/dividends/1/process-payments
{ "payment_method": "INTERNAL" }
```

---

## Advanced Reporting - 5-Minute Setup

### Step 1: Access the UI
Navigate to: **Admin Dashboard → Reports**

### Step 2: Choose Report Type
Click any of:
- **Balance Sheet** - Assets, Liabilities, Equity snapshot
- **Income Statement** - Revenue, Expenses, Net Income
- **Cash Flow** - Operating, Investing activities
- **Loan Analytics** - Portfolio health, default rates
- **Deposit Analytics** - Member savings breakdown

### Step 3: Set Date Range
- From: Start date for analysis
- To: End date for analysis
- System auto-refreshes on date change

### Step 4: Analyze Metrics
Each report shows:
- Summary cards (total amounts, key ratios)
- Detailed breakdown tables
- Visual charts and graphs
- Comparison metrics

### Step 5: Export Data
Click **"Export CSV"** to download spreadsheet for further analysis

### Report Descriptions

**Balance Sheet**
- Shows financial position at a point in time
- Assets: Share capital, member savings, outstanding loans
- Liabilities & Equity: What SACCO owes vs owns

**Income Statement**
- Shows profit/loss over a period
- Revenue: Interest earned from loans
- Expenses: Penalties, dividends paid
- Net Income: Profit/loss for period

**Cash Flow**
- Shows money movement in/out
- Operating: Daily business cash flow
- Investing: Dividend distributions
- Net: Overall cash position change

**Loan Analytics**
- Key metrics: Active loans, default rate, repayment rate
- Status breakdown: Active vs Completed vs Defaulted
- Averages: Typical loan size, interest, term length

**Deposit Analytics**
- Member participation: Total members, deposit count
- Breakdown by category: Share capital, emergency fund, welfare
- Per-member averages

### API Call Examples

**Balance Sheet:**
```bash
GET /api/advanced-reports/financial/balance-sheet
```

**Loans (last 12 months):**
```bash
GET /api/advanced-reports/analytics/loans
```

**Cash Flow (date range):**
```bash
GET /api/advanced-reports/financial/cash-flow?start_date=2025-01-01&end_date=2025-01-31
```

**Export:**
```bash
GET /api/advanced-reports/export/loans?format=csv
```

---

## Typical Use Cases

### Use Case 1: Declare Dividend to Members
1. Chairperson calculates available profit
2. Admin declares dividend with amount
3. System calculates per-member allocation
4. Admin reviews and approves
5. Treasurer processes payment to all members
6. Members see credit in their account

### Use Case 2: Check System Health
1. Open Advanced Reports
2. View Balance Sheet (Is system solvent?)
3. View Loan Analytics (Are loans being repaid?)
4. View Income Statement (Is system profitable?)
5. Export and share with board

### Use Case 3: Member Due Diligence
1. Open Member Performance report
2. Search for specific member
3. View: Total deposits, loans, repayments, account status
4. Check dividend history (Member → Dividend History)
5. Make lending decisions based on track record

### Use Case 4: Cash Flow Planning
1. Open Cash Flow report
2. Set date range for analysis period
3. Review inflow (deposits, loan repayments)
4. Review outflow (withdrawals, loan disbursements)
5. Plan for liquidity needs

---

## Key Features

### Dividend System
- ✅ Multiple calculation methods (Share-based, Fixed)
- ✅ Member share value tracking
- ✅ Multiple payment methods (Internal, M-Pesa, Bank)
- ✅ Audit trail of all calculations
- ✅ Retry logic for failed payments
- ✅ Member dividend history access

### Reporting System
- ✅ Real-time calculations (no lag)
- ✅ Flexible date ranges
- ✅ Financial reports (Balance Sheet, Income, Cash Flow)
- ✅ Business analytics (Loans, Deposits, Members)
- ✅ CSV export for spreadsheet analysis
- ✅ Dashboard visualizations
- ✅ Role-based access control
- ✅ Responsive design

---

## Permissions

### Dividend System
| Action | Role Required |
|--------|---------------|
| Declare Dividend | TREASURER, ADMIN |
| Calculate | TREASURER, ADMIN |
| Approve | ADMIN only |
| Process Payments | TREASURER, ADMIN |
| View Own History | MEMBER |
| View All | ADMIN, TREASURER |

### Reporting System
| Report | Role Required |
|--------|---------------|
| Balance Sheet | ADMIN, TREASURER, CHAIRPERSON |
| Income Statement | ADMIN, TREASURER, CHAIRPERSON |
| Loan Analytics | ADMIN, TREASURER, CHAIRPERSON |
| Deposit Analytics | ADMIN, TREASURER, CHAIRPERSON |
| Member Performance | ADMIN, TREASURER, CHAIRPERSON |
| Export Reports | ADMIN, TREASURER, CHAIRPERSON |

---

## Troubleshooting

### Dividend Calculation Shows 0 Members
**Issue:** No active members with share capital  
**Solution:** 
1. Ensure members have made share capital deposits
2. Check member status is ACTIVE
3. Verify deposits have category = 'SHARE_CAPITAL'

### Report Returns No Data
**Issue:** No transactions in selected date range  
**Solution:**
1. Expand date range
2. Check transactions exist in database
3. Verify transaction status = 'COMPLETED'

### Permission Denied on Report
**Issue:** User role insufficient  
**Solution:**
1. Only ADMIN, TREASURER, CHAIRPERSON can access
2. Contact system administrator for role upgrade

### Payment Processing Hangs
**Issue:** M-Pesa integration timeout  
**Solution:**
1. Use INTERNAL payment method instead
2. Manual M-Pesa processing coming soon
3. Check M-Pesa credentials in .env

---

## Next Enhancements

1. **PDF Export** for formal reports
2. **Scheduled Reports** via email
3. **M-Pesa B2C Integration** for dividend payments
4. **Dashboard Widgets** for quick metrics
5. **Year-over-Year Comparison** charts
6. **Member Email Notifications** when dividend paid
7. **API Rate Limiting** for large exports
8. **Report Scheduling** (monthly, quarterly, annual)

---

## Important Notes

1. **Share-Based Allocation:** 
   - Members get dividend proportional to their share capital
   - High contributers get larger dividends
   - Encourages equity investment

2. **Fixed Allocation:**
   - All members get equal dividend
   - Simpler but less rewarding to high contributors
   - Good for solidarity dividends

3. **Payment Methods:**
   - INTERNAL: Immediate, no external fees
   - MPESA: Direct to phone, requires M-Pesa B2C setup
   - BANK: Via bank transfer, slower

4. **Reporting Real-Time:**
   - All calculations done on-demand
   - No delayed data processing
   - Safe for board meetings

---

**Status:** ✅ Both features fully implemented and ready for production
**Last Updated:** December 9, 2025
**Version:** 1.0
