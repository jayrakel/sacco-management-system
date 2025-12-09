-- 1. Fixed Assets (Land, Buildings)
CREATE TABLE IF NOT EXISTS fixed_assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- LAND, BUILDING, VEHICLE, EQUIPMENT
    purchase_value NUMERIC(15, 2) NOT NULL,
    current_value NUMERIC(15, 2) NOT NULL,
    purchase_date DATE DEFAULT CURRENT_DATE,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Operational Expenses (Rent, Utilities, Depreciation)
CREATE TABLE IF NOT EXISTS operational_expenses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'GENERAL', -- RENT, UTILITIES, DEPRECIATION, INTEREST
    amount NUMERIC(15, 2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    incurred_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. External Liabilities (Loans taken by the Group)
CREATE TABLE IF NOT EXISTS external_liabilities (
    id SERIAL PRIMARY KEY,
    lender_name VARCHAR(255) NOT NULL, -- e.g. "Equity Bank"
    principal_amount NUMERIC(15, 2) NOT NULL,
    interest_rate NUMERIC(5, 2),
    outstanding_balance NUMERIC(15, 2) NOT NULL,
    start_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, PAID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);