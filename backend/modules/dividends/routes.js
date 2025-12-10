const express = require('express');
const { authenticateUser, authorizeRoles } = require('../auth/middleware');
const router = express.Router();
const db = require('../../db');

// ========================================
// 1. DECLARE DIVIDEND (Admin/Treasurer)
// ========================================
router.post('/declare', authenticateUser, authorizeRoles('ADMIN', 'TREASURER'), async (req, res) => {
  try {
    const { financial_year, dividend_rate, total_amount, description } = req.body;

    // Validate input
    if (!financial_year || !dividend_rate || !total_amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if dividend already exists for this year
    const existing = await db.query(
      'SELECT id FROM dividends WHERE financial_year = $1 AND status != $2',
      [financial_year, 'CANCELLED']
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Dividend already declared for this year' });
    }

    // Insert dividend
    const result = await db.query(
      `INSERT INTO dividends 
       (financial_year, dividend_rate, total_amount, status, declared_by, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [financial_year, dividend_rate, total_amount, 'PENDING', req.user.id, description]
    );

    res.json({
      success: true,
      message: 'Dividend declared successfully',
      dividend: result.rows[0]
    });
  } catch (error) {
    console.error('Declare dividend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 2. CALCULATE DIVIDEND ALLOCATIONS
// ========================================
router.post('/:dividendId/calculate', authenticateUser, authorizeRoles('ADMIN', 'TREASURER'), async (req, res) => {
  try {
    const { dividendId } = req.params;
    const { calculation_method } = req.body; // SHARE_BASED, FIXED, HYBRID

    // Get dividend details
    const dividendRes = await db.query(
      'SELECT * FROM dividends WHERE id = $1',
      [dividendId]
    );

    if (dividendRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dividend not found' });
    }

    const dividend = dividendRes.rows[0];

    // Get all active members with their share capital
    const membersRes = await db.query(
      `SELECT u.id, u.full_name, u.phone,
              COALESCE(SUM(CASE WHEN d.category = 'SHARE_CAPITAL' THEN d.amount ELSE 0 END), 0) as share_capital
       FROM users u
       LEFT JOIN deposits d ON u.id = d.member_id AND d.status = 'COMPLETED'
       WHERE u.role = 'MEMBER' AND u.is_active = true
       GROUP BY u.id, u.full_name, u.phone
       HAVING COALESCE(SUM(CASE WHEN d.category = 'SHARE_CAPITAL' THEN d.amount ELSE 0 END), 0) > 0`
    );

    const members = membersRes.rows;

    if (members.length === 0) {
      return res.status(400).json({ error: 'No active members with share capital found' });
    }

    // Calculate total share capital
    const totalShareCapital = members.reduce((sum, m) => sum + parseFloat(m.share_capital), 0);

    // Calculate allocations based on method
    let allocations = [];

    if (calculation_method === 'SHARE_BASED') {
      // Distribute based on share capital percentage
      members.forEach(member => {
        const percentage = parseFloat(member.share_capital) / totalShareCapital;
        const allocation = dividend.total_amount * percentage;
        allocations.push({
          member_id: member.id,
          share_value: parseFloat(member.share_capital),
          dividend_amount: allocation
        });
      });
    } else if (calculation_method === 'FIXED') {
      // Distribute equally to all members
      const perMember = dividend.total_amount / members.length;
      members.forEach(member => {
        allocations.push({
          member_id: member.id,
          share_value: parseFloat(member.share_capital),
          dividend_amount: perMember
        });
      });
    } else {
      return res.status(400).json({ error: 'Invalid calculation method' });
    }

    // Insert allocations in transaction
    await db.query('BEGIN');

    try {
      // Insert all allocations
      for (const allocation of allocations) {
        await db.query(
          `INSERT INTO dividend_allocations 
           (dividend_id, member_id, share_value, dividend_amount, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [dividendId, allocation.member_id, allocation.share_value, allocation.dividend_amount, 'PENDING']
        );
      }

      // Insert calculation record
      await db.query(
        `INSERT INTO dividend_calculations 
         (dividend_id, total_members, total_share_capital, dividend_rate, total_dividend_amount, calculation_method, calculated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [dividendId, members.length, totalShareCapital, dividend.dividend_rate, dividend.total_amount, calculation_method, req.user.id]
      );

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Dividend allocations calculated',
        summary: {
          total_members: members.length,
          total_share_capital: totalShareCapital,
          calculation_method,
          total_dividend_amount: dividend.total_amount,
          allocations_count: allocations.length
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Calculate dividend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 3. APPROVE DIVIDEND (Admin only)
// ========================================
router.post('/:dividendId/approve', authenticateUser, authorizeRoles('ADMIN'), async (req, res) => {
  try {
    const { dividendId } = req.params;

    const result = await db.query(
      `UPDATE dividends 
       SET status = $1, approval_date = CURRENT_TIMESTAMP, approved_by = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      ['APPROVED', req.user.id, dividendId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dividend not found' });
    }

    res.json({
      success: true,
      message: 'Dividend approved',
      dividend: result.rows[0]
    });
  } catch (error) {
    console.error('Approve dividend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 4. GET DIVIDEND DETAILS
// ========================================
router.get('/:dividendId', authenticateUser, async (req, res) => {
  try {
    const { dividendId } = req.params;

    // Get dividend
    const dividendRes = await db.query(
      'SELECT * FROM dividends WHERE id = $1',
      [dividendId]
    );

    if (dividendRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dividend not found' });
    }

    // Get allocations
    const allocationsRes = await db.query(
      `SELECT da.*, u.full_name, u.phone, u.email
       FROM dividend_allocations da
       JOIN users u ON da.member_id = u.id
       WHERE da.dividend_id = $1
       ORDER BY u.full_name`,
      [dividendId]
    );

    // Get calculation details
    const calcRes = await db.query(
      'SELECT * FROM dividend_calculations WHERE dividend_id = $1 ORDER BY calculation_date DESC LIMIT 1',
      [dividendId]
    );

    res.json({
      dividend: dividendRes.rows[0],
      allocations: allocationsRes.rows,
      calculation: calcRes.rows[0] || null
    });
  } catch (error) {
    console.error('Get dividend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 5. PROCESS DIVIDEND PAYMENTS (Treasurer)
// ========================================
router.post('/:dividendId/process-payments', authenticateUser, authorizeRoles('TREASURER', 'ADMIN'), async (req, res) => {
  try {
    const { dividendId } = req.params;
    const { payment_method } = req.body; // MPESA, BANK, INTERNAL

    if (!['MPESA', 'BANK', 'INTERNAL'].includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Get all pending allocations
    const allocationsRes = await db.query(
      `SELECT da.*, u.phone, u.full_name
       FROM dividend_allocations da
       JOIN users u ON da.member_id = u.id
       WHERE da.dividend_id = $1 AND da.status = $2`,
      [dividendId, 'PENDING']
    );

    const allocations = allocationsRes.rows;

    if (allocations.length === 0) {
      return res.status(400).json({ error: 'No pending allocations to process' });
    }

    let processedCount = 0;
    const results = [];

    for (const allocation of allocations) {
      try {
        if (payment_method === 'INTERNAL') {
          // Create internal transaction to member's general savings
          const txRes = await db.query(
            `INSERT INTO transactions 
             (member_id, type, amount, category, status, description, payment_method, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
             RETURNING id`,
            [
              allocation.member_id,
              'CREDIT',
              allocation.dividend_amount,
              'DIVIDEND',
              'COMPLETED',
              `Dividend FY${new Date().getFullYear()}: ${allocation.dividend_amount}`,
              'INTERNAL'
            ]
          );

          // Update allocation
          await db.query(
            `UPDATE dividend_allocations 
             SET status = $1, payment_method = $2, transaction_id = $3, payment_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            ['PAID', payment_method, txRes.rows[0].id, allocation.id]
          );

          processedCount++;
          results.push({ allocation_id: allocation.id, status: 'SUCCESS' });

        } else if (payment_method === 'MPESA') {
          // Queue for M-Pesa B2C transfer (requires M-Pesa integration)
          // For now, create dividend payment record
          const paymentRes = await db.query(
            `INSERT INTO dividend_payments 
             (allocation_id, amount, payment_method, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [allocation.id, allocation.dividend_amount, payment_method, 'PENDING']
          );

          // Update allocation status
          await db.query(
            `UPDATE dividend_allocations 
             SET status = $1, payment_method = $2, payment_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            ['PAID', payment_method, allocation.id]
          );

          processedCount++;
          results.push({ 
            allocation_id: allocation.id, 
            status: 'PENDING_MPESA_TRANSFER',
            payment_id: paymentRes.rows[0].id,
            phone: allocation.phone
          });
        }
      } catch (allocationError) {
        console.error(`Error processing allocation ${allocation.id}:`, allocationError);
        results.push({ allocation_id: allocation.id, status: 'FAILED', error: allocationError.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${processedCount}/${allocations.length} dividend payments`,
      processed_count: processedCount,
      total_count: allocations.length,
      results
    });
  } catch (error) {
    console.error('Process payments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 6. LIST ALL DIVIDENDS
// ========================================
router.get('/', authenticateUser, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.*, 
              u1.full_name as declared_by_name,
              u2.full_name as approved_by_name,
              COUNT(da.id) as allocation_count,
              COUNT(CASE WHEN da.status = 'PAID' THEN 1 END) as paid_count
       FROM dividends d
       LEFT JOIN users u1 ON d.declared_by = u1.id
       LEFT JOIN users u2 ON d.approved_by = u2.id
       LEFT JOIN dividend_allocations da ON d.id = da.dividend_id
       GROUP BY d.id, u1.full_name, u2.full_name
       ORDER BY d.financial_year DESC, d.created_at DESC`,
      []
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List dividends error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 7. GET MEMBER DIVIDEND HISTORY
// ========================================
router.get('/member/:memberId/history', authenticateUser, async (req, res) => {
  try {
    const { memberId } = req.params;

    // Check authorization (member can only see own, others need ADMIN/TREASURER)
    if (req.user.id !== parseInt(memberId) && !['ADMIN', 'TREASURER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await db.query(
      `SELECT da.*, d.financial_year, d.dividend_rate, d.total_amount
       FROM dividend_allocations da
       JOIN dividends d ON da.dividend_id = d.id
       WHERE da.member_id = $1
       ORDER BY d.financial_year DESC`,
      [memberId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get member dividend history error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
