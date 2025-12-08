const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateUser } = require('../auth/middleware');
const PDFDocument = require('pdfkit'); // Ensure you ran: npm install pdfkit

// 1. MEMBER STATEMENT (PDF)
router.get('/statement/me', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(
            `SELECT created_at, type, amount, reference_code 
             FROM transactions WHERE user_id = $1 ORDER BY created_at ASC`,
            [userId]
        );

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Statement.pdf`);
        doc.pipe(res);

        doc.fontSize(20).text('SACCO ACCOUNT STATEMENT', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Member: ${req.user.name} | Date: ${new Date().toDateString()}`);
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

        let y = doc.y;
        doc.font('Helvetica-Bold').text('Date', 50, y).text('Type', 150, y).text('Amount', 350, y).text('Ref', 450, y);
        doc.font('Helvetica');
        y += 20;

        result.rows.forEach(tx => {
            if (y > 700) { doc.addPage(); y = 50; }
            doc.text(new Date(tx.created_at).toISOString().split('T')[0], 50, y);
            doc.text(tx.type, 150, y);
            doc.text(parseFloat(tx.amount).toLocaleString(), 350, y);
            doc.text(tx.reference_code, 450, y);
            y += 20;
        });

        doc.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "PDF Generation Failed" });
    }
});

// 2. ADMIN SUMMARY (Existing)
router.get('/summary', authenticateUser, async (req, res) => {
    // ... (Keep your existing summary logic here) ...
    if (!['ADMIN', 'CHAIRPERSON', 'TREASURER'].includes(req.user.role)) {
        return res.status(403).json({ error: "Access Denied" });
    }
    // ... (rest of your summary code)
    res.json({ message: "Summary data goes here (restored from previous file)" });
});

module.exports = router;