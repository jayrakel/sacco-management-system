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
    phoneNumber: Joi.string().pattern(/^[0-9]{10,15}$/).required(),
    role: Joi.string().valid('MEMBER', 'SECRETARY', 'TREASURER', 'ADMIN', 'LOAN_OFFICER', 'CHAIRPERSON').default('MEMBER'),
    paymentRef: Joi.string().optional().allow(''),
    
    // NEW: KYC Fields
    idNumber: Joi.string().min(5).max(20).required(),
    kraPin: Joi.string().optional().allow(''),
    nextOfKinName: Joi.string().required(),
    nextOfKinPhone: Joi.string().required(),
    nextOfKinRelation: Joi.string().required()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

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

// New: For manual penalty trigger
const penaltySchema = Joi.object({
    secretKey: Joi.string().required()
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
    penaltySchema
};