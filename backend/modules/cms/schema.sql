-- 1. Website Content (Dynamic Text for Home/About)
CREATE TABLE IF NOT EXISTS website_content (
    id SERIAL PRIMARY KEY,
    section_key VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'hero_title', 'about_us_text'
    content_value TEXT,
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Meeting Minutes (with file links)
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL, -- e.g. "AGM Minutes Dec 2024"
    meeting_date DATE NOT NULL,
    file_path VARCHAR(255) NOT NULL, -- Path to the PDF/Doc
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Group History (Timeline)
CREATE TABLE IF NOT EXISTS group_history (
    id SERIAL PRIMARY KEY,
    event_title VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);