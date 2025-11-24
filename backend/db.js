const { Pool } = require('pg');
require('dotenv').config();

// Connect to the database using the URL in the .env file
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool // Export pool for transactions
};