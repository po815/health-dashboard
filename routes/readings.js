
const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

// ADD BLOOD GLUCOSE READING
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { reading_date, slot, glucose_value } = req.body;
        const user_id = req.user.id;

        if (!reading_date || !slot || glucose_value === undefined) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const allowedSlots = [
            "Before Breakfast",
            "After Breakfast",
            "Before Lunch",
            "After Lunch"
        ];

        if (!allowedSlots.includes(slot)) {
            return res.status(400).json({
                message: "Invalid reading slot"
            });
        }

        const value = Number(glucose_value);

        if (!Number.isInteger(value) || value <= 0) {
            return res.status(400).json({
                message: "Enter a valid glucose value"
            });
        }

        const existing = await pool.query(
            `SELECT id FROM readings
             WHERE user_id = $1
             AND reading_date = $2
             AND slot = $3`,
            [user_id, reading_date, slot]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: "This reading slot is already recorded"
            });
        }

        const count = await pool.query(
            `SELECT COUNT(*) FROM readings
             WHERE user_id = $1 AND reading_date = $2`,
            [user_id, reading_date]
        );

        if (Number(count.rows[0].count) >= 4) {
            return res.status(400).json({
                message: "Maximum 4 readings allowed per day"
            });
        }

        const result = await pool.query(
            `INSERT INTO readings
             (user_id, reading_date, slot, glucose_value)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [user_id, reading_date, slot, value]
        );

        res.status(201).json({
            message: "Glucose reading added successfully!",
            reading: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to add reading"
        });
    }
});


// VIEW USER READINGS
router.get("/", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM readings
             WHERE user_id = $1
             ORDER BY reading_date DESC, created_at DESC`,
            [req.user.id]
        );

        res.status(200).json(result.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch readings"
        });
    }
});


// UPDATE GLUCOSE READING
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const { glucose_value } = req.body;
        const readingId = req.params.id;
        const value = Number(glucose_value);

        if (
            glucose_value === undefined ||
            !Number.isInteger(value) ||
            value <= 0
        ) {
            return res.status(400).json({
                message: "Enter a valid glucose value"
            });
        }

        const result = await pool.query(
            `UPDATE readings
             SET glucose_value = $1
             WHERE id = $2 AND user_id = $3
             RETURNING *`,
            [value, readingId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Reading not found"
            });
        }

        res.status(200).json({
            message: "Glucose reading updated successfully!",
            reading: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update reading"
        });
    }
});


// DELETE GLUCOSE READING
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const readingId = req.params.id;

        const result = await pool.query(
            `DELETE FROM readings
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [readingId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Reading not found"
            });
        }

        res.status(200).json({
            message: "Glucose reading deleted successfully!",
            reading: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to delete reading"
        });
    }
});


// DELETE ROUTE TEST
router.get("/delete-test", (req, res) => {
    res.send("Readings DELETE route file loaded!");
});


// GENERAL TEST ROUTE
router.get("/test", (req, res) => {
    res.send("Readings route working!");
});

module.exports = router;
