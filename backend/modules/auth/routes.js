const express = require('express');
const router = express.Router();
const { authenticateUser } = require('./middleware');
const { validate, registerSchema } = require('../common/validation');

// Import Controllers
const authController = require('./controllers/authController');
const profileController = require('./controllers/profileController');

// Auth Routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/logout', authController.logout);

// Profile Routes
router.get('/profile', authenticateUser, profileController.getProfile);
router.put('/profile', authenticateUser, profileController.updateProfile);
router.post('/change-password', authenticateUser, profileController.changePassword);

module.exports = router;