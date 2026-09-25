function getAuthHeaders() {
const token = localStorage.getItem("deployflow_token");

if (!token) {
    window.location.href = "/login.html";
    return {};
}

return {
    Authorization: `Bearer ${token}`
};

}

let selectedAppId = "";

async function loadHealth() {
try {
const response = await fetch("/api/health");

    if (!response.ok) {
        throw new Error("Health check failed");
    }

    const data = await response.json();

    document.getElementById("app-status").textContent =
        data.status;

} catch (error) {
    console.error("Health check error:", error);

    document.getElementById("app-status").textContent =
        "DOWN";
}

}

async function loadDeploymentStatus() {
try {
if (!selectedAppId) {
return;
}

    const response = await fetch(
        `/api/deployment/status?appId=${encodeURIComponent(selectedAppId)}`,
        {
            headers: getAuthHeaders()
        }
    );

    if (response.status === 401) {
        localStorage.removeItem("deployflow_token");
        window.location.href = "/login.html";
        return;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message ||
            "Unable to load deployment status"
        );
    }

    if (!data.deployment) {
        throw new Error(
            "Deployment information not available"
        );
    }

    const deployment = data.deployment;

    document.getElementById(
        "deployment-status"
    ).textContent =
        data.applicationStatus ||
        "UNKNOWN";

    document.getElementById(
        "replicas"
    ).textContent =
        `${deployment.readyReplicas || 0}/${deployment.replicas || 0}`;

    const image =
        deployment.image || "Unknown";

    document.getElementById(
        "image"
    ).textContent =
        image;

    document.getElementById(
        "version"
    ).textContent =
        image !== "Unknown"
            ? image.split(":").pop()
            : "Unknown";

    if (data.hpa) {
        document.getElementById(
            "hpa"
        ).textContent =
            `${data.hpa.currentReplicas || 0}/${data.hpa.maxReplicas || 0}`;
    } else {
        document.getElementById(
            "hpa"
        ).textContent =
            "N/A";
    }

    const podList =
        document.getElementById(
            "pod-list"
        );

    podList.innerHTML = "";

    if (data.pods && data.pods.length > 0) {

        data.pods.forEach(pod => {

            const li =
                document.createElement("li");

            li.textContent =
                `${pod.name} - ${pod.status}`;

            podList.appendChild(li);
        });

    } else {

        const li =
            document.createElement("li");

        li.textContent =
            "No pods available";

        podList.appendChild(li);
    }

} catch (error) {

    console.error(
        "Deployment status error:",
        error
    );

    document.getElementById(
        "image"
    ).textContent =
        "Unavailable";

    document.getElementById(
        "version"
    ).textContent =
        "Unavailable";
}

}

async function loadApplications() {
try {
const response = await fetch(
"/api/applications",
{
headers: getAuthHeaders()
}
);

    if (response.status === 401) {
        localStorage.removeItem("deployflow_token");
        window.location.href = "/login.html";
        return;
    }

    if (!response.ok) {
        throw new Error(
            "Applications request failed"
        );
    }

    const data = await response.json();

    const container =
        document.getElementById(
            "applications-list"
        );

    const selector =
        document.getElementById(
            "application-selector"
        );

    selector.innerHTML =
        '<option value="">Select an application</option>';

    if (
        !data.applications ||
        data.applications.length === 0
    ) {
        container.innerHTML =
            "<p>No applications deployed yet.</p>";

        return;
    }

    container.innerHTML = "";

    data.applications.forEach(
        application => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                application.id;

            option.textContent =
                application.name;

            selector.appendChild(
                option
            );

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "application-card";

            const name =
                document.createElement(
                    "h3"
                );

            name.textContent =
                application.name;

            const status =
                document.createElement(
                    "p"
                );

            status.textContent =
                `Status: ${application.status}`;

            card.appendChild(name);
            card.appendChild(status);

            const detailsLink =
                document.createElement(
                    "a"
                );

            detailsLink.href =
                `/application.html?id=${encodeURIComponent(application.id)}`;

            detailsLink.textContent =
                "View Details";

            card.appendChild(
                detailsLink
            );

            if (
                application.status ===
                "DEPLOYED"
            ) {
                const link =
                    document.createElement(
                        "a"
                    );

                link.href =
                    application.url;

                link.textContent =
                    "Open Application";

                link.target =
                    "_blank";

                card.appendChild(
                    link
                );

            } else {
                const message =
                    document.createElement(
                        "p"
                    );

                message.textContent =
                    "Deployment in progress...";

                card.appendChild(
                    message
                );
            }

            container.appendChild(
                card
            );
        }
    );

    if (selectedAppId) {
        selector.value =
            selectedAppId;
    }

} catch (error) {
    console.error(
        "Applications loading error:",
        error
    );

    document.getElementById(
        "applications-list"
    ).innerHTML =
        "<p>Unable to load applications.</p>";
}

}

