require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/readings", require("./routes/readings"));
app.use("/api/reports", require("./routes/reports"));

app.get("/", (req, res) => {
    res.send("Sweety Backend Running Successfully!");
});

async function startServer() {
    try {
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
        console.log("PostgreSQL Connected Successfully!");

        app.listen(process.env.PORT || 5000, () => {
            console.log(`Server running on port ${process.env.PORT || 5000}`);
        });

    } catch (error) {
        console.error("Database initialization failed:", error);
    }
}

startServer();
