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
        // Users who are MEMBERS + Active + Haven't saved enough this week
        const complianceQuery = `
            SELECT u.id, u.full_name 
            FROM users u
            WHERE u.role = 'MEMBER'
            AND u.is_active = TRUE
            -- Exclude users who have saved enough
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'DEPOSIT' 
                AND status = 'COMPLETED' 
                AND created_at >= date_trunc('week', CURRENT_DATE)
                GROUP BY user_id
                HAVING SUM(amount) >= $1
            )
            -- Exclude users already fined this week (Check member_fines table instead of transactions)
            AND u.id NOT IN (
                SELECT user_id FROM member_fines 
                WHERE title LIKE 'Missed Weekly Deposit%'
                AND date_created >= date_trunc('week', CURRENT_DATE)
            )
        `;

        const nonCompliant = await client.query(complianceQuery, [minDeposit]);
        
        if (nonCompliant.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: true, message: "Compliance Check Complete. Everyone is safe!", count: 0 };
        }

        // 3. Apply Fines (INSERT INTO member_fines ONLY)
        const weekStr = new Date().toLocaleDateString('en-GB', { week: 'numeric', year: 'numeric' });

        for (const user of nonCompliant.rows) {
            // Create a pending fine record. 
            // The 'fines/routes.js' logic will automatically pick this up later to apply interest rules.
            await client.query(
                `INSERT INTO member_fines (user_id, title, original_amount, current_balance, description, status)
                 VALUES ($1, $2, $3, $3, $4, 'PENDING')`,
                [
                    user.id, 
                    `Missed Weekly Deposit`, 
                    penaltyAmount, 
                    `Automatic penalty for missing minimum weekly deposit of ${minDeposit} for week ${weekStr}`
                ]
            );
        }

        await client.query('COMMIT');
        return { 
            success: true, 
            message: `Checked Week of ${new Date().toLocaleDateString()}. Imposed fines on ${nonCompliant.rows.length} members.`, 
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