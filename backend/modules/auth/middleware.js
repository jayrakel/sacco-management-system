const jwt = require('jsonwebtoken');

// 1. Verify Token (Authentication)
const authenticateUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) return res.status(401).json({ error: "Access Denied: No Token Provided" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Access Denied: Invalid Token" });
        req.user = user; // Attach decoded user (id, role, email) to request
        next();
    });
};

// 2. Check Role (Authorization)
const requireRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: "Access Denied: Insufficient Permissions" });
        }
        next();
    };
};

module.exports = { authenticateUser, requireRole };