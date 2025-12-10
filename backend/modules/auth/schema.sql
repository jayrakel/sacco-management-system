-- Users Table with KYC and Next of Kin
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL UNIQUE,
    phone_number character varying(20) NOT NULL UNIQUE,
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'ADMIN', 'SECRETARY', 'TREASURER', 'LOAN_OFFICER', 'CHAIRPERSON')),
    
    -- New Fields for KYC & Legal Compliance
    id_number character varying(50),
    kra_pin character varying(50),
    next_of_kin_name character varying(255),
    next_of_kin_phone character varying(20),
    next_of_kin_relation character varying(50),
    profile_image text, -- Stores Base64 string of profile picture
    
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    must_change_password boolean DEFAULT false,
    is_active boolean DEFAULT true
);