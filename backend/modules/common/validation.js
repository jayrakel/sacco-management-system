const Joi = require('joi');

// 1. DEFINED VALID ROLES (Updated to include new Key Officers)
const VALID_ROLES = [
    'MEMBER', 
    'ADMIN', 
    'SECRETARY', 
    'TREASURER', 
    'CHAIRPERSON', 
    'ASSISTANT_CHAIRPERSON', 
    'ASSISTANT_SECRETARY', 
    'LOAN_OFFICER'
];

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

// 2. REGISTER SCHEMA (Updated to use VALID_ROLES)
const registerSchema = Joi.object({
    fullName: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
    // This line is the key change: it allows the new roles you requested
    role: Joi.string().valid(...VALID_ROLES).default('MEMBER')
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// 3. EXISTING LOAN SCHEMAS (Restored from your version)
const loanSubmitSchema = Joi.object({
    loanAppId: Joi.number().integer().required(),
    amount: Joi.number().integer().min(500).max(1000000).required(),
    purpose: Joi.string().min(5).max(200).required(),
    repaymentWeeks: Joi.number().integer().min(1).max(52).required()
});

const paymentSchema = Joi.object({
    loanAppId: Joi.number().integer().required(),
    mpesaRef: Joi.string().pattern(/^[A-Z0-9]{10,15}$/).required()
});

const repaymentSchema = Joi.object({
    loanAppId: Joi.number().integer().required(),
    amount: Joi.number().integer().min(50).required(),
    mpesaRef: Joi.string().required()
});

const tableLoanSchema = Joi.object({
    loanId: Joi.number().integer().required()
});

const disburseSchema = Joi.object({
    loanId: Joi.number().integer().required()
});

module.exports = { 
    validate, 
    registerSchema, 
    loginSchema, 
    loanSubmitSchema, 
    paymentSchema,
    repaymentSchema,
    tableLoanSchema,
    disburseSchema,
    VALID_ROLES // Exporting this is helpful for the Setup Wizard
};