async function loadDeploymentHistory() {

const historyList =
    document.getElementById(
        "deployment-history"
    );

if (!selectedAppId) {
    historyList.innerHTML =
        "<li>Select an application</li>";

    return;
}

try {
    const response = await fetch(
        `/api/applications/${encodeURIComponent(selectedAppId)}/history`,
        {
            headers: getAuthHeaders()
        }
    );

    if (!response.ok) {
        throw new Error(
            "Deployment history request failed"
        );
    }

    const data =
        await response.json();

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

    historyList.innerHTML =
        "<li>Unable to load deployment history</li>";
}

}

async function loadDeploymentLogs() {

const logsElement =
    document.getElementById(
        "deployment-logs"
    );

if (!selectedAppId) {
    logsElement.textContent =
        "Select an application to view logs.";

    return;
}

try {
    const response = await fetch(
        `/api/applications/${encodeURIComponent(selectedAppId)}/logs`,
        {
            headers: getAuthHeaders()
        }
    );

    if (!response.ok) {
        throw new Error(
            "Deployment logs request failed"
        );
    }

    const data =
        await response.json();

    if (
        data.status ===
        "NO_BUILD"
    ) {
        logsElement.textContent =
            data.logs;

        return;
    }

    logsElement.textContent =
        data.logs ||
        "No logs available.";

} catch (error) {
    console.error(
        "Deployment logs error:",
        error
    );

    logsElement.textContent =
        "Unable to load deployment logs.";
}

}

async function loadBuildStatus() {

try {
    const response = await fetch(
        "/api/build/status",
        {
            headers: getAuthHeaders()
        }
    );

    if (!response.ok) {
        throw new Error(
            "Build status request failed"
        );
    }

    const data =
        await response.json();

    document.getElementById(
        "build-status"
    ).textContent =
        data.buildStatus ||
        "UNKNOWN";

    document.getElementById(
        "build-number"
    ).textContent =
        `Build #${data.buildNumber}`;

    const durationSeconds =
        (
            data.duration /
            1000
        ).toFixed(1);

    document.getElementById(
        "build-duration"
    ).textContent =
        `Duration: ${durationSeconds}s`;

} catch (error) {
    console.error(
        "Build status error:",
        error
    );

    document.getElementById(
        "build-status"
    ).textContent =
        "ERROR";

    document.getElementById(
        "build-number"
    ).textContent =
        "Build #--";

    document.getElementById(
        "build-duration"
    ).textContent =
        "Duration: --";
}

}

async function loadDashboard() {
await loadHealth();
await loadDeploymentStatus();
await loadBuildStatus();
}

function addEnvironmentVariableRow() {

const container =
    document.getElementById(
        "environment-variables"
    );

const row =
    document.createElement("div");

row.className =
    "env-row";

row.innerHTML = `
    <input
        type="text"
        class="env-key"
        placeholder="KEY"
    >

    <input
        type="text"
        class="env-value"
        placeholder="VALUE"
    >

    <button
        type="button"
        class="remove-env-button"
    >
        Remove
    </button>
`;

container.appendChild(row);

}

function addSecretRow() {

const container =
    document.getElementById(
        "secrets"
    );

const row =
    document.createElement("div");

row.className =
    "secret-row";

row.innerHTML = `
    <input
        type="text"
        class="secret-key"
        placeholder="SECRET_KEY"
    >

    <input
        type="password"
        class="secret-value"
        placeholder="SECRET_VALUE"
    >

    <button
        type="button"
        class="remove-secret-button"
    >
        Remove
    </button>
`;

container.appendChild(row);

}

function collectEnvironmentVariables() {

const rows =
    document.querySelectorAll(
        ".env-row"
    );

const environmentVariables = {};

rows.forEach(row => {

    const key =
        row
            .querySelector(".env-key")
            .value
            .trim();

    const value =
        row
            .querySelector(".env-value")
            .value;

    if (key) {
        environmentVariables[key] =
            value;
    }
});

return environmentVariables;

}

function collectSecrets() {

const rows =
    document.querySelectorAll(
        ".secret-row"
    );

const secrets = {};

rows.forEach(row => {

    const key =
        row
            .querySelector(".secret-key")
            .value
            .trim();

    const value =
        row
            .querySelector(".secret-value")
            .value;

    if (key) {
        secrets[key] =
            value;
    }
});

return secrets;

}

document.addEventListener(
"click",
event => {

    if (
        event.target.classList.contains(
            "remove-env-button"
        )
    ) {

        const rows =
            document.querySelectorAll(
                ".env-row"
            );

        if (rows.length > 1) {
            event.target
                .closest(".env-row")
                .remove();
        }
    }

    if (
        event.target.classList.contains(
            "remove-secret-button"
        )
    ) {

        const rows =
            document.querySelectorAll(
                ".secret-row"
            );

        if (rows.length > 1) {
            event.target
                .closest(".secret-row")
                .remove();
        }
    }
}

);

document
.getElementById("add-env-button")
.addEventListener(
"click",
addEnvironmentVariableRow
);

