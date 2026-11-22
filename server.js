require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// ROUTES
app.use("/api/auth", require("./routes/auth"));
app.use("/api/readings", require("./routes/readings"));
app.use("/api/reports", require("./routes/reports"));

// HOME
app.get("/", (req, res) => {
    res.send("Sweety Backend Running Successfully!");
});

// DATABASE TABLES + SERVER
async function startServer() {
    try {
        // CREATE USERS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Users table ready!");

        // CREATE READINGS TABLE
        await pool.query(`
            CREATE TABLE IF NOT EXISTS readings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reading_date DATE NOT NULL,
                slot VARCHAR(50) NOT NULL,
                glucose_value INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log("Readings table ready!");

        // DATABASE CONNECTION TEST
        await pool.query("SELECT 1");

        console.log("PostgreSQL Connected Successfully!");

        // START SERVER
        app.listen(process.env.PORT || 5000, () => {
            console.log(
                `Server running on port ${process.env.PORT || 5000}`
            );
        });

    } catch (error) {
        console.error("Database initialization failed:", error);
    }
}

startServer();
