const express = require("express");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

const DATA_DIR = path.join(__dirname, "data");
const APPLICATIONS_FILE = path.join(DATA_DIR, "applications.json");
const USERS_FILE = path.join(__dirname, "users.json");

app.use(morgan("combined"));
app.use(express.json());
app.use(express.static("public"));

const JENKINS_URL = "http://localhost:8080";
const JENKINS_USER = process.env.JENKINS_USER;
const JENKINS_API_TOKEN = process.env.JENKINS_API_TOKEN;

const JWT_SECRET =
    process.env.JWT_SECRET ||
    "deployflow-local-development-secret";

/* =========================
   FILE HELPERS
========================= */

function loadApplications() {
    if (!fs.existsSync(APPLICATIONS_FILE)) {
        return [];
    }

    return JSON.parse(
        fs.readFileSync(
            APPLICATIONS_FILE,
            "utf-8"
        )
    );
}

function saveApplications(applications) {
    fs.writeFileSync(
        APPLICATIONS_FILE,
        JSON.stringify(
            applications,
            null,
            4
        )
    );
}

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }

    return JSON.parse(
        fs.readFileSync(
            USERS_FILE,
            "utf8"
        )
    );
}

function saveUsers(users) {
    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(
            users,
            null,
            2
        )
    );
}

/* =========================
   LEGACY APPLICATION MIGRATION
========================= */

function migrateLegacyApplications() {
    try {
        const users = loadUsers();

        if (users.length !== 1) {
            return;
        }

        const applications = loadApplications();

        let changed = false;

        applications.forEach(application => {

            if (!application.userId) {

                application.userId =
                    users[0].id;

                changed = true;
            }
        });

        if (changed) {

            saveApplications(
                applications
            );

            console.log(
                "Legacy applications assigned to the existing user."
            );
        }

    } catch (error) {

        console.error(
            "Application migration error:",
            error
        );
    }
}

/* =========================
   APPLICATION STATUS
========================= */

function updateApplicationStatus(
    appId,
    status,
    buildNumber = null,
    image = null
) {
    const applications =
        loadApplications();

    const application =
        applications.find(
            app =>
                app.id === appId
        );

    if (!application) {
        return;
    }

    application.status =
        status;

    application.updatedAt =
        new Date().toISOString();

    if (buildNumber !== null) {
        application.jenkinsBuild =
            buildNumber;
    }

    if (image !== null) {
        application.currentImage =
            image;
    }

    if (!application.deployments) {
        application.deployments =
            [];
    }

    if (
        buildNumber !== null &&
        (
            status === "DEPLOYED" ||
            status === "FAILED"
        )
    ) {

        const existingDeployment =
            application.deployments.find(
                deployment =>
                    deployment.buildNumber ===
                    buildNumber
            );

        if (!existingDeployment) {

            application.deployments.push({

                buildNumber:
                    buildNumber,

                status:
                    status,

                image:
                    image,

                deployedAt:
                    new Date().toISOString()
            });
        }
    }

    saveApplications(
        applications
    );

    console.log(
        `Application ${appId} status updated to ${status}`
    );
}

/* =========================
   AUTHENTICATION
========================= */

function authenticateToken(
    req,
    res,
    next
) {
    const authHeader =
        req.headers.authorization;

    const token =
        authHeader &&
        authHeader.split(" ")[1];

    if (!token) {

        return res.status(401).json({
            message:
                "Authentication required"
        });
    }

    jwt.verify(
        token,
        JWT_SECRET,
        (error, user) => {

            if (error) {

                return res.status(403).json({
                    message:
                        "Invalid or expired token"
                });
            }

            req.user =
                user;

            next();
        }
    );
}

/* =========================
   AUTHORIZATION HELPER
========================= */

function getApplicationForUser(
    appId,
    userId
) {
    const applications =
        loadApplications();

    return applications.find(
        application =>
            application.id === appId &&
            application.userId === userId
    );
}

/* =========================
   AUTHENTICATION
========================= */

