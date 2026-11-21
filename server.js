
require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const cors = require("cors");

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

// SERVER
app.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
});
