-- Transactions / Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id),
    type character varying(50), -- e.g. 'REGISTRATION_FEE', 'FINE', 'DEPOSIT', 'LOAN_REPAYMENT'
    amount numeric(15,2) NOT NULL,
    reference_code character varying(100) NOT NULL UNIQUE,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);