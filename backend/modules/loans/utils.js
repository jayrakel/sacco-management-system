// backend/modules/loans/utils.js

function calculateLoanSchedule(loan) {
    const schedule = {
        weekly_installment: 0,
        weeks_passed: 0,
        weeks_remaining: parseInt(loan.repayment_weeks || 0),
        expected_to_date: 0,
        amount_repaid: parseFloat(loan.amount_repaid || 0),
        running_balance: 0, // This represents the Pre-payment (if positive) or Arrears (if negative)
        status_text: 'Inactive',
        in_grace_period: false,
        grace_days_left: 0
    };

    const totalDue = parseFloat(loan.total_due || 0);
    
    if (loan.status === 'ACTIVE' && loan.disbursed_at && totalDue > 0) {
        const now = new Date();
        const start = new Date(loan.disbursed_at);
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        const oneDayMs = 24 * 60 * 60 * 1000;

        // Weekly Installment
        const weeklyAmount = totalDue / schedule.weeks_remaining;
        schedule.weekly_installment = weeklyAmount;

        // Time calculations
        const elapsedMs = now - start;
        const graceWeeks = parseInt(loan.grace_period_weeks || 0);
        const gracePeriodMs = graceWeeks * oneWeekMs;

        if (elapsedMs < gracePeriodMs) {
            // IN GRACE PERIOD
            schedule.in_grace_period = true;
            schedule.grace_days_left = Math.ceil((gracePeriodMs - elapsedMs) / oneDayMs);
            schedule.status_text = 'IN GRACE PERIOD';
            
            // LOGIC: No installment expected. All paid amount is "Pre-payment".
            schedule.expected_to_date = 0;
            schedule.running_balance = schedule.amount_repaid; 
        } else {
            // ACTIVE REPAYMENT
            const activeTimeMs = elapsedMs - gracePeriodMs;
            
            // Weeks passed strictly AFTER grace period
            // If 1 day passed after grace, 0 weeks complete, but usually current week is due?
            // Standard practice: "Due at end of week". So 0 weeks passed = 0 due.
            const weeksPassed = Math.floor(activeTimeMs / oneWeekMs);
            
            schedule.weeks_passed = weeksPassed;
            schedule.weeks_remaining = Math.max(0, schedule.weeks_remaining - weeksPassed);

            // LOGIC: Automatic Application
            // Expected = Weeks Passed * Weekly Amount
            const amountExpectedSoFar = weeksPassed * weeklyAmount;
            
            schedule.expected_to_date = amountExpectedSoFar;
            
            // Running Balance = Total Paid - Expected
            // If User paid 5000, and Expected is 1000: Balance is +4000 (Pre-payment covers next 4 weeks)
            schedule.running_balance = schedule.amount_repaid - amountExpectedSoFar;
            
            schedule.status_text = schedule.running_balance < 0 ? 'IN ARREARS' : 'ON TRACK';
        }
    }

    return schedule;
}

module.exports = { calculateLoanSchedule };