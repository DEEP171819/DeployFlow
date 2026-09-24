async function loadHealth() {
    try {
        const response = await fetch("/api/health");

        if (!response.ok) {
            throw new Error("Health check failed");
        }

        const data = await response.json();

        const appStatus = document.getElementById("app-status");

        appStatus.textContent = data.status;

    } catch (error) {
        console.error("Health check error:", error);

        document.getElementById("app-status").textContent = "DOWN";
    }
}

async function loadDeploymentStatus() {
    try {
        const response = await fetch("/api/deployment/status");

        if (!response.ok) {
            throw new Error("Deployment status request failed");
        }

        const data = await response.json();

        document.getElementById("deployment-status").textContent =
            data.status === "UP" ? "DEPLOYED" : "ERROR";

        document.getElementById("replicas").textContent =
            `${data.deployment.readyReplicas}/${data.deployment.replicas}`;

        document.getElementById("image").textContent =
            data.deployment.image;

        document.getElementById("hpa").textContent =
            `${data.hpa.currentReplicas}/${data.hpa.maxReplicas}`;

        const image = data.deployment.image;

        const version = image.includes(":")
            ? image.split(":").pop()
            : "Unknown";

        document.getElementById("version").textContent =
            `Build #${version}`;

        const podList = document.getElementById("pod-list");

        podList.innerHTML = "";

        data.pods.forEach((pod) => {

            const li = document.createElement("li");

            li.textContent =
                `${pod.name} - ${pod.status}`;

            podList.appendChild(li);
        });

    } catch (error) {

        console.error("Deployment status error:", error);

        document.getElementById("deployment-status").textContent =
            "ERROR";

        document.getElementById("replicas").textContent =
            "Unavailable";

        document.getElementById("image").textContent =
            "Unavailable";

        document.getElementById("hpa").textContent =
            "Unavailable";

        document.getElementById("version").textContent =
            "Unavailable";
    }
}

async function loadDashboard() {
    await loadHealth();
    await loadDeploymentStatus();
    await loadBuildStatus();
}

async function loadBuildStatus() {
    try {
        const response = await fetch("/api/build/status");

        if (!response.ok) {
            throw new Error("Build status request failed");
        }

        const data = await response.json();

        document.getElementById("build-status").textContent =
            data.buildStatus || "UNKNOWN";

        document.getElementById("build-number").textContent =
            `Build #${data.buildNumber}`;

        const durationSeconds = (data.duration / 1000).toFixed(1);

        document.getElementById("build-duration").textContent =
            `Duration: ${durationSeconds}s`;

    } catch (error) {
        console.error("Build status error:", error);

        document.getElementById("build-status").textContent =
            "ERROR";

        document.getElementById("build-number").textContent =
            "Build #--";

        document.getElementById("build-duration").textContent =
            "Duration: --";
    }
}

loadDashboard();

setInterval(loadDashboard, 5000);