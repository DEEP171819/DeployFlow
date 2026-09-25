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

    stages {

        /* =========================
           CHECKOUT USER REPOSITORY
        ========================= */

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

        /* =========================
           VALIDATE SERVICE PATH
        ========================= */

        stage('Validate Service Path') {
            steps {
                script {

                    def servicePath =
                        params.SERVICE_PATH?.trim()

                    def serviceDir =
                        servicePath
                            ? "app/${servicePath}"
                            : "app"

                    echo "Service Path: ${servicePath ?: '(repository root)'}"
                    echo "Service Directory: ${serviceDir}"

                    if (!fileExists(serviceDir)) {
                        error(
                            "Service path does not exist: ${servicePath}"
                        )
                    }

                    env.SERVICE_DIR =
                        serviceDir
                }
            }
        }

        /* =========================
           DETECT PROJECT TYPE
        ========================= */

        stage('Detect Project Type') {
            steps {
                script {

                    def serviceDir =
                        env.SERVICE_DIR

                    if (
                        fileExists(
                            "${serviceDir}/Dockerfile"
                        )
                    ) {

                        env.PROJECT_TYPE =
                            "DOCKER"

                    } else if (
                        fileExists(
                            "${serviceDir}/package.json"
                        )
                    ) {

                        env.PROJECT_TYPE =
                            "NODE"

                    } else if (
                        fileExists(
                            "${serviceDir}/requirements.txt"
                        )
                    ) {

                        env.PROJECT_TYPE =
                            "PYTHON"

                    } else if (
                        fileExists(
                            "${serviceDir}/pom.xml"
                        )
                    ) {

                        env.PROJECT_TYPE =
                            "JAVA_MAVEN"

                    } else {

                        error(
                            "Unable to detect project type. No Dockerfile, package.json, requirements.txt or pom.xml found."
                        )
                    }

                    echo "Detected Project Type: ${env.PROJECT_TYPE}"
                }
            }
        }

        /* =========================
           INSTALL DEPENDENCIES
        ========================= */

        stage('Install Dependencies') {
            steps {
                script {

                    def serviceDir =
                        env.SERVICE_DIR

                    if (
                        env.PROJECT_TYPE ==
                        "NODE"
                    ) {

                        dir(serviceDir) {

                            bat '''
                            npm install
                            '''
                        }

                    } else if (
                        env.PROJECT_TYPE ==
                        "PYTHON"
                    ) {

                        dir(serviceDir) {

                            bat '''
                            python -m pip install -r requirements.txt
                            '''
                        }

                    } else if (
                        env.PROJECT_TYPE ==
                        "JAVA_MAVEN"
                    ) {

                        dir(serviceDir) {

                            bat '''
                            mvn clean install -DskipTests
                            '''
                        }

                    } else {

                        echo "Dependency installation handled by Dockerfile."
                    }
                }
            }
        }

        /* =========================
           TEST
        ========================= */

        stage('Test') {
            steps {
                script {

                    def serviceDir =
                        env.SERVICE_DIR

                    if (
                        env.PROJECT_TYPE ==
                        "NODE"
                    ) {

                        dir(serviceDir) {

                            bat '''
                            if exist package.json (
                                npm test --if-present
                            )
                            '''
                        }

                    } else if (
                        env.PROJECT_TYPE ==
                        "PYTHON"
                    ) {

                        dir(serviceDir) {

                            bat '''
                            if exist tests (
                                python -m pytest
                            ) else (
                                echo No Python tests directory found. Skipping tests.
                            )
                            '''
                        }

                    } else if (
                        env.PROJECT_TYPE ==
                        "JAVA_MAVEN"
                    ) {

                        dir(serviceDir) {

                            bat '''
                            mvn test
                            '''
                        }

                    } else {

                        echo "Test execution handled by Dockerfile or project."
                    }
                }
            }
        }

        /* =========================
           GENERATE DOCKERFILE
        ========================= */

        stage('Prepare Dockerfile') {
            steps {
                script {

                    def serviceDir =
                        env.SERVICE_DIR

                    if (
                        env.PROJECT_TYPE ==
                        "DOCKER"
                    ) {

                        echo "Dockerfile already exists. Using project Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        "NODE"
                    ) {

                        def dockerfile = '''
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
'''

                        writeFile(
                            file: "${serviceDir}/Dockerfile",
                            text: dockerfile.trim()
                        )

                        echo "Generated Node.js Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        "PYTHON"
                    ) {

                        def dockerfile = '''
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
'''

                        writeFile(
                            file: "${serviceDir}/Dockerfile",
                            text: dockerfile.trim()
                        )

                        echo "Generated Python Dockerfile."

                    } else if (
                        env.PROJECT_TYPE ==
                        "JAVA_MAVEN"
                    ) {

                        def dockerfile = '''
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

COPY pom.xml .

RUN mvn dependency:go-offline

COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
'''

                        writeFile(
                            file: "${serviceDir}/Dockerfile",
                            text: dockerfile.trim()
                        )

                        echo "Generated Java Maven Dockerfile."
                    }
                }
            }
        }

        /* =========================
           BUILD DOCKER IMAGE
        ========================= */

        stage('Build Docker Image') {
            steps {
                script {

                    def serviceDir =
                        env.SERVICE_DIR

                    dir(serviceDir) {

                        bat """
                        docker build -t deepak97813/%APP_ID%:%BUILD_NUMBER% -t deepak97813/%APP_ID%:latest .
                        """
                    }
                }
            }
        }

        /* =========================
           PUSH DOCKER IMAGE
        ========================= */

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

                    docker push deepak97813/%APP_ID%:%BUILD_NUMBER%

                    docker push deepak97813/%APP_ID%:latest
                    '''
                }
            }
        }

        /* =========================
           PREPARE KUBERNETES
        ========================= */

        stage('Prepare Kubernetes Manifest') {
            steps {

                powershell '''
                .\\scripts\\prepare-k8s.ps1
                '''
            }
        }

        /* =========================
           DEPLOY KUBERNETES
        ========================= */

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

                        echo "Deployment failed. Rolling back to the previous revision..."

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

        /* =========================
           HEALTH CHECK
        ========================= */

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

        /* =========================
           DEPLOYMENT VERIFICATION
        ========================= */

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

        /* =========================
           DEPLOYMENT SUMMARY
        ========================= */

        stage('Deployment Summary') {
            steps {

                script {

                    def image =
                        bat(
                            script:
                                'kubectl get deployment %APP_ID% -o=jsonpath="{.spec.template.spec.containers[0].image}"',

                            returnStdout:
                                true
                        ).trim()

                    def replicas =
                        bat(
                            script:
                                'kubectl get deployment %APP_ID% -o=jsonpath="{.status.readyReplicas}/{.status.replicas}"',

                            returnStdout:
                                true
                        ).trim()

                    def hpa =
                        bat(
                            script:
                                'kubectl get hpa %APP_ID% -o=jsonpath="{.status.currentReplicas}/{.spec.maxReplicas}"',

                            returnStdout:
                                true
                        ).trim()

                    echo """
==============================
 DeployFlow Deployment Summary
==============================
Build:          #${BUILD_NUMBER}
Project Type:   ${env.PROJECT_TYPE}
Service Path:   ${params.SERVICE_PATH ?: '(repository root)'}
Docker Image:   ${image}
Ready Pods:     ${replicas}
HPA Replicas:   ${hpa}
Deployment:     SUCCESSFUL
==============================
"""
                }
            }
        }
    }
}