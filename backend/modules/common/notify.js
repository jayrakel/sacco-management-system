const db = require('../../db');

const notifyUser = async (userId, message) => {
    await db.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [userId, message]);
};

/**
 * Sends a notification to ALL users.
 * @param {string|function} messageOrBuilder - A static string OR a function that takes a user object and returns a string.
 */
const notifyAll = async (messageOrBuilder) => {
    // 1. Fetch all users with their names
    const users = await db.query("SELECT id, full_name FROM users");

    // 2. Generate custom message for each user
    const queries = users.rows.map(u => {
        const finalMessage = typeof messageOrBuilder === 'function' 
            ? messageOrBuilder(u) // Run the builder function if provided
            : messageOrBuilder;   // Use static string otherwise

        return db.query(
            "INSERT INTO notifications (user_id, message) VALUES ($1, $2)", 
            [u.id, finalMessage]
        );
    });

    await Promise.all(queries);
};

module.exports = { notifyUser, notifyAll };