document
.getElementById("add-secret-button")
.addEventListener(
"click",
addSecretRow
);

async function rollbackApplication() {

if (!selectedAppId) {
    alert(
        "Select an application first."
    );

    return;
}

const rollbackButton =
    document.getElementById(
        "rollback-button"
    );

const confirmed =
    confirm(
        "Are you sure you want to rollback this deployment?"
    );

if (!confirmed) {
    return;
}

try {
    rollbackButton.disabled =
        true;

    rollbackButton.textContent =
        "Rolling Back...";

    const response =
        await fetch(
            `/api/applications/${encodeURIComponent(selectedAppId)}/rollback`,
            {
                method: "POST",
                headers: getAuthHeaders()
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

    await loadDeploymentStatus();
    await loadDeploymentHistory();
    await loadDeploymentLogs();
    await loadApplications();

} catch (error) {
    console.error(
        "Rollback error:",
        error
    );

    alert(
        `Rollback failed: ${error.message}`
    );

} finally {
    rollbackButton.disabled =
        false;

    rollbackButton.textContent =
        "Rollback Deployment";
}

}

async function redeployApplication() {

if (!selectedAppId) {
    alert(
        "Select an application first."
    );

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

button.disabled =
    true;

button.textContent =
    "Redeploying...";

try {
    const response =
        await fetch(
            `/api/applications/${encodeURIComponent(selectedAppId)}/deploy`,
            {
                method: "POST",
                headers: getAuthHeaders()
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
        `Redeployment started for "${data.application.name}".`
    );

    await loadApplications();
    await loadDeploymentStatus();
    await loadDeploymentHistory();
    await loadDeploymentLogs();

} catch (error) {
    console.error(
        "Redeployment error:",
        error
    );

    alert(
        error.message
    );

} finally {
    button.disabled =
        false;

    button.textContent =
        "Redeploy Application";
}

}

document
.getElementById("deploy-form")
.addEventListener(
"submit",
async event => {

        event.preventDefault();

        const name =
            document
                .getElementById(
                    "app-name"
                )
                .value
                .trim();

        const repository =
            document
                .getElementById(
                    "repository"
                )
                .value
                .trim();

        const branch =
            document
                .getElementById(
                    "branch"
                )
                .value
                .trim();

        const servicePath =
            document
                .getElementById(
                    "service-path"
                )
                .value
                .trim();

        const environmentVariables =
            collectEnvironmentVariables();

        const secrets =
            collectSecrets();

        try {

            const response =
                await fetch(
                    "/api/applications",
                    {
                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            ...getAuthHeaders()
                        },

                        body:
                            JSON.stringify({
                                name,
                                repository,
                                branch,
                                servicePath,
                                environmentVariables,
                                secrets
                            })
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    "Application creation failed"
                );
            }

            alert(
                `Application "${data.application.name}" created successfully`
            );

            document
                .getElementById(
                    "deploy-form"
                )
                .reset();

            document
                .getElementById(
                    "branch"
                )
                .value =
                "main";

            document
                .getElementById(
                    "environment-variables"
                )
                .innerHTML = `
                    <div class="env-row">

                        <input
                            type="text"
                            class="env-key"
                            placeholder="KEY"
                        >

                        <input
                            type="text"
                            class="env-value"
                            placeholder="VALUE"
                        >

                        <button
                            type="button"
                            class="remove-env-button"
                        >
                            Remove
                        </button>

                    </div>
                `;

            document
                .getElementById(
                    "secrets"
                )
                .innerHTML = `
                    <div class="secret-row">

                        <input
                            type="text"
                            class="secret-key"
                            placeholder="SECRET_KEY"
                        >

                        <input
                            type="password"
                            class="secret-value"
                            placeholder="SECRET_VALUE"
                        >

                        <button
                            type="button"
                            class="remove-secret-button"
                        >
                            Remove
                        </button>

                    </div>
                `;

            await loadApplications();

        } catch (error) {
            console.error(
                "Application deployment error:",
                error
            );

            alert(
                error.message
            );
        }
    }
);

document
.getElementById(
"application-selector"
)
.addEventListener(
"change",
async event => {

        selectedAppId =
            event.target.value;

        if (selectedAppId) {

            await loadDeploymentStatus();
            await loadDeploymentHistory();
            await loadDeploymentLogs();

        } else {

            document.getElementById(
                "deployment-logs"
            ).textContent =
                "Select an application to view logs.";
        }
    }
);

document
.getElementById(
"rollback-button"
)
.addEventListener(
"click",
rollbackApplication
);

document
.getElementById(
"redeploy-button"
)
.addEventListener(
"click",
redeployApplication
);

const logoutButton =
document.getElementById(
"logout-button"
);

if (logoutButton) {

logoutButton.addEventListener(
    "click",
    () => {

        localStorage.removeItem(
            "deployflow_token"
        );

        window.location.href =
            "/login.html";
    }
);

}

loadApplications();

loadDashboard();

setInterval(
loadDashboard,
5000
);