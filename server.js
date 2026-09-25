const express = require("express");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const app = express();
const DATA_DIR = path.join(__dirname, "data");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");

app.use(morgan("combined"));
app.use(express.json());
app.use(express.static("public"));

const JENKINS_URL = "http://localhost:8080";
const JENKINS_USER = process.env.JENKINS_USER;
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN;

app.get("/api/health", (req, res) => {
    res.json({
        status: "UP",
        application: process.env.APP_NAME || "DeployFlow",
        environment: process.env.NODE_ENV || "development"
    });
});

app.get("/api/deployment/status", async (req, res) => {
    try {
        const {
            appsApi,
            coreApi,
            autoscalingApi
        } = require("./kubernetes");

        const namespace = "default";

        const deployment = await appsApi.readNamespacedDeployment({
            name: "deployflow",
            namespace: namespace
        });

        const podList = await coreApi.listNamespacedPod({
            namespace: namespace,
            labelSelector: "app=deployflow"
        });

        const hpa = await autoscalingApi.readNamespacedHorizontalPodAutoscaler({
            name: "deployflow",
            namespace: namespace
        });

        const pods = podList.items || [];

        res.json({
            status: "UP",

            deployment: {
                name: deployment.metadata?.name,
                replicas: deployment.spec?.replicas || 0,
                readyReplicas: deployment.status?.readyReplicas || 0,
                availableReplicas: deployment.status?.availableReplicas || 0,
                image: deployment.spec?.template?.spec?.containers?.[0]?.image || "Unknown"
            },

            pods: pods.map((pod) => ({
                name: pod.metadata?.name,
                status: pod.status?.phase || "Unknown"
            })),

            hpa: {
                minReplicas: hpa.spec?.minReplicas || 0,
                maxReplicas: hpa.spec?.maxReplicas || 0,
                currentReplicas: hpa.status?.currentReplicas || 0,
                desiredReplicas: hpa.status?.desiredReplicas || 0
            }
        });

    } catch (error) {
        console.error("Kubernetes API error:", error);

        res.status(500).json({
            status: "ERROR",
            message: error.message
        });
    }
});

app.get("/api/build/status", async (req, res) => {
    try {
        const credentials = Buffer
            .from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`)
            .toString("base64");

        const response = await fetch(
            `${JENKINS_URL}/job/DeployFlow-CI-CD/lastBuild/api/json`,
            {
                headers: {
                    Authorization: `Basic ${credentials}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Jenkins API returned ${response.status}`);
        }

        const build = await response.json();

        res.json({
            status: "UP",
            buildNumber: build.number,
            buildStatus: build.result,
            duration: build.duration,
            timestamp: build.timestamp,
            url: build.url
        });

    } catch (error) {
        console.error("Jenkins API error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Unable to retrieve Jenkins build status"
        });
    }
});

app.get("/api/build/history", async (req, res) => {
    try {
        const credentials = Buffer
            .from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`)
            .toString("base64");

        const response = await fetch(
            `${JENKINS_URL}/job/DeployFlow-CI-CD/api/json?tree=builds[number,result,duration,timestamp,url]`,
            {
                headers: {
                    Authorization: `Basic ${credentials}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Jenkins API returned ${response.status}`);
        }

        const data = await response.json();

        const builds = data.builds || [];

        res.json({
            status: "UP",
            builds: builds.map((build) => ({
                buildNumber: build.number,
                buildStatus: build.result || "BUILDING",
                duration: build.duration,
                timestamp: build.timestamp,
                url: build.url
            }))
        });

    } catch (error) {
        console.error("Jenkins build history error:", error);

        res.status(500).json({
            status: "ERROR",
            message: error.message
        });
    }
});

app.post("/api/applications", async (req, res) => {
    try {
        const { name, repository, branch } = req.body;

        if (!name || !repository || !branch) {
            return res.status(400).json({
                status: "ERROR",
                message: "Name, repository and branch are required"
            });
        }

        const applications = JSON.parse(
            fs.readFileSync(APPLICATIONS_FILE, "utf-8")
        );

        const application = {
            id: `app-${Date.now()}`,
            name,
            repository,
            branch,
            status: "CREATED",
            createdAt: new Date().toISOString()
        };

        applications.push(application);

        fs.writeFileSync(
            APPLICATIONS_FILE,
            JSON.stringify(applications, null, 4)
        );

        res.status(201).json({
            status: "CREATED",
            application
        });

    } catch (error) {
        console.error("Application creation error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Unable to create application"
        });
    }
});

app.get("/api/applications", (req, res) => {
    try {
        const applications = JSON.parse(
            fs.readFileSync(APPLICATIONS_FILE, "utf-8")
        );

        res.json({
            status: "UP",
            applications
        });

    } catch (error) {
        console.error("Application retrieval error:", error);

        res.status(500).json({
            status: "ERROR",
            message: "Unable to retrieve applications"
        });
    }
});

module.exports = app;

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`DeployFlow server running on http://localhost:${PORT}`);
    });
}