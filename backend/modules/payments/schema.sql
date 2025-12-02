-- Transactions / Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id),
    type character varying(50), -- 'REGISTRATION_FEE', 'FINE', 'DEPOSIT', 'LOAN_REPAYMENT'
    amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'COMPLETED', 
    reference_code character varying(100) NOT NULL UNIQUE,    
    -- New Fields for M-Pesa
    merchant_request_id character varying(100),
    checkout_request_id character varying(100),
    
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);