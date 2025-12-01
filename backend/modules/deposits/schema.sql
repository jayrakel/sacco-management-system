-- Deposits Table (Updated to allow Deductions)
CREATE TABLE IF NOT EXISTS public.deposits (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Amount can now be negative for fines/penalties
    amount numeric(15,2) NOT NULL, 
    
    -- Track if it's a Saving or a Penalty Deduction
    type character varying(20) DEFAULT 'DEPOSIT', -- 'DEPOSIT' or 'DEDUCTION'
    
    transaction_ref character varying(100) NOT NULL UNIQUE, -- Increased length for auto-generated refs
    status character varying(20) DEFAULT 'COMPLETED',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);