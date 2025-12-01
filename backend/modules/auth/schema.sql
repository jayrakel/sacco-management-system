-- Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL UNIQUE,
    phone_number character varying(20) NOT NULL UNIQUE,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'ADMIN', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER', 'CHAIRPERSON')),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    must_change_password boolean DEFAULT false,
    is_active boolean DEFAULT true
);