app.post(
    "/api/auth/signup",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;

            if (!email || !password) {

                return res.status(400).json({
                    message:
                        "Email and password are required"
                });
            }

            const users =
                loadUsers();

            const existingUser =
                users.find(
                    user =>
                        user.email === email
                );

            if (existingUser) {

                return res.status(409).json({
                    message:
                        "User already exists"
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const user = {

                id:
                    Date.now().toString(),

                email:
                    email,

                password:
                    hashedPassword,

                createdAt:
                    new Date().toISOString()
            };

            users.push(
                user
            );

            saveUsers(
                users
            );

            res.status(201).json({

                message:
                    "User registered successfully"
            });

        } catch (error) {

            console.error(
                "Signup error:",
                error
            );

            res.status(500).json({

                message:
                    "Signup failed"
            });
        }
    }
);

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;

            if (!email || !password) {

                return res.status(400).json({
                    message:
                        "Email and password are required"
                });
            }

            const users =
                loadUsers();

            const user =
                users.find(
                    user =>
                        user.email === email
                );

            if (!user) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });
            }

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });
            }

            const token =
                jwt.sign(
                    {
                        userId:
                            user.id,

                        email:
                            user.email
                    },

                    JWT_SECRET,

                    {
                        expiresIn:
                            "2h"
                    }
                );

            res.json({

                message:
                    "Login successful",

                token
            });

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            res.status(500).json({

                message:
                    "Login failed"
            });
        }
    }
);

/* =========================
   HEALTH
========================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            status:
                "UP",

            application:
                process.env.APP_NAME ||
                "DeployFlow",

            environment:
                process.env.NODE_ENV ||
                "development"
        });
    }
);

/* =========================
   DEPLOYMENT STATUS
========================= */

