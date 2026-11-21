
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

// GET - Fetch all glucose readings
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, user_id, slot, glucose_value FROM glucose_readings ORDER BY id DESC"
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error fetching readings" });
    }
});

module.exports = router;
