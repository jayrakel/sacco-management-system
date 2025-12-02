const db = require('../../db');

// Helper to get settings safely
const getSetting = async (key) => {
    const res = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [key]);
    return res.rows.length > 0 ? res.rows[0].setting_value : null;
};

const runComplianceCheck = async () => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get Settings
        const minDepositVal = await getSetting('min_weekly_deposit');
        const penaltyVal = await getSetting('penalty_missed_savings');
        const minDeposit = parseFloat(minDepositVal) || 250;
        const penaltyAmount = parseFloat(penaltyVal) || 50;

        console.log(`🔄 Compliance Check Started. Min Goal: ${minDeposit}, Fine: ${penaltyAmount}`);

        // 2. Find Non-Compliant Users
        // LOGIC: Users who are MEMBERS + Active AND (Have NOT saved enough THIS week OR Have NO deposits this week)
        // We also check if they have ALREADY been fined this week to avoid double-fining.
        const complianceQuery = `
            SELECT u.id, u.full_name 
            FROM users u
            WHERE u.role = 'MEMBER'
            AND u.is_active = TRUE
            -- Exclude users who have saved enough
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'DEPOSIT' 
                AND status = 'COMPLETED' -- FIX: Only count completed transactions
                AND created_at >= date_trunc('week', CURRENT_DATE) -- Starts from Monday 00:00
                GROUP BY user_id
                HAVING SUM(amount) >= $1
            )
            -- Exclude users already fined this week
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'FINE' 
                AND description LIKE 'Missed Weekly Deposit%'
                AND created_at >= date_trunc('week', CURRENT_DATE)
            )
        `;

        const nonCompliant = await client.query(complianceQuery, [minDeposit]);
        
        if (nonCompliant.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: true, message: "Compliance Check Complete. Everyone is safe!", count: 0 };
        }

        // 3. Apply Fines
        const weekStr = new Date().toLocaleDateString('en-GB', { week: 'numeric', year: 'numeric' });
        let deductedCount = 0;

        for (const user of nonCompliant.rows) {
            const ref = `AUTO-FINE-${user.id}-${Date.now().toString().slice(-6)}`;
            
            // A. Record Fine
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, reference_code, description, status) 
                 VALUES ($1, 'FINE', $2, $3, $4, 'COMPLETED')`,
                [user.id, penaltyAmount, ref, `Missed Weekly Deposit (Week ${weekStr})`]
            );

            // B. Check Savings Balance
            const savingsRes = await client.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1", [user.id]);
            const currentSavings = parseFloat(savingsRes.rows[0].total || 0);

            // C. Auto-Deduct if possible
            if (currentSavings > 0) {
                await client.query(
                    `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                     VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`, // Negative deposit
                    [user.id, -penaltyAmount, `DEDUCT-${ref}`]
                );
                deductedCount++;
            }
        }

        await client.query('COMMIT');
        return { 
            success: true, 
            message: `Checked Week of ${new Date().toLocaleDateString()}. Fined ${nonCompliant.rows.length} members.`, 
            count: nonCompliant.rows.length 
        };

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Compliance Logic Error:", err);
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { runComplianceCheck };