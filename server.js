const express = require("express");
const morgan = require("morgan");

const app = express();

app.use(morgan("combined"));
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

module.exports = app;

const PORT = process.env.PORT || 3000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`DeployFlow server running on http://localhost:${PORT}`);
    });
}