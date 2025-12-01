-- System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    setting_key character varying(50) PRIMARY KEY,
    setting_value character varying(255) NOT NULL,
    description text,
    category character varying(20) DEFAULT 'SYSTEM' -- 'SYSTEM' or 'SACCO'
);