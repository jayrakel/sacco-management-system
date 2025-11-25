const db = require('../../db');

const notifyUser = async (userId, message) => {
    await db.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [userId, message]);
};

const notifyAll = async (message) => {
    // Get all users
    const users = await db.query("SELECT id FROM users");
    const queries = users.rows.map(u => 
        db.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [u.id, message])
    );
    await Promise.all(queries);
};

module.exports = { notifyUser, notifyAll };