// backend/modules/loans/utils.js

function calculateLoanSchedule(loan) {
    const totalDue = parseFloat(loan.total_due || 0);
    const repaymentWeeks = parseInt(loan.repayment_weeks || 1); // Avoid division by zero
    
    const schedule = {
        weekly_installment: 0,
        weeks_passed: 0,
        weeks_remaining: repaymentWeeks,
        expected_to_date: 0,
        amount_repaid: parseFloat(loan.amount_repaid || 0),
        running_balance: 0, 
        arrears: 0,       // Derived for display
        pre_payment: 0,   // Derived for display
        status_text: 'Inactive',
        in_grace_period: false,
        grace_days_left: 0
    };

    if (loan.status === 'ACTIVE' && loan.disbursed_at && totalDue > 0) {
        const now = new Date();
        const start = new Date(loan.disbursed_at);
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const oneDayMs = 24 * 60 * 60 * 1000;

        // 1. Calculate Required Weekly Installment
        // Logic: Total Loan / Total Weeks (Fixed amount per week)
        const weeklyAmount = totalDue / repaymentWeeks;
        schedule.weekly_installment = weeklyAmount;

        // 2. Time Calculations
        const elapsedMs = now - start;
        const graceWeeks = parseInt(loan.grace_period_weeks || 0);
        const gracePeriodMs = graceWeeks * oneWeekMs;

        if (elapsedMs < gracePeriodMs) {
            // --- GRACE PERIOD ACTIVE ---
            schedule.in_grace_period = true;
            schedule.grace_days_left = Math.ceil((gracePeriodMs - elapsedMs) / oneDayMs);
            schedule.status_text = 'IN GRACE PERIOD';
            
            // In grace period, nothing is "expected". All payments are pre-payments.
            schedule.expected_to_date = 0;
            schedule.running_balance = schedule.amount_repaid; 

        } else {
            // --- ACTIVE REPAYMENT PHASE ---
            const activeTimeMs = elapsedMs - gracePeriodMs;
            
            // Weeks Passed: How many full weeks have elapsed since grace period ended?
            // Floor is used because an installment is due only at the "end" of the week.
            const weeksPassed = Math.floor(activeTimeMs / oneWeekMs);
            
            schedule.weeks_passed = weeksPassed;
            schedule.weeks_remaining = Math.max(0, repaymentWeeks - weeksPassed);

            // 3. Calculate Expectations
            // Expected = Number of weeks passed * Weekly Installment Amount
            // Example: Week 3 passed, Weekly is 1000. Expected = 3000.
            const amountExpectedSoFar = weeksPassed * weeklyAmount;
            schedule.expected_to_date = amountExpectedSoFar;
            
            // 4. Calculate Running Balance (The Single Source of Truth)
            // Positive = Pre-payment (User paid more than expected)
            // Negative = Arrears (User paid less than expected)
            schedule.running_balance = schedule.amount_repaid - amountExpectedSoFar;
            
            // 5. Determine Status Text
            if (schedule.running_balance < -1) { // -1 buffer for float decimals
                schedule.status_text = 'IN ARREARS';
            } else if (schedule.running_balance > 1) {
                schedule.status_text = 'AHEAD OF SCHEDULE';
            } else {
                schedule.status_text = 'ON TRACK';
            }
        }

        // 6. Derive Arrears and Pre-payment for Frontend Display
        if (schedule.running_balance < 0) {
            schedule.arrears = Math.abs(schedule.running_balance);
            schedule.pre_payment = 0;
        } else {
            schedule.arrears = 0;
            schedule.pre_payment = schedule.running_balance;
        }
    }

    return schedule;
}

module.exports = { calculateLoanSchedule };