const express = require("express");

const app = express();

app.use(express.static("public"));

const PORT = 3000;

app.get("/api/health", (req, res) => {
    res.json({
        status: "UP",
        application: "DeployFlow"
    });
});

app.listen(PORT, () => {
    console.log(`DeployFlow server running on http://localhost:${PORT}`);
});