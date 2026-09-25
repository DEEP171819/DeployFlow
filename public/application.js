const params = new URLSearchParams(window.location.search);

const appId = params.get("id");

let application = null;

async function loadApplication() {

    if (!appId) {
        showError("No application selected.");
        return;
    }

    try {

        const response =
            await fetch("/api/applications");

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load applications"
            );
        }

        application =
            data.applications.find(
                app => app.id === appId
            );

        if (!application) {
            showError("Application not found.");
            return;
        }

        document.getElementById(
            "application-name"
        ).textContent =
            application.name;

        document.getElementById(
            "application-status"
        ).textContent =
            application.status;

        document.getElementById(
            "repository"
        ).textContent =
            application.repository;

        document.getElementById(
            "branch"
        ).textContent =
            application.branch;

        document.getElementById(
            "build-number"
        ).textContent =
            application.jenkinsBuild
                ? `#${application.jenkinsBuild}`
                : "--";

        const urlElement =
            document.getElementById(
                "application-url"
            );

        if (application.url) {

            urlElement.href =
                application.url;

            urlElement.textContent =
                application.url;

        } else {

            urlElement.textContent =
                "Not available";
        }

        document.getElementById(
            "loading"
        ).style.display =
            "none";

        document.getElementById(
            "application-content"
        ).style.display =
            "block";

        await loadDeploymentStatus();
        await loadDeploymentHistory();
        await loadDeploymentLogs();

    } catch (error) {

        console.error(
            "Application loading error:",
            error
        );

        showError(
            "Unable to load application."
        );
    }
}


async function loadDeploymentStatus() {

    try {

        const response =
            await fetch(
                `/api/deployment/status?appId=${encodeURIComponent(appId)}`
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load deployment status"
            );
        }

        const deployment =
            data.deployment;

        document.getElementById(
            "application-status"
        ).textContent =
            data.applicationStatus ||
            "UNKNOWN";

        document.getElementById(
            "replicas"
        ).textContent =
            `${deployment.readyReplicas}/${deployment.replicas}`;

        document.getElementById(
            "docker-image"
        ).textContent =
            deployment.image ||
            "Unknown";

        document.getElementById(
            "hpa"
        ).textContent =
            `${data.hpa.currentReplicas}/${data.hpa.maxReplicas}`;

        const podList =
            document.getElementById(
                "pod-list"
            );

        podList.innerHTML = "";

        data.pods.forEach(
            pod => {

                const li =
                    document.createElement(
                        "li"
                    );

                li.textContent =
                    `${pod.name} - ${pod.status}`;

                podList.appendChild(
                    li
                );
            }
        );

    } catch (error) {

        console.error(
            "Deployment status error:",
            error
        );
    }
}


async function loadDeploymentHistory() {

    try {

        const response =
            await fetch(
                `/api/applications/${encodeURIComponent(appId)}/history`
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load deployment history"
            );
        }

        const historyList =
            document.getElementById(
                "deployment-history"
            );

        historyList.innerHTML = "";

        if (
            !data.deployments ||
            data.deployments.length === 0
        ) {

            historyList.innerHTML =
                "<li>No deployment history</li>";

            return;
        }

        data.deployments
            .slice()
            .reverse()
            .forEach(
                deployment => {

                    const li =
                        document.createElement(
                            "li"
                        );

                    const date =
                        new Date(
                            deployment.deployedAt
                        ).toLocaleString();

                    if (
                        deployment.type ===
                        "ROLLBACK"
                    ) {

                        li.textContent =
                            `Rollback - ${deployment.image || "Previous version"} - ${deployment.status} - ${date}`;

                    } else {

                        li.textContent =
                            `Build #${deployment.buildNumber} - ${deployment.status} - ${date}`;
                    }

                    historyList.appendChild(
                        li
                    );
                }
            );

    } catch (error) {

        console.error(
            "Deployment history error:",
            error
        );
    }
}


async function loadDeploymentLogs() {

    try {

        const response =
            await fetch(
                `/api/applications/${encodeURIComponent(appId)}/logs`
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Unable to load deployment logs"
            );
        }

        document.getElementById(
            "deployment-logs"
        ).textContent =
            data.logs ||
            "No logs available.";

    } catch (error) {

        console.error(
            "Deployment logs error:",
            error
        );

        document.getElementById(
            "deployment-logs"
        ).textContent =
            "Unable to load deployment logs.";
    }
}


async function redeployApplication() {

    if (!appId) {
        return;
    }

    const confirmed =
        confirm(
            "Are you sure you want to redeploy this application?"
        );

    if (!confirmed) {
        return;
    }

    const button =
        document.getElementById(
            "redeploy-button"
        );

    button.disabled = true;

    button.textContent =
        "Redeploying...";

    try {

        const response =
            await fetch(
                `/api/applications/${encodeURIComponent(appId)}/deploy`,
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Redeployment failed"
            );
        }

        alert(
            "Redeployment started successfully."
        );

        await loadApplication();

    } catch (error) {

        console.error(
            "Redeployment error:",
            error
        );

        alert(
            error.message
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Redeploy Application";
    }
}


async function rollbackApplication() {

    if (!appId) {
        return;
    }

    const confirmed =
        confirm(
            "Are you sure you want to rollback this deployment?"
        );

    if (!confirmed) {
        return;
    }

    const button =
        document.getElementById(
            "rollback-button"
        );

    button.disabled = true;

    button.textContent =
        "Rolling Back...";

    try {

        const response =
            await fetch(
                `/api/applications/${encodeURIComponent(appId)}/rollback`,
                {
                    method: "POST"
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.message ||
                "Rollback failed"
            );
        }

        alert(
            `Rollback successful!\nRunning image: ${data.image}`
        );

        await loadApplication();

    } catch (error) {

        console.error(
            "Rollback error:",
            error
        );

        alert(
            error.message
        );

    } finally {

        button.disabled = false;

        button.textContent =
            "Rollback Deployment";
    }
}


function showError(message) {

    document.getElementById(
        "loading"
    ).textContent =
        message;
}


document
    .getElementById(
        "redeploy-button"
    )
    .addEventListener(
        "click",
        redeployApplication
    );


document
    .getElementById(
        "rollback-button"
    )
    .addEventListener(
        "click",
        rollbackApplication
    );


loadApplication();

setInterval(
    loadDeploymentStatus,
    5000
);