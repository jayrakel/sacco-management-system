-- 1. Meeting Minutes Archive
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL, -- e.g., "AGM 2023"
    meeting_date DATE NOT NULL,
    content TEXT NOT NULL, -- Full text of the minutes
    attendees_count INTEGER DEFAULT 0,
    file_url TEXT, -- Link to uploaded PDF/Doc if applicable
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Group History / Timeline
CREATE TABLE IF NOT EXISTS group_history (
    id SERIAL PRIMARY KEY,
    event_title VARCHAR(255) NOT NULL, -- e.g., "Group Founded", "First Loan Issued"
    event_date DATE NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'MILESTONE', -- MILESTONE, ACHIEVEMENT, CHALLENGE
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Member Movement Log (Audit Trail)
-- This tracks exactly when people join or leave and why
CREATE TABLE IF NOT EXISTS member_movement_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- 'JOINED', 'LEFT', 'SUSPENDED', 'REINSTATED'
    reason TEXT, -- e.g., "Voluntary exit", "Failed to pay dues"
    recorded_by INTEGER REFERENCES users(id), -- Who performed the action
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);