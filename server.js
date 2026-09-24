const express = require("express");

const app = express();

app.use(express.static("public"));

app.get("/api/health", (req, res) => {
    res.json({
        status: "UP",
        application: process.env.APP_NAME || "DeployFlow",
        environment: process.env.NODE_ENV || "development"
    });
});

module.exports = app;

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`DeployFlow server running on http://localhost:${PORT}`);
    });
}