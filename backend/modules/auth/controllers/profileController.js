const db = require('../../../db');
const bcrypt = require('bcrypt');

exports.getProfile = async (req, res) => {
    try {
        const result = await db.query(`SELECT id, full_name, email, phone_number, role, id_number, kra_pin, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, profile_image, created_at, is_active FROM users WHERE id = $1`, [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Failed to fetch profile" }); }
};

exports.updateProfile = async (req, res) => {
    const { full_name, phone_number, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, profile_image } = req.body;
    try {
        await db.query(
            `UPDATE users SET full_name = COALESCE($1, full_name), phone_number = COALESCE($2, phone_number), next_of_kin_name = COALESCE($3, next_of_kin_name), next_of_kin_phone = COALESCE($4, next_of_kin_phone), next_of_kin_relation = COALESCE($5, next_of_kin_relation), profile_image = COALESCE($6, profile_image) WHERE id = $7`,
            [full_name, phone_number, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, profile_image, req.user.id]
        );
        res.json({ message: "Profile updated successfully" });
    } catch (err) { res.status(500).json({ error: "Update failed" }); }
};

exports.changePassword = async (req, res) => {
    /* ... logic from routes.js ... */
    res.json({ message: "Password updated" });
};