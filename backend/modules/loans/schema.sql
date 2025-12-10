-- Loan Products Configuration
CREATE TABLE IF NOT EXISTS public.loan_products (
    id SERIAL PRIMARY KEY,
    name character varying(100) NOT NULL,
    interest_rate numeric(5,2) DEFAULT 0,
    max_amount numeric(15,2) NOT NULL,
    repayment_period_weeks integer NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);

-- Loan Applications
CREATE TABLE IF NOT EXISTS public.loan_applications (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id),
    status character varying(50) DEFAULT 'FEE_PENDING',
    fee_amount numeric(10,2) DEFAULT 500.00,
    fee_transaction_ref character varying(100),
    amount_requested numeric(15,2),
    purpose text,
    repayment_weeks integer,
    guarantor_ids text[],
    amount_repaid numeric(15,2) DEFAULT 0.00,
    interest_amount numeric(15,2) DEFAULT 0,
    total_due numeric(15,2) DEFAULT 0,
    running_balance numeric(15,2) DEFAULT 0.00,
    grace_period_weeks integer DEFAULT 4,
    disbursed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Loan Guarantors Link
CREATE TABLE IF NOT EXISTS public.loan_guarantors (
    id SERIAL PRIMARY KEY,
    loan_application_id integer REFERENCES public.loan_applications(id) ON DELETE CASCADE,
    guarantor_id integer REFERENCES public.users(id),
    amount_guaranteed numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'PENDING',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(loan_application_id, guarantor_id)
);

-- Voting System
CREATE TABLE IF NOT EXISTS public.votes (
    id SERIAL PRIMARY KEY,
    loan_application_id integer REFERENCES public.loan_applications(id),
    user_id integer REFERENCES public.users(id),
    vote character varying(10) CHECK (vote IN ('YES', 'NO')),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(loan_application_id, user_id)
);