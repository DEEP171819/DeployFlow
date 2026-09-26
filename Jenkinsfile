pipeline {

    agent any

    parameters {
        string(
            name: 'REPOSITORY',
            defaultValue: '',
            description: 'Git repository URL'
        )

        string(
            name: 'BRANCH',
            defaultValue: 'main',
            description: 'Git branch'
        )

        string(
            name: 'SERVICE_PATH',
            defaultValue: '',
            description: 'Optional service directory inside repository'
        )

        string(
            name: 'APP_ID',
            defaultValue: '',
            description: 'Application ID'
        )

        string(
            name: 'APP_NAME',
            defaultValue: '',
            description: 'Application name'
        )

        text(
            name: 'ENV_VARS',
            defaultValue: '{}',
            description: 'Environment variables as JSON'
        )

        

        text(
            name: 'SECRETS',
            defaultValue: '{}',
            description: 'Application secrets as JSON'
        )
    }

    environment {
        DOCKER_USERNAME = 'deepak97813'
        ANALYSIS_FILE = 'deployflow-env.properties'
    }

    stages {

        stage('Checkout') {
            steps {
                dir('app') {
                    deleteDir()

                    git(
                        url: params.REPOSITORY,
                        branch: params.BRANCH
                    )
                }
            }
        }

        stage('Validate Service Path') {
            steps {
                script {

                    def servicePath =
                        params.SERVICE_PATH?.trim() ?: ''

                    echo "Service Path: ${servicePath ?: '(repository root)'}"

                    def serviceDir = 'app'

                    if (servicePath) {
                        serviceDir =
                            "app\\${servicePath.replace('/', '\\')}"
                    }

                    echo "Service Directory: ${serviceDir}"

                    if (
                        servicePath.contains('..') ||
                        servicePath.startsWith('/') ||
                        servicePath.startsWith('\\') ||
                        servicePath ==~ /^[A-Za-z]:.*/
                    ) {
                        error "Invalid service path"
                    }

                    if (!fileExists(serviceDir)) {
                        error "Service directory does not exist: ${serviceDir}"
                    }
                }
            }
        }

        stage('Analyze Project') {
            steps {
                script {

                    def serviceDir = 'app'

                    if (params.SERVICE_PATH?.trim()) {
                        serviceDir =
                            "app\\${params.SERVICE_PATH.trim().replace('/', '\\')}"
                    }

                    if (!fileExists(serviceDir)) {
                        error "Service directory does not exist: ${serviceDir}"
                    }

                    echo "Analyzing: ${serviceDir}"

                    def analyzerOutput = bat(
                        script:
                            "node \"${env.WORKSPACE}\\services\\project-analyzer.js\" \"${serviceDir}\"",
                        returnStdout: true
                    ).trim()

                    echo "Analyzer Output:"
                    echo analyzerOutput

                    def jsonStart =
                        analyzerOutput.indexOf('{')

                    if (jsonStart < 0) {
                        error "Analyzer did not return valid JSON"
                    }

                    def json =
                        analyzerOutput.substring(jsonStart)

                    writeFile(
                        file: 'analysis.json',
                        text: json
                    )

                    /*
                     * Convert analyzer JSON into a simple
                     * KEY=VALUE properties file.
                     *
                     * Node performs the JSON parsing so Jenkins
                     * does not require readJSON or Groovy JSON
                     * script approval.
                     */

                    bat '''
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('analysis.json','utf8')); const lines=['PROJECT_TYPE='+String(a.type||''),'FRAMEWORK='+String(a.framework||''),'PACKAGE_MANAGER='+String(a.packageManager||''),'BUILD_COMMAND='+String(a.buildCommand||''),'START_COMMAND='+String(a.startCommand||''),'PORT='+String(a.port||3000),'HEALTH_PATH='+String(a.healthPath||'/'),'IS_STATIC='+(a.isStatic?'true':'false'),'OUTPUT_DIRECTORY='+String(a.outputDirectory||''),'EXISTING_DOCKERFILE='+(a.existingDockerfile?'true':'false')]; fs.writeFileSync('deployflow-env.properties',lines.join('\\n'));"
'''

                    def propertiesText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    echo "Analysis Properties:"
                    echo propertiesText

                    /*
                     * Parse KEY=VALUE pairs.
                     */

                    def analysis = [:]

                    propertiesText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {

                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    /*
                     * Validate analyzer result.
                     */

                    if (!analysis['PROJECT_TYPE']?.trim()) {
                        error "Project analyzer returned an empty project type"
                    }

                    /*
                     * Save analyzer JSON as well.
                     */

                    writeFile(
                        file: '.deployflow-analysis.json',
                        text: json
                    )

                    echo """
==============================
 DeployFlow Project Analysis
==============================
Project Type:        ${analysis['PROJECT_TYPE']}
Framework:           ${analysis['FRAMEWORK']}
Package Manager:     ${analysis['PACKAGE_MANAGER']}
Build Command:       ${analysis['BUILD_COMMAND']}
Start Command:       ${analysis['START_COMMAND']}
Port:                ${analysis['PORT']}
Health Path:         ${analysis['HEALTH_PATH']}
Static Application:  ${analysis['IS_STATIC']}
Output Directory:    ${analysis['OUTPUT_DIRECTORY']}
Existing Dockerfile: ${analysis['EXISTING_DOCKERFILE']}
Service Path:        ${params.SERVICE_PATH?.trim() ?: '(repository root)'}
==============================
"""

                    /*
                     * Store the values in files rather than
                     * relying on Jenkins env mutation.
                     */

                    writeFile(
                        file: 'deployflow-analysis.env',
                        text: """PROJECT_TYPE=${analysis['PROJECT_TYPE']}
FRAMEWORK=${analysis['FRAMEWORK']}
PACKAGE_MANAGER=${analysis['PACKAGE_MANAGER']}
BUILD_COMMAND=${analysis['BUILD_COMMAND']}
START_COMMAND=${analysis['START_COMMAND']}
PORT=${analysis['PORT']}
HEALTH_PATH=${analysis['HEALTH_PATH']}
IS_STATIC=${analysis['IS_STATIC']}
OUTPUT_DIRECTORY=${analysis['OUTPUT_DIRECTORY']}
EXISTING_DOCKERFILE=${analysis['EXISTING_DOCKERFILE']}
"""
                    )
                }
            }
        }

        stage('Install Dependencies') {
            steps {
                script {

                    def analysisText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    def analysis = [:]

                    analysisText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {
                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    def projectType =
                        analysis['PROJECT_TYPE']

                    def serviceDir = 'app'

                    if (params.SERVICE_PATH?.trim()) {
                        serviceDir =
                            "app\\${params.SERVICE_PATH.trim().replace('/', '\\')}"
                    }

                    echo "Installing dependencies for: ${projectType}"

                    if (projectType == 'node') {

                        dir(serviceDir) {
                            bat 'npm install'
                        }

                    } else if (projectType == 'python') {

                        dir(serviceDir) {

                            if (fileExists('requirements.txt')) {
                                bat 'python -m pip install -r requirements.txt'
                            } else {
                                echo 'No requirements.txt found'
                            }
                        }

                    } else if (projectType == 'java') {

                        dir(serviceDir) {

                            if (fileExists('pom.xml')) {
                                bat 'mvn install -DskipTests'
                            } else {
                                echo 'No pom.xml found'
                            }
                        }

                    } else if (projectType == 'docker') {

                        echo 'Docker project detected. Dependency installation handled by Dockerfile.'

                    } else if (projectType == 'go') {

                        dir(serviceDir) {
                            bat 'go mod download'
                        }

                    } else {

                        error "Unsupported project type: ${projectType}"
                    }
                }
            }
        }

        stage('Build and Test') {
            steps {
                script {

                    def analysisText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    def analysis = [:]

                    analysisText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {
                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    def projectType =
                        analysis['PROJECT_TYPE']

                    def serviceDir = 'app'

                    if (params.SERVICE_PATH?.trim()) {
                        serviceDir =
                            "app\\${params.SERVICE_PATH.trim().replace('/', '\\')}"
                    }

                    echo "Build/Test project type: ${projectType}"

                    if (projectType == 'node') {

                        dir(serviceDir) {

                            if (fileExists('package.json')) {

                                bat 'npm test --if-present'
                                bat 'npm run build --if-present'

                            }
                        }

                    } else if (projectType == 'python') {

                        dir(serviceDir) {

                            if (fileExists('pytest.ini') ||
                                fileExists('tests')) {

                                bat 'python -m pytest'

                            } else {

                                echo 'No pytest configuration found. Skipping tests.'
                            }
                        }

                    } else if (projectType == 'java') {

                        dir(serviceDir) {

                            if (fileExists('pom.xml')) {
                                bat 'mvn test'
                            }

                        }

                    } else if (projectType == 'go') {

                        dir(serviceDir) {

                            bat 'go test ./...'

                        }

                    } else if (projectType == 'docker') {

                        echo 'Docker project detected. Dockerfile will perform application build.'

                    } else {

                        error "Unsupported project type: ${projectType}"
                    }
                }
            }
        }

        stage('Prepare Dockerfile') {
            steps {
                script {

                    def analysisText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    def analysis = [:]

                    analysisText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {

                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    def serviceDir = 'app'

                    if (params.SERVICE_PATH?.trim()) {
                        serviceDir =
                            "app\\${params.SERVICE_PATH.trim().replace('/', '\\')}"
                    }

                    def existingDockerfile =
                        analysis['EXISTING_DOCKERFILE'] == 'true'

                    if (existingDockerfile) {

                        echo "Existing Dockerfile detected."

                    } else {

                        echo "No Dockerfile detected. Generating one."

                        def projectType =
                            analysis['PROJECT_TYPE']

                        def port =
                            analysis['PORT'] ?: '3000'

                        if (projectType == 'node') {

                            writeFile(
                                file: "${serviceDir}\\Dockerfile",
                                text: """FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE ${port}

CMD ["npm", "start"]
"""
                            )

                        } else if (projectType == 'python') {

                            writeFile(
                                file: "${serviceDir}\\Dockerfile",
                                text: """FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${port}

CMD ["python", "app.py"]
"""
                            )

                        } else if (projectType == 'go') {

                            writeFile(
                                file: "${serviceDir}\\Dockerfile",
                                text: """FROM golang:1.25 AS builder

WORKDIR /app

COPY . .

RUN go build -o app .

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/app .

EXPOSE ${port}

CMD ["./app"]
"""
                            )

                        } else if (projectType == 'java') {

                            if (fileExists("${serviceDir}\\pom.xml")) {

                                writeFile(
                                    file: "${serviceDir}\\Dockerfile",
                                    text: """FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .

RUN mvn dependency:go-offline

COPY . .

RUN mvn package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

EXPOSE ${port}

CMD ["java", "-jar", "app.jar"]
"""
                                )

                            } else {

                                error "Java project detected but pom.xml was not found."
                            }

                        } else {

                            error "Cannot automatically generate Dockerfile for project type: ${projectType}"
                        }

                        echo "Dockerfile generated successfully."
                    }
                }
            }
        }

        stage('Build Docker Image') {
    steps {
        script {

            def serviceDir = 'app'

            if (params.SERVICE_PATH?.trim()) {
                serviceDir =
                    "app\\${params.SERVICE_PATH.trim().replace('/', '\\')}"
            }

            def dockerImage =
                "deepak97813/${params.APP_ID}:${env.BUILD_NUMBER}"

            echo "Building Docker image:"
            echo dockerImage

            dir(serviceDir) {

                bat(
                    "docker build -t ${dockerImage} ."
                )
            }

            echo "Docker image built successfully:"
            echo dockerImage
        }
    }
}

        stage('Push Docker Image') {
    steps {
        script {

            def dockerImage =
                "deepak97813/${params.APP_ID}:${env.BUILD_NUMBER}"

            echo "Pushing Docker image:"
            echo dockerImage

            withCredentials([
                usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASSWORD'
                )
            ]) {

                bat '''
                    @echo off
                    echo Docker username received: %DOCKER_USER%

                    echo Logging in to Docker Hub...

                    echo %DOCKER_PASSWORD% | docker login -u "%DOCKER_USER%" --password-stdin

                    if errorlevel 1 (
                        echo Docker Hub login FAILED
                        exit /b 1
                    )

                    echo Docker Hub login SUCCESSFUL
                '''
            }
        }
    }
}
        stage('Prepare Kubernetes Manifest') {
            steps {
                script {

                    def analysisText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    def analysis = [:]

                    analysisText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {

                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    def projectType =
                        analysis['PROJECT_TYPE']

                    def framework =
                        analysis['FRAMEWORK']

                    def port =
                        analysis['PORT'] ?: '3000'

                    def healthPath =
                        analysis['HEALTH_PATH'] ?: '/'

                    def isStatic =
                        analysis['IS_STATIC'] ?: 'false'

                    def outputDirectory =
                        analysis['OUTPUT_DIRECTORY'] ?: ''

                    def existingDockerfile =
                        analysis['EXISTING_DOCKERFILE'] ?: 'false'

                    echo "Preparing Kubernetes manifests."

                    echo "Project Type: ${projectType}"
                    echo "Framework: ${framework}"
                    echo "Port: ${port}"
                    echo "Health Path: ${healthPath}"
                    echo "Static: ${isStatic}"

                    withEnv([
                        "PROJECT_TYPE=${projectType}",
                        "FRAMEWORK=${framework}",
                        "PORT=${port}",
                        "HEALTH_PATH=${healthPath}",
                        "IS_STATIC=${isStatic}",
                        "OUTPUT_DIRECTORY=${outputDirectory}",
                        "EXISTING_DOCKERFILE=${existingDockerfile}",
                        "ENV_VARS=${params.ENV_VARS}",
                        "SECRETS=${params.SECRETS}"
                    ]) {

                        bat(
                            script:
                                "powershell -ExecutionPolicy Bypass -File \"${env.WORKSPACE}\\scripts\\prepare-k8s.ps1\""
                        )
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                script {

                    echo "Deploying application to Kubernetes."

                    bat(
                        "kubectl apply -f k8s\\configmap-rendered.yaml"
                    )

                    bat(
                        "kubectl apply -f k8s\\secret-rendered.yaml"
                    )

                    bat(
                        "kubectl apply -f k8s\\deployment-rendered.yaml"
                    )

                    bat(
                        "kubectl apply -f k8s\\service-rendered.yaml"
                    )

                    bat(
                        "kubectl apply -f k8s\\hpa-rendered.yaml"
                    )

                    bat(
                        "kubectl apply -f k8s\\ingress-rendered.yaml"
                    )

                    echo "Kubernetes resources applied successfully."
                }
            }
        }

        stage('Health Check') {
            steps {
                script {

                    def analysisText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    def analysis = [:]

                    analysisText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {

                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    def port =
                        analysis['PORT'] ?: '3000'

                    echo "Checking Kubernetes pods."

                    bat(
                        "kubectl get pods -l app=${params.APP_ID}"
                    )

                    echo "Checking Kubernetes service."

                    bat(
                        "kubectl get service ${params.APP_ID}-service"
                    )

                    echo "Health check completed."
                }
            }
        }

        stage('Deployment Verification') {
            steps {
                script {

                    echo "Verifying deployment."

                    bat(
                        "kubectl rollout status deployment/${params.APP_ID} --timeout=120s"
                    )

                    echo "Deployment rollout successful."

                    bat(
                        "kubectl get deployment ${params.APP_ID}"
                    )

                    bat(
                        "kubectl get pods -l app=${params.APP_ID}"
                    )

                    bat(
                        "kubectl get ingress ${params.APP_ID}-ingress"
                    )
                }
            }
        }

        stage('Deployment Summary') {
            steps {
                script {

                    def analysisText =
                        readFile(
                            file: 'deployflow-env.properties'
                        ).trim()

                    def analysis = [:]

                    analysisText.readLines().each { line ->

                        def separator =
                            line.indexOf('=')

                        if (separator > 0) {

                            def key =
                                line.substring(
                                    0,
                                    separator
                                ).trim()

                            def value =
                                line.substring(
                                    separator + 1
                                ).trim()

                            analysis[key] = value
                        }
                    }

                    echo """
==================================================
             DeployFlow Deployment
==================================================

Application:
    ${params.APP_NAME}

Application ID:
    ${params.APP_ID}

Repository:
    ${params.REPOSITORY}

Branch:
    ${params.BRANCH}

Service Path:
    ${params.SERVICE_PATH?.trim() ?: '(repository root)'}

Project Type:
    ${analysis['PROJECT_TYPE']}

Framework:
    ${analysis['FRAMEWORK']}

Port:
    ${analysis['PORT']}

Health Path:
    ${analysis['HEALTH_PATH']}

Docker Image:
    deepak97813/${params.APP_ID}:${env.BUILD_NUMBER}

Kubernetes:
    Deployment: ${params.APP_ID}
    Service:    ${params.APP_ID}-service
    Ingress:    ${params.APP_ID}-ingress

Application URL:
    http://${params.APP_ID}.localhost

==================================================
"""
                }
            }
        }
    }

    post {

        success {
            echo "DeployFlow pipeline completed successfully."
        }

        failure {
            echo "DeployFlow pipeline failed."
        }

        always {
            echo "Pipeline finished."
        }
    }
}