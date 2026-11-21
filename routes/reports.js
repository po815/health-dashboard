
const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

// ======================================
// DAILY REPORT
// ======================================
router.get("/daily", authMiddleware, async (req, res) => {
    try {
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Please provide date in YYYY-MM-DD format"
            });
        }

        const result = await pool.query(
            `SELECT reading_date, slot, glucose_value
             FROM readings
             WHERE user_id = $1 AND reading_date = $2
             ORDER BY created_at ASC`,
            [req.user.id, date]
        );

        res.status(200).json({
            message: "Daily report fetched successfully",
            date,
            total_readings: result.rows.length,
            readings: result.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch daily report"
        });
    }
});


// ======================================
// MONTHLY REPORT
// ======================================
router.get("/monthly", authMiddleware, async (req, res) => {
    try {
        const { month } = req.query;

        if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
            return res.status(400).json({
                message: "Provide month in YYYY-MM format"
            });
        }

        const result = await pool.query(
            `SELECT
                reading_date,
                COUNT(*) AS total_readings,
                ROUND(AVG(glucose_value), 2) AS average_glucose,
                MIN(glucose_value) AS minimum_glucose,
                MAX(glucose_value) AS maximum_glucose
             FROM readings
             WHERE user_id = $1
             AND reading_date >= ($2 || '-01')::date
             AND reading_date < (($2 || '-01')::date + INTERVAL '1 month')
             GROUP BY reading_date
             ORDER BY reading_date ASC`,
            [req.user.id, month]
        );

        const totalReadings = result.rows.reduce(
            (sum, row) => sum + Number(row.total_readings),
            0
        );

        res.status(200).json({
            message: "Monthly report fetched successfully",
            month,
            total_readings: totalReadings,
            total_days: result.rows.length,
            report: result.rows
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch monthly report"
        });
    }
});


// ======================================
// WEEKLY REPORT (MONDAY TO SUNDAY)
// ======================================
router.get("/weekly", authMiddleware, async (req, res) => {
    try {
        const { date } = req.query;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Provide date in YYYY-MM-DD format"
            });
        }

        const result = await pool.query(
            `WITH daily AS (
                SELECT
                    reading_date,
                    COUNT(*) AS total_readings,
                    SUM(glucose_value) AS total_glucose,
                    ROUND(AVG(glucose_value), 2) AS average_glucose,
                    MIN(glucose_value) AS minimum_glucose,
                    MAX(glucose_value) AS maximum_glucose
                FROM readings
                WHERE user_id = $1
                AND reading_date >= DATE_TRUNC('week', $2::date)::date
                AND reading_date < (
                    DATE_TRUNC('week', $2::date)::date
                    + INTERVAL '7 days'
                )
                GROUP BY reading_date
            )
            SELECT
                reading_date,
                total_readings,
                average_glucose,
                minimum_glucose,
                maximum_glucose,
                SUM(total_readings) OVER() AS weekly_total_readings,
                ROUND(
                    (
                        SUM(total_glucose) OVER() /
                        NULLIF(SUM(total_readings) OVER(), 0)
                    )::numeric,
                    2
                ) AS weekly_average_glucose,
                MIN(minimum_glucose) OVER() AS weekly_minimum_glucose,
                MAX(maximum_glucose) OVER() AS weekly_maximum_glucose
            FROM daily
            ORDER BY reading_date ASC`,
            [req.user.id, date]
        );

        const dates = await pool.query(
            `SELECT
                DATE_TRUNC('week', $1::date)::date AS week_start,
                (
                    DATE_TRUNC('week', $1::date)::date
                    + INTERVAL '6 days'
                )::date AS week_end`,
            [date]
        );

        const summary = result.rows[0];

        res.status(200).json({
            message: "Weekly report fetched successfully",

            week_start: dates.rows[0].week_start,
            week_end: dates.rows[0].week_end,

            total_readings: summary
                ? Number(summary.weekly_total_readings)
                : 0,

            average_glucose: summary
                ? Number(summary.weekly_average_glucose)
                : null,

            minimum_glucose: summary
                ? Number(summary.weekly_minimum_glucose)
                : null,

            maximum_glucose: summary
                ? Number(summary.weekly_maximum_glucose)
                : null,

            daily_report: result.rows.map(row => ({
                reading_date: row.reading_date,
                total_readings: Number(row.total_readings),
                average_glucose: Number(row.average_glucose),
                minimum_glucose: Number(row.minimum_glucose),
                maximum_glucose: Number(row.maximum_glucose)
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch weekly report"
        });
    }
});


// ======================================
// EXPORT ROUTER
// ======================================
module.exports = router;
