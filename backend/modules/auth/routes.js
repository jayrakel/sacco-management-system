const express = require('express');
const router = express.Router();
// const db = require('../../db'); 

// Mock Login Logic
router.post('/login', (req, res) => {
    const { email } = req.body;
    
    // Simple logic to simulate roles based on email address
    let role = 'MEMBER';
    let userId = 1; // Default Member ID

    if (email.includes('secretary')) {
        role = 'SECRETARY';
        userId = 2;
    } else if (email.includes('treasurer')) {
        role = 'TREASURER';
        userId = 3;
    }

    // Return the user info (In real app, return a JWT token here)
    res.json({ 
        success: true,
        user: { id: userId, email, role, name: 'Simulated User' },
        token: "mock-jwt-token-123"
    });
});

module.exports = router;