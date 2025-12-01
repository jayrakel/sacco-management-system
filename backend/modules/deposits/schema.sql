-- Deposits Table
CREATE TABLE IF NOT EXISTS public.deposits (
    id SERIAL PRIMARY KEY,
    user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
    amount numeric(15,2) NOT NULL CHECK (amount > 0),
    transaction_ref character varying(50) NOT NULL UNIQUE,
    status character varying(20) DEFAULT 'COMPLETED',
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);