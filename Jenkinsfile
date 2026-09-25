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
            description: 'Application directory inside repository. Leave empty for repository root.'
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

        password(
            name: 'SECRETS',
            defaultValue: '{}',
            description: 'Secrets as JSON'
        )
    }

    environment {
        DOCKER_USERNAME = 'deepak97813'
        DOCKER_IMAGE = ''

        PROJECT_TYPE = ''
        FRAMEWORK = ''
        PACKAGE_MANAGER = ''
        BUILD_COMMAND = ''
        START_COMMAND = ''
        PORT = '3000'
        HEALTH_PATH = '/'
        IS_STATIC = 'false'
        OUTPUT_DIRECTORY = ''
        EXISTING_DOCKERFILE = 'false'
    }

    stages {

        stage('Checkout') {
            steps {
                dir('app') {
                    deleteDir()

                    git(
                        branch: params.BRANCH,
                        url: params.REPOSITORY
                    )
                }
            }
        }

        stage('Validate Service Path') {
            steps {
                script {
                    def servicePath = params.SERVICE_PATH?.trim() ?: ''

                    def serviceDir = servicePath
                        ? "app/${servicePath}"
                        : "app"

                    echo "Service Path: ${servicePath ?: '(repository root)'}"
                    echo "Service Directory: ${serviceDir}"

                    if (!fileExists(serviceDir)) {
                        error(
                            "Service path does not exist: ${servicePath ?: '(repository root)'}"
                        )
                    }

                    if (
                        !fileExists("${serviceDir}\\package.json") &&
                        !fileExists("${serviceDir}\\requirements.txt") &&
                        !fileExists("${serviceDir}\\pom.xml") &&
                        !fileExists("${serviceDir}\\build.gradle") &&
                        !fileExists("${serviceDir}\\go.mod") &&
                        !fileExists("${serviceDir}\\Dockerfile") &&
                        !fileExists("${serviceDir}\\docker-compose.yml") &&
                        !fileExists("${serviceDir}\\index.html")
                    ) {
                        echo "Warning: Could not identify a standard project file yet."
                    }

                    if (!params.APP_ID?.trim()) {
                        error("APP_ID is required.")
                    }

                    env.DOCKER_IMAGE =
                        "deepak97813/${params.APP_ID.trim()}"
                }
            }
        }

        stage('Analyze Project') {
    steps {
        script {
            def serviceDir = 'app'

            if (params.SERVICE_PATH?.trim()) {
                serviceDir = "app\\${params.SERVICE_PATH.trim().replace('/', '\\')}"
            }

            if (!fileExists(serviceDir)) {
                error "Service directory does not exist: ${serviceDir}"
            }

            echo "Analyzing: ${serviceDir}"

            def analyzerOutput = bat(
                script: "node \"${env.WORKSPACE}\\services\\project-analyzer.js\" \"${serviceDir}\"",
                returnStdout: true
            ).trim()

            echo "Analyzer Output:"
            echo analyzerOutput

            def jsonStart = analyzerOutput.indexOf('{')

            if (jsonStart < 0) {
                error "Analyzer did not return valid JSON"
            }

            def json = analyzerOutput.substring(jsonStart)

            writeFile(
                file: 'analysis.json',
                text: json
            )

            bat '''
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('analysis.json','utf8')); const lines=['PROJECT_TYPE='+String(a.type||''),'FRAMEWORK='+String(a.framework||''),'PACKAGE_MANAGER='+String(a.packageManager||''),'BUILD_COMMAND='+String(a.buildCommand||''),'START_COMMAND='+String(a.startCommand||''),'PORT='+String(a.port||3000),'HEALTH_PATH='+String(a.healthPath||'/'),'IS_STATIC='+(a.isStatic?'true':'false'),'OUTPUT_DIRECTORY='+String(a.outputDirectory||''),'EXISTING_DOCKERFILE='+(a.existingDockerfile?'true':'false')]; fs.writeFileSync('analysis.properties',lines.join('\\n'));"
'''

            echo "Generated analysis.properties"

            def propertiesText = readFile(
                file: 'analysis.properties'
            ).trim()

            echo "Analysis Properties:"
            echo propertiesText

            /*
             * Parse properties directly.
             * No Groovy JSON parser.
             * No Jenkins readJSON plugin.
             * No separate bat command for every property.
             */

            def analysisValues = [:]

            propertiesText.readLines().each { line ->
                def separator = line.indexOf('=')

                if (separator > 0) {
                    def key = line.substring(0, separator).trim()
                    def value = line.substring(separator + 1).trim()

                    analysisValues[key] = value
                }
            }

            env.PROJECT_TYPE = analysisValues.get('PROJECT_TYPE', '')
            env.FRAMEWORK = analysisValues.get('FRAMEWORK', '')
            env.PACKAGE_MANAGER = analysisValues.get('PACKAGE_MANAGER', '')
            env.BUILD_COMMAND = analysisValues.get('BUILD_COMMAND', '')
            env.START_COMMAND = analysisValues.get('START_COMMAND', '')
            env.PORT = analysisValues.get('PORT', '3000')
            env.HEALTH_PATH = analysisValues.get('HEALTH_PATH', '/')
            env.IS_STATIC = analysisValues.get('IS_STATIC', 'false')
            env.OUTPUT_DIRECTORY = analysisValues.get('OUTPUT_DIRECTORY', '')
            env.EXISTING_DOCKERFILE = analysisValues.get('EXISTING_DOCKERFILE', 'false')

            echo """
==============================
 DeployFlow Project Analysis
==============================
Project Type:        ${env.PROJECT_TYPE}
Framework:           ${env.FRAMEWORK}
Package Manager:     ${env.PACKAGE_MANAGER}
Build Command:       ${env.BUILD_COMMAND}
Start Command:       ${env.START_COMMAND}
Port:                ${env.PORT}
Health Path:         ${env.HEALTH_PATH}
Static Application:  ${env.IS_STATIC}
Output Directory:    ${env.OUTPUT_DIRECTORY}
Existing Dockerfile: ${env.EXISTING_DOCKERFILE}
Service Path:        ${params.SERVICE_PATH?.trim() ?: '(repository root)'}
==============================
"""

            if (!env.PROJECT_TYPE?.trim()) {
                error "Project analyzer returned an empty project type"
            }
        }
    }
}

        stage('Install Dependencies') {
            steps {
                script {
                    def servicePath =
                        params.SERVICE_PATH?.trim() ?: ''

                    def serviceDir =
                        servicePath
                            ? "app/${servicePath}"
                            : "app"

                    if (env.PROJECT_TYPE == 'docker') {

                        echo "Dependencies handled by existing Dockerfile."

                    } else if (env.PROJECT_TYPE == 'node') {

                        dir(serviceDir) {

                            if (
                                env.PACKAGE_MANAGER ==
                                'pnpm'
                            ) {

                                bat '''
                                corepack enable
                                pnpm install --frozen-lockfile
                                '''

                            } else if (
                                env.PACKAGE_MANAGER ==
                                'yarn'
                            ) {

                                bat '''
                                corepack enable
                                yarn install --frozen-lockfile
                                '''

                            } else {

                                bat '''
                                npm ci
                                '''
                            }
                        }

                    } else if (
                        env.PROJECT_TYPE == 'python'
                    ) {

                        dir(serviceDir) {

                            bat '''
                            python -m pip install --upgrade pip
                            python -m pip install -r requirements.txt
                            '''
                        }

                    } else if (
                        env.PROJECT_TYPE == 'java'
                    ) {

                        dir(serviceDir) {

                            if (
                                env.PACKAGE_MANAGER ==
                                'maven'
                            ) {

                                bat '''
                                mvn dependency:go-offline
                                '''

                            } else {

                                bat '''
                                gradle dependencies
                                '''
                            }
                        }

                    } else if (
                        env.PROJECT_TYPE == 'go'
                    ) {

                        dir(serviceDir) {

                            bat '''
                            go mod download
                            '''
                        }

                    } else {

                        error(
                            "Unsupported project type: ${env.PROJECT_TYPE}"
                        )
                    }
                }
            }
        }

        stage('Build and Test') {
            steps {
                script {
                    def servicePath =
                        params.SERVICE_PATH?.trim() ?: ''

                    def serviceDir =
                        servicePath
                            ? "app/${servicePath}"
                            : "app"

                    if (env.PROJECT_TYPE == 'docker') {

                        echo "Build and test are handled by the existing Dockerfile."

                    } else {

                        dir(serviceDir) {

                            if (
                                env.PROJECT_TYPE ==
                                'node'
                            ) {

                                if (
                                    env.BUILD_COMMAND &&
                                    env.BUILD_COMMAND != 'npm ci'
                                ) {

                                    bat """
                                    ${env.BUILD_COMMAND}
                                    """
                                }

                                bat '''
                                npm test --if-present
                                '''

                            } else if (
                                env.PROJECT_TYPE ==
                                'python'
                            ) {

                                bat '''
                                if exist tests (
                                    python -m pytest
                                ) else (
                                    echo No Python tests directory found. Skipping tests.
                                )
                                '''

                            } else if (
                                env.PROJECT_TYPE ==
                                'java'
                            ) {

                                if (
                                    env.PACKAGE_MANAGER ==
                                    'maven'
                                ) {

                                    bat '''
                                    mvn test
                                    '''

                                } else {

                                    bat '''
                                    gradle test
                                    '''
                                }

                            } else if (
                                env.PROJECT_TYPE ==
                                'go'
                            ) {

                                bat '''
                                go test ./...
                                '''

                            } else {

                                echo "No build/test handler available."
                            }
                        }
                    }
                }
            }
        }

        stage('Prepare Dockerfile') {
            steps {
                script {
                    def servicePath =
                        params.SERVICE_PATH?.trim() ?: ''

                    def serviceDir =
                        servicePath
                            ? "app/${servicePath}"
                            : "app"

                    if (
                        env.EXISTING_DOCKERFILE ==
                        'true'
                    ) {

                        echo "Existing Dockerfile detected. Using project Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        'node'
                    ) {

                        if (
                            env.IS_STATIC ==
                            'true'
                        ) {

                            def dockerfile = """
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN ${env.BUILD_COMMAND}

FROM nginx:alpine

COPY --from=build /app/${env.OUTPUT_DIRECTORY} /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
"""

                            writeFile(
                                file:
                                    "${serviceDir}/Dockerfile",
                                text:
                                    dockerfile.trim()
                            )

                        } else {

                            if (!env.START_COMMAND) {
                                error(
                                    "Could not determine Node.js start command."
                                )
                            }

                            def startParts =
                                env.START_COMMAND
                                    .trim()
                                    .split(/\s+/)

                            def dockerCommand =
                                startParts.collect {
                                    "\"${it}\""
                                }.join(", ")

                            def dockerfile = """
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV PORT=${env.PORT}

EXPOSE ${env.PORT}

CMD [${dockerCommand}]
"""

                            writeFile(
                                file:
                                    "${serviceDir}/Dockerfile",
                                text:
                                    dockerfile.trim()
                            )
                        }

                        echo "Generated Node.js Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        'python'
                    ) {

                        if (!env.START_COMMAND) {
                            error(
                                "Could not determine Python start command."
                            )
                        }

                        def escapedStartCommand =
                            env.START_COMMAND
                                .replace(
                                    '\\',
                                    '\\\\'
                                )
                                .replace(
                                    '"',
                                    '\\"'
                                )

                        def dockerfile = """
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${env.PORT}

CMD ["sh", "-c", "${escapedStartCommand}"]
"""

                        writeFile(
                            file:
                                "${serviceDir}/Dockerfile",
                            text:
                                dockerfile.trim()
                        )

                        echo "Generated Python Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        'java'
                    ) {

                        if (
                            env.PACKAGE_MANAGER ==
                            'maven'
                        ) {

                            def dockerfile = """
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .

COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE ${env.PORT}

ENTRYPOINT ["java", "-jar", "app.jar"]
"""

                            writeFile(
                                file:
                                    "${serviceDir}/Dockerfile",
                                text:
                                    dockerfile.trim()
                            )

                        } else {

                            def dockerfile = """
FROM gradle:8-jdk21 AS build

WORKDIR /app

COPY . .

RUN gradle build --no-daemon

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE ${env.PORT}

ENTRYPOINT ["java", "-jar", "app.jar"]
"""

                            writeFile(
                                file:
                                    "${serviceDir}/Dockerfile",
                                text:
                                    dockerfile.trim()
                            )
                        }

                        echo "Generated Java Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        'go'
                    ) {

                        def dockerfile = """
FROM golang:1.24-alpine AS build

WORKDIR /app

COPY . .

RUN go build -o app .

FROM alpine:latest

WORKDIR /app

COPY --from=build /app/app .

EXPOSE ${env.PORT}

CMD ["./app"]
"""

                        writeFile(
                            file:
                                "${serviceDir}/Dockerfile",
                            text:
                                dockerfile.trim()
                        )

                        echo "Generated Go Dockerfile."

                    } else {

                        error(
                            "Cannot generate Dockerfile for project type: ${env.PROJECT_TYPE}"
                        )
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    def servicePath =
                        params.SERVICE_PATH?.trim() ?: ''

                    def serviceDir =
                        servicePath
                            ? "app/${servicePath}"
                            : "app"

                    dir(serviceDir) {

                        bat """
                        docker build ^
                            -t ${env.DOCKER_IMAGE}:${env.BUILD_NUMBER} ^
                            -t ${env.DOCKER_IMAGE}:latest ^
                            .
                        """
                    }
                }
            }
        }

        stage('Push Docker Image') {
            steps {

                withCredentials([
                    usernamePassword(
                        credentialsId:
                            'dockerhub-credentials',
                        usernameVariable:
                            'DOCKER_USERNAME',
                        passwordVariable:
                            'DOCKER_PASSWORD'
                    )
                ]) {

                    bat '''
                    docker login -u %DOCKER_USERNAME% -p %DOCKER_PASSWORD%

                    docker push %DOCKER_IMAGE%:%BUILD_NUMBER%

                    docker push %DOCKER_IMAGE%:latest
                    '''
                }
            }
        }

        stage('Prepare Kubernetes Manifest') {
            steps {

                powershell '''
                .\\scripts\\prepare-k8s.ps1
                '''
            }
        }

        stage('Deploy to Kubernetes') {
            steps {

                bat '''
                kubectl apply -f k8s\\configmap-rendered.yaml

                kubectl apply -f k8s\\secret-rendered.yaml

                kubectl apply -f k8s\\deployment-rendered.yaml

                kubectl annotate deployment/%APP_ID% kubernetes.io/change-cause="Jenkins Build %BUILD_NUMBER%" --overwrite

                kubectl apply -f k8s\\service-rendered.yaml

                kubectl apply -f k8s\\hpa-rendered.yaml

                kubectl apply -f k8s\\ingress-rendered.yaml
                '''

                script {

                    try {

                        bat '''
                        kubectl rollout status deployment/%APP_ID% --timeout=120s
                        '''

                    } catch (Exception e) {

                        echo "Deployment failed. Rolling back to previous revision..."

                        bat '''
                        kubectl rollout undo deployment/%APP_ID%
                        '''

                        bat '''
                        kubectl rollout status deployment/%APP_ID% --timeout=120s
                        '''

                        throw e
                    }
                }
            }
        }

        stage('Health Check') {
            steps {

                bat '''
                kubectl get pods -l app=%APP_ID%

                kubectl get deployment %APP_ID%

                kubectl get service %APP_ID%-service

                kubectl get hpa %APP_ID%

                kubectl rollout status deployment/%APP_ID% --timeout=120s
                '''
            }
        }

        stage('Deployment Verification') {
            steps {

                bat '''
                kubectl get pods -l app=%APP_ID% -o wide

                kubectl get hpa %APP_ID%
                '''

                script {

                    try {

                        bat '''
                        kubectl top pods -l app=%APP_ID%
                        '''

                    } catch (Exception e) {

                        echo "Metrics are not available yet. Deployment itself is healthy."
                    }
                }
            }
        }

        stage('Deployment Summary') {
            steps {
                script {

                    def image = bat(
                        script:
                            'kubectl get deployment %APP_ID% -o=jsonpath="{.spec.template.spec.containers[0].image}"',
                        returnStdout:
                            true
                    ).trim()

                    def replicas = bat(
                        script:
                            'kubectl get deployment %APP_ID% -o=jsonpath="{.status.readyReplicas}/{.status.replicas}"',
                        returnStdout:
                            true
                    ).trim()

                    def hpa = bat(
                        script:
                            'kubectl get hpa %APP_ID% -o=jsonpath="{.status.currentReplicas}/{.spec.maxReplicas}"',
                        returnStdout:
                            true
                    ).trim()

                    echo """
==============================
 DeployFlow Deployment Summary
==============================
Build:              #${BUILD_NUMBER}
Project Type:       ${env.PROJECT_TYPE}
Framework:          ${env.FRAMEWORK}
Service Path:       ${params.SERVICE_PATH ?: '(repository root)'}
Port:               ${env.PORT}
Health Path:        ${env.HEALTH_PATH}
Static Application: ${env.IS_STATIC}
Docker Image:       ${image}
Ready Pods:         ${replicas}
HPA Replicas:       ${hpa}
Deployment:         SUCCESSFUL
==============================
"""
                }
            }
        }
    }
}