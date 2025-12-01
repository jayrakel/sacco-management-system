-- System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key character varying(50) PRIMARY KEY,
    setting_value character varying(255) NOT NULL,
    description text,
    category character varying(20) DEFAULT 'SYSTEM' -- 'SYSTEM' or 'SACCO'
);

-- Seed Comprehensive Sacco Policies
INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES 
    -- 1. MEMBERSHIP & SAVINGS
    ('registration_fee', '1500', 'One-time mandatory fee for new member registration (KES)', 'SACCO'),
    ('min_share_capital', '2000', 'Minimum shares required to retain active membership (KES)', 'SACCO'),
    ('min_weekly_deposit', '250', 'Mandatory minimum saving per week (KES)', 'SACCO'),

    -- 2. LOAN CONFIGURATIONS
    ('loan_interest_rate', '12', 'Annual interest rate percentage for loans (%)', 'SACCO'),
    ('loan_grace_period_weeks', '4', 'Weeks after disbursement before loan is considered in arrears', 'SACCO'),
    ('loan_multiplier', '3', 'Maximum loan limit multiplier based on savings (e.g. 3x savings)', 'SACCO'),
    ('loan_processing_fee', '500', 'Standard fee deducted or paid for processing a loan (KES)', 'SACCO'),
    ('min_guarantors', '2', 'Minimum number of active guarantors required to submit a loan', 'SACCO'),

    -- 3. TIME-BASED LATENESS FINES
    ('fine_lateness_1h', '50', 'Fine for arriving up to 1 hour late (KES)', 'SACCO'),
    ('fine_lateness_2h', '100', 'Fine for arriving 1-2 hours late (KES)', 'SACCO'),
    ('fine_lateness_3h', '200', 'Fine for arriving 3+ hours late or very late (KES)', 'SACCO'),
    
    -- 4. OTHER FINES & PENALTIES
    ('fine_absenteeism', '200', 'Fine for missing a scheduled meeting without apology (KES)', 'SACCO'),
    ('fine_no_uniform', '50', 'Fine for not wearing official Sacco uniform/badge (KES)', 'SACCO'),
    ('fine_misconduct', '500', 'Fine for general misconduct or disruption (KES)', 'SACCO'),
    ('penalty_missed_savings', '50', 'Automatic penalty for failing to meet weekly deposit target (KES)', 'SACCO'),
    ('penalty_arrears_rate', '10', 'Percentage penalty charged on total arrears amount (%)', 'SACCO')

-- Upsert Logic
ON CONFLICT (setting_key) 
DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;