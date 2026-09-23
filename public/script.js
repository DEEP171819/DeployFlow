fetch("/api/health")
    .then(response => response.json())
    .then(data => {
        document.getElementById("app-status").textContent =
            data.application + " is " + data.status;
    })
    .catch(error => {
        document.getElementById("app-status").textContent =
            "Application is DOWN";
    });