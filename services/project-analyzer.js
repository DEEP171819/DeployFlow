const fs = require("fs");
const path = require("path");

function exists(projectDir, file) {
    return fs.existsSync(path.join(projectDir, file));
}

function readJson(projectDir, file) {
    try {
        return JSON.parse(
            fs.readFileSync(
                path.join(projectDir, file),
                "utf8"
            )
        );
    } catch {
        return null;
    }
}

function readFile(projectDir, file) {
    try {
        return fs.readFileSync(
            path.join(projectDir, file),
            "utf8"
        );
    } catch {
        return "";
    }
}

function detectPackageManager(projectDir) {
    if (exists(projectDir, "pnpm-lock.yaml")) {
        return "pnpm";
    }

    if (exists(projectDir, "yarn.lock")) {
        return "yarn";
    }

    if (exists(projectDir, "package-lock.json")) {
        return "npm";
    }

    return "npm";
}

function getPackageCommands(packageManager) {
    if (packageManager === "pnpm") {
        return {
            install: "pnpm install --frozen-lockfile",
            installProduction: "pnpm install --prod --frozen-lockfile",
            run: "pnpm"
        };
    }

    if (packageManager === "yarn") {
        return {
            install: "yarn install --frozen-lockfile",
            installProduction: "yarn install --production",
            run: "yarn"
        };
    }

    return {
        install: "npm ci",
        installProduction: "npm ci --omit=dev",
        run: "npm"
    };
}

function detectNodePort(packageJson, fallback = 3000) {
    const deployflow = packageJson.deployflow;

    if (
        deployflow &&
        Number.isInteger(deployflow.port) &&
        deployflow.port > 0 &&
        deployflow.port <= 65535
    ) {
        return deployflow.port;
    }

    const scripts = packageJson.scripts || {};

    const allScripts = Object.values(scripts).join(" ");

    const portMatch = allScripts.match(
        /(?:--port|-p)[=\s]+(\d{2,5})/
    );

    if (portMatch) {
        const port = Number(portMatch[1]);

        if (port > 0 && port <= 65535) {
            return port;
        }
    }

    return fallback;
}

function detectNode(projectDir, packageJson) {
    const scripts = packageJson.scripts || {};

    const dependencies = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
    };

    const packageManager =
        detectPackageManager(projectDir);

    const commands =
        getPackageCommands(packageManager);

    const isNext =
        Boolean(dependencies.next) ||
        exists(projectDir, "next.config.js") ||
        exists(projectDir, "next.config.mjs") ||
        exists(projectDir, "next.config.ts");

    const isVite =
        Boolean(dependencies.vite) ||
        exists(projectDir, "vite.config.js") ||
        exists(projectDir, "vite.config.mjs") ||
        exists(projectDir, "vite.config.ts");

    const isReact =
        Boolean(dependencies.react) ||
        Boolean(dependencies["react-dom"]);

    const isExpress =
        Boolean(dependencies.express);

    if (isNext) {
        return {
            type: "node",
            framework: "nextjs",
            packageManager,
            buildCommand:
                scripts.build ||
                `${commands.run} run build`,
            startCommand:
                scripts.start ||
                `${commands.run} start`,
            port:
                detectNodePort(
                    packageJson,
                    3000
                ),
            healthPath: "/",
            isStatic: false,
            outputDirectory: ".next",
            existingDockerfile: false
        };
    }

    if (isVite) {
        return {
            type: "node",
            framework: "vite",
            packageManager,
            buildCommand:
                scripts.build ||
                `${commands.run} run build`,
            startCommand: null,
            port: 4173,
            healthPath: "/",
            isStatic: true,
            outputDirectory: "dist",
            existingDockerfile: false
        };
    }

    if (isReact) {
        return {
            type: "node",
            framework: "react",
            packageManager,
            buildCommand:
                scripts.build ||
                `${commands.run} run build`,
            startCommand: null,
            port: 80,
            healthPath: "/",
            isStatic: true,
            outputDirectory: "build",
            existingDockerfile: false
        };
    }

    return {
        type: "node",
        framework: isExpress
            ? "express"
            : "node",
        packageManager,
        buildCommand:
            scripts.build ||
            commands.install,
        startCommand:
            scripts.start ||
            `${commands.run} start`,
        port:
            detectNodePort(
                packageJson,
                3000
            ),
        healthPath:
            packageJson.deployflow?.healthPath ||
            "/",
        isStatic: false,
        outputDirectory: null,
        existingDockerfile: false
    };
}

