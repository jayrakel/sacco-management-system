-- Run these commands in your 'sacco_db' database query tool

-- 1. Add the missing columns for Loan Details
ALTER TABLE loan_applications 
ADD COLUMN IF NOT EXISTS amount_requested DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS purpose TEXT,
ADD COLUMN IF NOT EXISTS repayment_months INT,
ADD COLUMN IF NOT EXISTS guarantor_ids TEXT[]; -- Array of User IDs

-- 2. Create the Votes table (We will need this for the next step)
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    loan_application_id INT REFERENCES loan_applications(id),
    user_id INT REFERENCES users(id),
    vote VARCHAR(10) CHECK (vote IN ('YES', 'NO')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(loan_application_id, user_id) -- One vote per member per loan
);

-- 3. Ensure Users have roles (If not exists)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'MEMBER';