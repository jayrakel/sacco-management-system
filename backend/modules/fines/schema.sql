CREATE TABLE IF NOT EXISTS member_fines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255) NOT NULL, -- e.g., "Late for Meeting"
    original_amount DECIMAL(15,2) NOT NULL,
    current_balance DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PARTIALLY_PAID, CLEARED
    
    -- Interest Logic Tracking
    interest_stage VARCHAR(50) DEFAULT 'NONE', -- NONE, STAGE_1_20, STAGE_2_50
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_stage_1_applied TIMESTAMP, -- When 20% was applied
    date_stage_2_applied TIMESTAMP, -- When 50% was applied
    
    description TEXT
);