function detectPython(projectDir) {
    if (!exists(projectDir, "requirements.txt")) {
        return null;
    }

    const requirements =
        readFile(
            projectDir,
            "requirements.txt"
        ).toLowerCase();

    let framework = "python";
    let port = 8000;
    let startCommand = null;

    if (requirements.includes("fastapi")) {
        framework = "fastapi";
        port = 8000;

        if (exists(projectDir, "main.py")) {
            startCommand =
                "uvicorn main:app --host 0.0.0.0 --port 8000";
        }
    } else if (
        requirements.includes("flask")
    ) {
        framework = "flask";
        port = 5000;

        if (exists(projectDir, "app.py")) {
            startCommand =
                "gunicorn --bind 0.0.0.0:5000 app:app";
        }
    } else if (
        requirements.includes("django")
    ) {
        framework = "django";
        port = 8000;

        startCommand =
            "gunicorn --bind 0.0.0.0:8000 app.wsgi:application";
    }

    return {
        type: "python",
        framework,
        packageManager: "pip",
        buildCommand:
            "pip install -r requirements.txt",
        startCommand,
        port,
        healthPath: "/",
        isStatic: false,
        outputDirectory: null,
        existingDockerfile: false
    };
}

function detectJava(projectDir) {
    if (exists(projectDir, "pom.xml")) {
        return {
            type: "java",
            framework: "maven",
            packageManager: "maven",
            buildCommand:
                "mvn clean package -DskipTests",
            startCommand:
                "java -jar target/app.jar",
            port: 8080,
            healthPath: "/",
            isStatic: false,
            outputDirectory: "target",
            existingDockerfile: false
        };
    }

    if (
        exists(projectDir, "build.gradle") ||
        exists(projectDir, "build.gradle.kts")
    ) {
        return {
            type: "java",
            framework: "gradle",
            packageManager: "gradle",
            buildCommand:
                "gradle build",
            startCommand:
                "java -jar build/libs/app.jar",
            port: 8080,
            healthPath: "/",
            isStatic: false,
            outputDirectory: "build/libs",
            existingDockerfile: false
        };
    }

    return null;
}

function detectGo(projectDir) {
    if (!exists(projectDir, "go.mod")) {
        return null;
    }

    return {
        type: "go",
        framework: "go",
        packageManager: "go",
        buildCommand:
            "go build -o app",
        startCommand:
            "./app",
        port: 8080,
        healthPath: "/",
        isStatic: false,
        outputDirectory: null,
        existingDockerfile: false
    };
}

function detectDocker(projectDir) {
    if (!exists(projectDir, "Dockerfile")) {
        return null;
    }

    return {
        type: "docker",
        framework: "docker",
        packageManager: null,
        buildCommand: null,
        startCommand: null,
        port: 3000,
        healthPath: "/",
        isStatic: false,
        outputDirectory: null,
        existingDockerfile: true
    };
}

function analyzeProject(projectDir) {
    if (!fs.existsSync(projectDir)) {
        throw new Error(
            `Project directory does not exist: ${projectDir}`
        );
    }

    const docker =
        detectDocker(projectDir);

    if (docker) {
        return docker;
    }

    const packageJson =
        readJson(
            projectDir,
            "package.json"
        );

    if (packageJson) {
        return detectNode(
            projectDir,
            packageJson
        );
    }

    const python =
        detectPython(projectDir);

    if (python) {
        return python;
    }

    const java =
        detectJava(projectDir);

    if (java) {
        return java;
    }

    const go =
        detectGo(projectDir);

    if (go) {
        return go;
    }

    throw new Error(
        "Unsupported project. No Dockerfile, package.json, requirements.txt, pom.xml, build.gradle or go.mod found."
    );
}

if (require.main === module) {
    const projectDir = process.argv[2] || ".";

    try {
        const result = analyzeProject(projectDir);

        console.log(
            JSON.stringify(result, null, 2)
        );
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}



module.exports = {
    analyzeProject
};