-- System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key character varying(50) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description text,
    category character varying(20) DEFAULT 'SYSTEM'
);

-- Ensure existing installations support long text
ALTER TABLE public.system_settings ALTER COLUMN setting_value TYPE TEXT;

INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES 
    ('registration_fee', '1500', 'One-time mandatory fee (KES)', 'SACCO'),
    ('min_share_capital', '2000', 'Minimum shares (KES)', 'SACCO'),
    ('min_savings_for_loan', '5000', 'Min savings to apply for loan', 'SACCO'), -- NEW SETTING
    ('min_weekly_deposit', '250', 'Min saving/week (KES)', 'SACCO'),
    ('loan_interest_rate', '12', 'Annual interest rate (%)', 'SACCO'),
    ('loan_grace_period_weeks', '4', 'Weeks before arrears', 'SACCO'),
    ('loan_multiplier', '3', 'Loan limit multiplier', 'SACCO'),
    ('loan_processing_fee', '500', 'Processing fee (KES)', 'SACCO'),
    ('min_guarantors', '2', 'Min guarantors required', 'SACCO'),
    ('category_welfare_amount', '0', 'Predefined welfare contribution (0=manual)', 'SACCO'),
    ('category_penalty_amount', '0', 'Predefined penalty amount (0=manual)', 'SACCO'),
    ('category_share_capital_amount', '0', 'Predefined share capital amount (0=manual)', 'SACCO'),
    ('category_deposit_amount', '0', 'Predefined general deposit (0=manual)', 'SACCO'),
    ('fine_lateness_1h', '50', 'Fine < 1h late', 'SACCO'),
    ('fine_lateness_2h', '100', 'Fine 1-2h late', 'SACCO'),
    ('fine_lateness_3h', '200', 'Fine 3h+ late', 'SACCO'),
    ('fine_absenteeism', '200', 'Fine absent', 'SACCO'),
    ('fine_no_uniform', '50', 'Fine no uniform', 'SACCO'),
    ('fine_misconduct', '500', 'Fine misconduct', 'SACCO'),
    ('penalty_missed_savings', '50', 'Penalty missed save', 'SACCO'),
    ('penalty_arrears_rate', '10', 'Penalty arrears %', 'SACCO'),
    ('sacco_logo', '', 'Logo Base64', 'SYSTEM'),
    ('sacco_favicon', '', 'Favicon Base64', 'SYSTEM'),
    ('sacco_name', 'Secure Sacco', 'Organization Name', 'SYSTEM'),
    ('payment_channels', '[{"type":"BANK","name":"Equity Bank","account":"123-456-789","instructions":"Enter Ref"},{"type":"PAYPAL","name":"PayPal","account":"pay@sacco.com","instructions":"Use transaction ID"}]', 'List of receiving accounts', 'SACCO')

ON CONFLICT (setting_key) 
DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Contribution Categories Table
CREATE TABLE IF NOT EXISTS public.contribution_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add amount column if it doesn't exist (for existing installations)
ALTER TABLE IF EXISTS public.contribution_categories
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) DEFAULT 0;