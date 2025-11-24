const Joi = require('joi');

const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        next();
    };
};

// --- SCHEMAS ---

const registerSchema = Joi.object({
    fullName: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/).required().messages({'string.pattern.base': 'Phone number must be 10-15 digits'}),
    role: Joi.string().valid('MEMBER', 'SECRETARY', 'TREASURER', 'ADMIN').default('MEMBER')
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const loanSubmitSchema = Joi.object({
    loanAppId: Joi.number().integer().required(),
    amount: Joi.number().integer().min(500).max(1000000).required(),
    purpose: Joi.string().min(5).max(200).required(), // Prevent huge text dumps
    repaymentWeeks: Joi.number().integer().min(1).max(52).required()
});

const paymentSchema = Joi.object({
    loanAppId: Joi.number().integer().required(),
    mpesaRef: Joi.string().pattern(/^[A-Z0-9]{10}$/).required().messages({'string.pattern.base': 'Invalid M-PESA code format'})
});

module.exports = { 
    validate, 
    registerSchema, 
    loginSchema, 
    loanSubmitSchema, 
    paymentSchema 
};