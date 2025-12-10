const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../auth/middleware');

// Import split route files
const appRoutes = require('./application.routes');
const guarantorRoutes = require('./guarantor.routes');
const votingRoutes = require('./voting.routes');
const adminRoutes = require('./admin.routes');
const secretaryRoutes = require('./secretary.routes');
const treasuryRoutes = require('./treasury.routes');
const notifRoutes = require('./notification.routes');
const officerRoutes = require('./officer.routes');
const chairRoutes = require('./chair.routes'); // <--- ADDED

// Apply authentication middleware globally to ALL loan routes
router.use(authenticateUser);

// Mount them
router.use('/', appRoutes);
router.use('/', guarantorRoutes);
router.use('/', votingRoutes);
router.use('/', adminRoutes);
router.use('/', secretaryRoutes);
router.use('/', treasuryRoutes);
router.use('/', notifRoutes);
router.use('/', officerRoutes);
router.use('/', chairRoutes); // <--- ADDED

module.exports = router;