app.get(
    "/api/deployment/status",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                appsApi,
                coreApi,
                autoscalingApi
            } = require("./kubernetes");

            const namespace =
                "default";

            const appId =
                req.query.appId ||
                "deployflow";

            const application =
                getApplicationForUser(
                    appId,
                    req.user.userId
                );

            if (!application) {

                return res.status(404).json({

                    status:
                        "NOT_FOUND",

                    message:
                        "Application not found"
                });
            }

            const deployment =
                await appsApi.readNamespacedDeployment({
                    name:
                        appId,

                    namespace:
                        namespace
                });

            const podList =
                await coreApi.listNamespacedPod({
                    namespace:
                        namespace,

                    labelSelector:
                        `app=${appId}`
                });

            const hpa =
                await autoscalingApi
                    .readNamespacedHorizontalPodAutoscaler({
                        name:
                            appId,

                        namespace:
                            namespace
                    });

            const pods =
                podList.items || [];

            res.json({

                status:
                    "UP",

                applicationStatus:
                    application.status ||
                    "UNKNOWN",

                deployment: {

                    name:
                        deployment.metadata?.name,

                    replicas:
                        deployment.spec?.replicas ||
                        0,

                    readyReplicas:
                        deployment.status?.readyReplicas ||
                        0,

                    availableReplicas:
                        deployment.status?.availableReplicas ||
                        0,

                    image:
                        deployment.spec
                            ?.template
                            ?.spec
                            ?.containers?.[0]
                            ?.image ||
                        "Unknown"
                },

                pods:
                    pods.map(
                        pod => ({

                            name:
                                pod.metadata?.name,

                            status:
                                pod.status?.phase ||
                                "Unknown"
                        })
                    ),

                hpa: {

                    name:
                        hpa.metadata?.name,

                    minReplicas:
                        hpa.spec?.minReplicas ||
                        0,

                    maxReplicas:
                        hpa.spec?.maxReplicas ||
                        0,

                    currentReplicas:
                        hpa.status?.currentReplicas ||
                        0
                }
            });

        } catch (error) {

            console.error(
                "Deployment status error:",
                error
            );

            res.status(500).json({

                status:
                    "DOWN",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   BUILD STATUS
========================= */

app.get(
    "/api/build/status",
    authenticateToken,
    async (req, res) => {

        try {

            const credentials =
                Buffer
                    .from(
                        `${JENKINS_USER}:${JENKINS_API_TOKEN}`
                    )
                    .toString("base64");

            const response =
                await fetch(
                    `${JENKINS_URL}/job/DeployFlow-CI-CD/lastBuild/api/json`,
                    {
                        headers: {
                            Authorization:
                                `Basic ${credentials}`
                        }
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Jenkins API returned ${response.status}`
                );
            }

            const build =
                await response.json();

            res.json({

                status:
                    "UP",

                buildNumber:
                    build.number,

                buildStatus:
                    build.result,

                duration:
                    build.duration,

                timestamp:
                    build.timestamp,

                url:
                    build.url
            });

        } catch (error) {

            console.error(
                "Jenkins API error:",
                error
            );

            res.status(500).json({

                status:
                    "ERROR",

                message:
                    "Unable to retrieve Jenkins build status"
            });
        }
    }
);

/* =========================
   BUILD HISTORY
========================= */

app.get(
    "/api/build/history",
    authenticateToken,
    async (req, res) => {

        try {

            const credentials =
                Buffer
                    .from(
                        `${JENKINS_USER}:${JENKINS_API_TOKEN}`
                    )
                    .toString("base64");

            const response =
                await fetch(
                    `${JENKINS_URL}/job/DeployFlow-CI-CD/api/json?tree=builds[number,result,duration,timestamp,url]`,
                    {
                        headers: {
                            Authorization:
                                `Basic ${credentials}`
                        }
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Jenkins API returned ${response.status}`
                );
            }

            const data =
                await response.json();

            const builds =
                data.builds || [];

            res.json({

                status:
                    "UP",

                builds:
                    builds.map(
                        build => ({

                            buildNumber:
                                build.number,

                            buildStatus:
                                build.result ||
                                "BUILDING",

                            duration:
                                build.duration,

                            timestamp:
                                build.timestamp,

                            url:
                                build.url
                        })
                    )
            });

        } catch (error) {

            console.error(
                "Jenkins build history error:",
                error
            );

            res.status(500).json({

                status:
                    "ERROR",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   JENKINS BUILD MONITOR
========================= */

async function monitorJenkinsBuild(
    queueUrl,
    appId
) {
    const credentials =
        Buffer
            .from(
                `${JENKINS_USER}:${JENKINS_API_TOKEN}`
            )
            .toString("base64");

    const headers = {
        Authorization:
            `Basic ${credentials}`
    };

    try {

        updateApplicationStatus(
            appId,
            "QUEUED"
        );

        let buildNumber =
            null;

        for (
            let i = 0;
            i < 30;
            i++
        ) {

            const queueResponse =
                await fetch(
                    `${queueUrl}api/json`,
                    {
                        headers
                    }
                );

            const queueData =
                await queueResponse.json();

            if (queueData.cancelled) {

                throw new Error(
                    "Jenkins build was cancelled"
                );
            }

            if (queueData.executable) {

                buildNumber =
                    queueData.executable.number;

                break;
            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        2000
                    )
            );
        }

        if (buildNumber === null) {

            throw new Error(
                "Jenkins build did not start"
            );
        }

        updateApplicationStatus(
            appId,
            "BUILDING",
            buildNumber
        );

        for (
            let i = 0;
            i < 180;
            i++
        ) {

            const buildResponse =
                await fetch(
                    `${JENKINS_URL}/job/DeployFlow-CI-CD/${buildNumber}/api/json`,
                    {
                        headers
                    }
                );

            const buildData =
                await buildResponse.json();

            if (!buildData.building) {

                if (
                    buildData.result !==
                    "SUCCESS"
                ) {

                    updateApplicationStatus(
                        appId,
                        "BUILD_FAILED",
                        buildNumber
                    );

                    return;
                }

                break;
            }

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        5000
                    )
            );
        }

        updateApplicationStatus(
            appId,
            "DEPLOYING",
            buildNumber
        );

        let image =
            null;

        try {

            const {
                execFileSync
            } = require(
                "child_process"
            );

            image =
                execFileSync(
                    "kubectl",
                    [
                        "get",
                        "deployment",
                        appId,
                        "-o",
                        "jsonpath={.spec.template.spec.containers[0].image}"
                    ],
                    {
                        encoding:
                            "utf-8"
                    }
                ).trim();

        } catch (error) {

            console.error(
                "Unable to retrieve deployed image:",
                error
            );
        }

        updateApplicationStatus(
            appId,
            "DEPLOYED",
            buildNumber,
            image
        );

    } catch (error) {

        console.error(
            "Jenkins monitoring error:",
            error
        );

        updateApplicationStatus(
            appId,
            "DEPLOYMENT_FAILED"
        );
    }
}

/* =========================
   CREATE APPLICATION
========================= */

app.post(
    "/api/applications",
    authenticateToken,
    async (req, res) => {

        try {

            const {
    name,
    repository,
    branch,
    environmentVariables = {},
    secrets = {}
} = req.body;

            if (
                !name ||
                !repository ||
                !branch
            ) {

                return res.status(400).json({

                    status:
                        "ERROR",

                    message:
                        "Name, repository and branch are required"
                });
            }

            if (
    typeof environmentVariables !== "object" ||
    Array.isArray(environmentVariables) ||
    typeof secrets !== "object" ||
    Array.isArray(secrets)
) {
    return res.status(400).json({
        status: "ERROR",
        message:
            "Environment variables and secrets must be objects"
    });
}

const variableNameRegex =
    /^[A-Za-z_][A-Za-z0-9_]*$/;

for (
    const key of Object.keys(environmentVariables)
) {
    if (!variableNameRegex.test(key)) {
        return res.status(400).json({
            status: "ERROR",
            message:
                `Invalid environment variable name: ${key}`
        });
    }
}

for (
    const key of Object.keys(secrets)
) {
    if (!variableNameRegex.test(key)) {
        return res.status(400).json({
            status: "ERROR",
            message:
                `Invalid secret name: ${key}`
        });
    }
}

            const applications =
                loadApplications();

            const appId =
                name
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9-]/g,
                        "-"
                    )
                    .replace(
                        /-+/g,
                        "-"
                    )
                    .replace(
                        /^-|-$/g,
                        ""
                    );

            const existingApplication =
                applications.find(
                    application =>
                        application.id ===
                        appId
                );

            if (existingApplication) {

                return res.status(409).json({

                    status:
                        "ERROR",

                    message:
                        "An application with this name already exists"
                });
            }

            const application = {
    id: appId,
    name: name,
    repository: repository,
    branch: branch,

    environmentVariables:
        environmentVariables,

    secrets:
        secrets,

    status: "DEPLOYING",

    userId:
        req.user.userId,

    createdAt:
        new Date().toISOString()
};

            applications.push(
                application
            );

            saveApplications(
                applications
            );

            const credentials =
                Buffer
                    .from(
                        `${JENKINS_USER}:${JENKINS_API_TOKEN}`
                    )
                    .toString("base64");

            const params =
    new URLSearchParams({
        REPOSITORY:
            repository,

        BRANCH:
            branch,

        APP_ID:
            appId,

        APP_NAME:
            name,

        ENV_VARS:
            JSON.stringify(
                environmentVariables
            ),

        SECRETS:
            JSON.stringify(
                secrets
            )
    });

            const jenkinsResponse =
    await fetch(
        `${JENKINS_URL}/job/DeployFlow-CI-CD/buildWithParameters`,
        {
            method:
                "POST",

            headers: {
                Authorization:
                    `Basic ${credentials}`,

                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                params.toString()
        }
    );

            if (!jenkinsResponse.ok) {

                throw new Error(
                    `Jenkins returned status ${jenkinsResponse.status}`
                );
            }

            const queueUrl =
                jenkinsResponse.headers
                    .get("location");

            if (queueUrl) {

                monitorJenkinsBuild(
                    queueUrl,
                    appId
                );

            } else {

                console.warn(
                    "Jenkins queue URL was not returned"
                );

                updateApplicationStatus(
                    appId,
                    "FAILED"
                );
            }

            res.status(201).json({

                status:
                    "DEPLOYMENT_STARTED",

                application:
                    application,

                message:
                    "Jenkins deployment started successfully"
            });

        } catch (error) {

            console.error(
                "Application deployment error:",
                error
            );

            res.status(500).json({

                status:
                    "ERROR",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   APPLICATION HISTORY
========================= */

app.get(
    "/api/applications/:appId/history",
    authenticateToken,
    (req, res) => {

        try {

            const application =
                getApplicationForUser(
                    req.params.appId,
                    req.user.userId
                );

            if (!application) {

                return res.status(404).json({

                    status:
                        "NOT_FOUND",

                    message:
                        "Application not found"
                });
            }

            res.json({

                status:
                    "UP",

                application:
                    application.name,

                deployments:
                    application.deployments ||
                    []
            });

        } catch (error) {

            console.error(
                "Deployment history error:",
                error
            );

            res.status(500).json({

                status:
                    "DOWN",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   APPLICATION LOGS
========================= */

app.get(
    "/api/applications/:appId/logs",
    authenticateToken,
    async (req, res) => {

        try {

            const application =
                getApplicationForUser(
                    req.params.appId,
                    req.user.userId
                );

            if (!application) {

                return res.status(404).json({

                    status:
                        "NOT_FOUND",

                    message:
                        "Application not found"
                });
            }

            if (!application.jenkinsBuild) {

                return res.json({

                    status:
                        "NO_BUILD",

                    application:
                        application.name,

                    logs:
                        "No Jenkins build has been started yet."
                });
            }

            const credentials =
                Buffer
                    .from(
                        `${JENKINS_USER}:${JENKINS_API_TOKEN}`
                    )
                    .toString("base64");

            const response =
                await fetch(
                    `${JENKINS_URL}/job/DeployFlow-CI-CD/${application.jenkinsBuild}/consoleText`,
                    {
                        headers: {
                            Authorization:
                                `Basic ${credentials}`
                        }
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Jenkins returned status ${response.status}`
                );
            }

            const logs =
                await response.text();

            res.json({

                status:
                    "UP",

                application:
                    application.name,

                buildNumber:
                    application.jenkinsBuild,

                logs:
                    logs
            });

        } catch (error) {

            console.error(
                "Deployment logs error:",
                error
            );

            res.status(500).json({

                status:
                    "DOWN",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   ROLLBACK
========================= */

app.post(
    "/api/applications/:appId/rollback",
    authenticateToken,
    async (req, res) => {

        try {

            const appId =
                req.params.appId;

            const applications =
                loadApplications();

            const application =
                applications.find(
                    app =>
                        app.id === appId &&
                        app.userId ===
                            req.user.userId
                );

            if (!application) {

                return res.status(404).json({

                    status:
                        "NOT_FOUND",

                    message:
                        "Application not found"
                });
            }

            const {
                execFileSync
            } = require(
                "child_process"
            );

            const history =
                execFileSync(
                    "kubectl",
                    [
                        "rollout",
                        "history",
                        `deployment/${appId}`
                    ],
                    {
                        encoding:
                            "utf-8"
                    }
                );

            console.log(
                "Rollout history:"
            );

            console.log(
                history
            );

            const rollbackResult =
                execFileSync(
                    "kubectl",
                    [
                        "rollout",
                        "undo",
                        `deployment/${appId}`
                    ],
                    {
                        encoding:
                            "utf-8"
                    }
                );

            execFileSync(
                "kubectl",
                [
                    "rollout",
                    "status",
                    `deployment/${appId}`,
                    "--timeout=120s"
                ],
                {
                    encoding:
                        "utf-8"
                }
            );

            const image =
                execFileSync(
                    "kubectl",
                    [
                        "get",
                        "deployment",
                        appId,
                        "-o",
                        "jsonpath={.spec.template.spec.containers[0].image}"
                    ],
                    {
                        encoding:
                            "utf-8"
                    }
                ).trim();

            application.status =
                "DEPLOYED";

            application.updatedAt =
                new Date().toISOString();

            application.currentImage =
                image;

            if (!application.deployments) {
                application.deployments =
                    [];
            }

            application.deployments.push({

                type:
                    "ROLLBACK",

                status:
                    "ROLLED_BACK",

                image:
                    image,

                deployedAt:
                    new Date().toISOString()
            });

            saveApplications(
                applications
            );

            res.json({

                status:
                    "ROLLBACK_SUCCESS",

                application:
                    application.name,

                image:
                    image,

                message:
                    "Application rolled back successfully",

                kubernetes:
                    rollbackResult.trim()
            });

        } catch (error) {

            console.error(
                "Rollback error:",
                error
            );

            res.status(500).json({

                status:
                    "ROLLBACK_FAILED",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   REDEPLOY
========================= */

app.post(
    "/api/applications/:appId/deploy",
    authenticateToken,
    async (req, res) => {

        try {

            const appId =
                req.params.appId;

            const applications =
                loadApplications();

            const application =
                applications.find(
                    app =>
                        app.id === appId &&
                        app.userId ===
                            req.user.userId
                );

            if (!application) {

                return res.status(404).json({

                    status:
                        "NOT_FOUND",

                    message:
                        "Application not found"
                });
            }

            const credentials =
                Buffer
                    .from(
                        `${JENKINS_USER}:${JENKINS_API_TOKEN}`
                    )
                    .toString("base64");

            const params =
    new URLSearchParams({
        REPOSITORY:
            application.repository,

        BRANCH:
            application.branch,

        APP_ID:
            application.id,

        APP_NAME:
            application.name,

        ENV_VARS:
            JSON.stringify(
                application.environmentVariables || {}
            ),

        SECRETS:
            JSON.stringify(
                application.secrets || {}
            )
    });

            application.status =
                "DEPLOYING";

            application.updatedAt =
                new Date().toISOString();

            saveApplications(
                applications
            );

            const jenkinsResponse =
    await fetch(
        `${JENKINS_URL}/job/DeployFlow-CI-CD/buildWithParameters`,
        {
            method:
                "POST",

            headers: {
                Authorization:
                    `Basic ${credentials}`,

                "Content-Type":
                    "application/x-www-form-urlencoded"
            },

            body:
                params.toString()
        }
    );

            if (!jenkinsResponse.ok) {

                throw new Error(
                    `Jenkins returned status ${jenkinsResponse.status}`
                );
            }

            const queueUrl =
                jenkinsResponse.headers
                    .get("location");

            if (!queueUrl) {

                throw new Error(
                    "Jenkins queue URL was not returned"
                );
            }

            monitorJenkinsBuild(
                queueUrl,
                appId
            );

            res.json({

                status:
                    "DEPLOYMENT_STARTED",

                application:
                    application,

                message:
                    "Application redeployment started successfully"
            });

        } catch (error) {

            console.error(
                "Redeployment error:",
                error
            );

            res.status(500).json({

                status:
                    "ERROR",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   APPLICATIONS
========================= */

app.get(
    "/api/applications",
    authenticateToken,
    (req, res) => {

        try {

            const applications =
                loadApplications();

            const userApplications =
                applications.filter(
                    application =>
                        application.userId ===
                        req.user.userId
                );

            const applicationsWithUrls =
                userApplications.map(
                    application => ({

                        ...application,

                        url:
                            `http://${application.id}.localhost`
                    })
                );

            res.json({

                status:
                    "UP",

                applications:
                    applicationsWithUrls
            });

        } catch (error) {

            console.error(
                "Applications error:",
                error
            );

            res.status(500).json({

                status:
                    "DOWN",

                message:
                    error.message
            });
        }
    }
);

/* =========================
   STARTUP
========================= */

migrateLegacyApplications();

module.exports = app;

const PORT =
    process.env.PORT || 3000;

if (require.main === module) {

    app.listen(
        PORT,
        () => {

            console.log(
                `DeployFlow server running on http://localhost:${PORT}`
            );
        }
    );
}