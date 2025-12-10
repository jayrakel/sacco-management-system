-- Table for Long Term Assets (Land, Buildings, Equipment)
CREATE TABLE IF NOT EXISTS fixed_assets (
    id SERIAL PRIMARY KEY,
    asset_name VARCHAR(255) NOT NULL, -- e.g., "Juja Plot LR/2023"
    asset_type VARCHAR(50) NOT NULL, -- LAND, BUILDING, VEHICLE, EQUIPMENT, INVESTMENT
    purchase_date DATE,
    purchase_cost NUMERIC(15, 2) DEFAULT 0,
    current_valuation NUMERIC(15, 2) NOT NULL, -- The value used in reports
    location VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, SOLD, WRITTEN_OFF
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for valuation changes (Optional but recommended)
CREATE TABLE IF NOT EXISTS asset_valuations (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER REFERENCES fixed_assets(id),
    valuation_date DATE DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2),
    valued_by VARCHAR(100),
    notes TEXT
);