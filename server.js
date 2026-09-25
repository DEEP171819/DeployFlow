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

function updateApplicationStatus(appId, status, buildNumber = null) {
    const applications = JSON.parse(
        fs.readFileSync(APPLICATIONS_FILE, "utf-8")
    );

    const application = applications.find(
        app => app.id === appId
    );

    if (!application) {
        return;
    }

    application.status = status;

    if (buildNumber !== null) {
        application.jenkinsBuild = buildNumber;
    }

    application.updatedAt = new Date().toISOString();

    fs.writeFileSync(
        APPLICATIONS_FILE,
        JSON.stringify(applications, null, 4)
    );

    console.log(
        `Application ${appId} status updated to ${status}`
    );
}

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
        const appId = req.query.appId || "deployflow";

        const deployment = await appsApi.readNamespacedDeployment({
            name: appId,
            namespace: namespace
        });

        const podList = await coreApi.listNamespacedPod({
            namespace: namespace,
            labelSelector: `app=${appId}`
        });

        const hpa = await autoscalingApi.readNamespacedHorizontalPodAutoscaler({
            name: appId,
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

            pods: pods.map(pod => ({
                name: pod.metadata?.name,
                status: pod.status?.phase || "Unknown"
            })),

            hpa: {
                name: hpa.metadata?.name,
                minReplicas: hpa.spec?.minReplicas || 0,
                maxReplicas: hpa.spec?.maxReplicas || 0,
                currentReplicas: hpa.status?.currentReplicas || 0
            }
        });

    } catch (error) {
        console.error("Deployment status error:", error);

        res.status(500).json({
            status: "DOWN",
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




async function monitorJenkinsBuild(queueUrl, appId) {
    const credentials = Buffer
        .from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`)
        .toString("base64");

    const headers = {
        Authorization: `Basic ${credentials}`
    };

    try {
        let buildNumber = null;

        for (let i = 0; i < 30; i++) {
            const queueResponse = await fetch(
                `${queueUrl}api/json`,
                { headers }
            );

            const queueData = await queueResponse.json();

            if (queueData.cancelled) {
                throw new Error("Jenkins build was cancelled");
            }

            if (queueData.executable) {
                buildNumber = queueData.executable.number;
                break;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (buildNumber === null) {
            throw new Error("Jenkins build did not start");
        }

        updateApplicationStatus(appId, "BUILDING", buildNumber);

        for (let i = 0; i < 180; i++) {
            const buildResponse = await fetch(
                `${JENKINS_URL}/job/DeployFlow-CI-CD/${buildNumber}/api/json`,
                { headers }
            );

            const buildData = await buildResponse.json();

            if (!buildData.building) {
                if (buildData.result === "SUCCESS") {
                    updateApplicationStatus(
                        appId,
                        "DEPLOYED",
                        buildNumber
                    );
                } else {
                    updateApplicationStatus(
                        appId,
                        "FAILED",
                        buildNumber
                    );
                }

                return;
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        updateApplicationStatus(appId, "FAILED", buildNumber);

    } catch (error) {
        console.error("Jenkins monitoring error:", error);
        updateApplicationStatus(appId, "FAILED");
    }
}


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

        const appId = name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        const application = {
            id: appId,
            name,
            repository,
            branch,
            status: "DEPLOYING",
            createdAt: new Date().toISOString()
        };

        applications.push(application);

        fs.writeFileSync(
            APPLICATIONS_FILE,
            JSON.stringify(applications, null, 4)
        );

        const credentials = Buffer
            .from(`${JENKINS_USER}:${JENKINS_API_TOKEN}`)
            .toString("base64");

        const params = new URLSearchParams({
            REPOSITORY: repository,
            BRANCH: branch,
            APP_ID: appId,
            APP_NAME: name
        });

        const jenkinsResponse = await fetch(
    `${JENKINS_URL}/job/DeployFlow-CI-CD/buildWithParameters?${params.toString()}`,
    {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`
        }
    }
);

if (!jenkinsResponse.ok) {
    throw new Error(
        `Jenkins returned status ${jenkinsResponse.status}`
    );
}

const queueUrl = jenkinsResponse.headers.get("location");

if (queueUrl) {
    monitorJenkinsBuild(queueUrl, appId);
} else {
    console.warn("Jenkins queue URL was not returned");
    updateApplicationStatus(appId, "FAILED");
}

res.status(201).json({
    status: "DEPLOYMENT_STARTED",
    application,
    message: "Jenkins deployment started successfully"
});

    } catch (error) {
        console.error("Application deployment error:", error);

        res.status(500).json({
            status: "ERROR",
            message: error.message
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