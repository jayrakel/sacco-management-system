const db = require('../../db');

const getSetting = async (key) => {
    const res = await db.query("SELECT setting_value FROM system_settings WHERE setting_key = $1", [key]);
    return res.rows.length > 0 ? res.rows[0].setting_value : null;
};

const runComplianceCheck = async () => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const minDepositVal = await getSetting('min_weekly_deposit');
        const penaltyVal = await getSetting('penalty_missed_savings');
        const minDeposit = parseFloat(minDepositVal) || 250;
        const penaltyAmount = parseFloat(penaltyVal) || 50;

        const complianceQuery = `
            SELECT u.id, u.full_name 
            FROM users u
            WHERE u.role = 'MEMBER' AND u.is_active = TRUE
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'DEPOSIT' AND status = 'COMPLETED'
                AND created_at >= date_trunc('week', CURRENT_DATE)
                GROUP BY user_id HAVING SUM(amount) >= $1
            )
            AND u.id NOT IN (
                SELECT user_id FROM transactions 
                WHERE type = 'FINE' AND description LIKE 'Missed Weekly Deposit%'
                AND created_at >= date_trunc('week', CURRENT_DATE)
            )
        `;

        const nonCompliant = await client.query(complianceQuery, [minDeposit]);
        
        if (nonCompliant.rows.length === 0) {
            await client.query('ROLLBACK');
            return { success: true, message: "Everyone is compliant!", count: 0 };
        }

        const weekStr = new Date().toLocaleDateString('en-GB', { week: 'numeric', year: 'numeric' });
        let deductedCount = 0;

        for (const user of nonCompliant.rows) {
            const ref = `AUTO-FINE-${user.id}-${Date.now().toString().slice(-6)}`;
            await client.query(
                `INSERT INTO transactions (user_id, type, amount, reference_code, description, status) 
                 VALUES ($1, 'FINE', $2, $3, $4, 'COMPLETED')`,
                [user.id, penaltyAmount, ref, `Missed Weekly Deposit (Week ${weekStr})`]
            );
            const savingsRes = await client.query("SELECT SUM(amount) as total FROM deposits WHERE user_id = $1", [user.id]);
            if (parseFloat(savingsRes.rows[0].total || 0) > 0) {
                await client.query(
                    `INSERT INTO deposits (user_id, amount, type, transaction_ref, status) 
                     VALUES ($1, $2, 'DEPOSIT', $3, 'COMPLETED')`,
                    [user.id, -penaltyAmount, `DEDUCT-${ref}`]
                );
                deductedCount++;
            }
        }
        await client.query('COMMIT');
        return { success: true, message: `Fined ${nonCompliant.rows.length} members.`, count: nonCompliant.rows.length };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { runComplianceCheck };