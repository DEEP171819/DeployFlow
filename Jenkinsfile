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

                        error(
                            "Service directory does not exist: ${serviceDir}"
                        )
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

                        error(
                            "Service directory does not exist: ${serviceDir}"
                        )
                    }

                    echo "Analyzing repository/service: ${serviceDir}"

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

                        error(
                            "Analyzer did not return valid JSON"
                        )
                    }

                    def json =
                        analyzerOutput.substring(jsonStart)

                    writeFile(
                        file: 'deployflow-repository-analysis.json',
                        text: json
                    )

                    def analysisType = bat(
                        script:
                            '''@echo off
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('deployflow-repository-analysis.json','utf8')); console.log(a.type||'');"''',
                        returnStdout: true
                    ).trim()

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('deployflow-repository-analysis.json','utf8')); console.log((a.services||[]).length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    if (serviceCount == 0) {

                        error(
                            "No deployable services were detected."
                        )
                    }

                    echo """
========================================
 DeployFlow Repository Analysis
========================================
Type:              ${analysisType}
Detected Services: ${serviceCount}
========================================
"""

                    bat '''
@echo off
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('deployflow-repository-analysis.json','utf8')); console.log('Detected Services:'); (a.services||[]).forEach((s,i)=>{console.log('['+(i+1)+'] '+s.name+' | path='+s.path+' | type='+s.type+' | framework='+s.framework+' | port='+s.port+' | static='+s.isStatic);});"
'''

                    if (analysisType == 'single-service') {

                        bat '''
@echo off
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('deployflow-repository-analysis.json','utf8')); const s=a.services[0]; const lines=['PROJECT_TYPE='+String(s.type||''),'FRAMEWORK='+String(s.framework||''),'PACKAGE_MANAGER='+String(s.packageManager||''),'BUILD_COMMAND='+String(s.buildCommand||''),'START_COMMAND='+String(s.startCommand||''),'PORT='+String(s.port||3000),'HEALTH_PATH='+String(s.healthPath||'/'),'IS_STATIC='+(s.isStatic?'true':'false'),'OUTPUT_DIRECTORY='+String(s.outputDirectory||''),'EXISTING_DOCKERFILE='+(s.existingDockerfile?'true':'false'),'SERVICE_NAME='+String(s.name||'app'),'SERVICE_PATH='+String(s.path||'.')]; fs.writeFileSync('deployflow-env.properties',lines.join('\\n'));"
'''

                        def propertiesText =
                            readFile(
                                file: 'deployflow-env.properties'
                            ).trim()

                        writeFile(
                            file: '.deployflow-analysis.json',
                            text: json
                        )

                        writeFile(
                            file: 'deployflow-analysis.env',
                            text: propertiesText + '\n'
                        )

                        echo """
========================================
 DeployFlow Single-Service
========================================
${propertiesText}
========================================
"""

                    } else if (analysisType == 'multi-service') {

                        writeFile(
                            file: '.deployflow-analysis.json',
                            text: json
                        )

                        echo """
========================================
 DeployFlow Multi-Service Repository
========================================
Detected Services: ${serviceCount}

The pipeline will process every detected
service independently.
========================================
"""

                    } else {

                        error(
                            "Unknown repository analysis type: ${analysisType}"
                        )
                    }
                }
            }
        }


        stage('Install Dependencies') {

            steps {

                script {

                    if (!fileExists(
                        'deployflow-repository-analysis.json'
                    )) {

                        error(
                            "Repository analysis file not found."
                        )
                    }

                    def servicesJson = bat(
                        script:
                            '''@echo off
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('deployflow-repository-analysis.json','utf8')); console.log(JSON.stringify(a.services||[]));"''',
                        returnStdout: true
                    ).trim()

                    writeFile(
                        file: 'deployflow-services.json',
                        text: servicesJson
                    )

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    echo """
========================================
 Installing Dependencies
 Services: ${serviceCount}
========================================
"""

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def servicePath = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].path);" """,
                            returnStdout: true
                        ).trim()

                        def projectType = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].type);" """,
                            returnStdout: true
                        ).trim()

                        def serviceDir =
                            "app\\${servicePath.replace('/', '\\')}"

                        echo """
----------------------------------------
Service: ${serviceName}
Path:    ${servicePath}
Type:    ${projectType}
----------------------------------------
"""

                        if (!fileExists(serviceDir)) {

                            error(
                                "Service directory does not exist: ${serviceDir}"
                            )
                        }

                        if (projectType == 'node') {

                            dir(serviceDir) {

                                bat 'npm install'
                            }

                        } else if (projectType == 'python') {

                            dir(serviceDir) {

                                if (fileExists('requirements.txt')) {

                                    bat(
                                        'python -m pip install -r requirements.txt'
                                    )

                                } else {

                                    echo(
                                        "No requirements.txt found for ${serviceName}"
                                    )
                                }
                            }

                        } else if (projectType == 'java') {

                            dir(serviceDir) {

                                if (fileExists('pom.xml')) {

                                    bat(
                                        'mvn install -DskipTests'
                                    )

                                } else {

                                    echo(
                                        "No pom.xml found for ${serviceName}"
                                    )
                                }
                            }

                        } else if (projectType == 'go') {

                            dir(serviceDir) {

                                bat 'go mod download'
                            }

                        } else if (projectType == 'docker') {

                            echo(
                                "Docker project detected. Dependencies are handled by Dockerfile."
                            )

                        } else {

                            error(
                                "Unsupported project type for ${serviceName}: ${projectType}"
                            )
                        }
                    }

                    echo(
                        "All service dependencies processed successfully."
                    )
                }
            }
        }


stage('Build and Test') {

    steps {

        script {

            if (!fileExists(
                'deployflow-services.json'
            )) {

                error(
                    "Service list not found."
                )
            }

            def serviceCountText = bat(
                script:
                    '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                returnStdout: true
            ).trim()

            def serviceCount =
                Integer.parseInt(serviceCountText)

            for (int i = 0; i < serviceCount; i++) {

                def serviceName = bat(
                    script:
                        """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                    returnStdout: true
                ).trim()

                def servicePath = bat(
                    script:
                        """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].path);" """,
                    returnStdout: true
                ).trim()

                def projectType = bat(
                    script:
                        """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].type);" """,
                    returnStdout: true
                ).trim()

                def serviceDir =
                    "app\\${servicePath.replace('/', '\\')}"

                echo """
========================================
 Build / Test
 Service: ${serviceName}
 Type:    ${projectType}
========================================
"""

                if (!fileExists(serviceDir)) {

                    error(
                        "Service directory does not exist: ${serviceDir}"
                    )
                }

                if (projectType == 'node') {

                    dir(serviceDir) {

                        if (fileExists('package.json')) {

                            def hasTestScript = bat(
                                script:
                                    '''@echo off
node -e "const p=require('./package.json'); console.log(p.scripts && p.scripts.test ? 'true' : 'false');"''',
                                returnStdout: true
                            ).trim()

                            if (hasTestScript == 'true') {

                                def testScript = bat(
                                    script:
                                        '''@echo off
node -e "const p=require('./package.json'); console.log(p.scripts.test || '');"''',
                                    returnStdout: true
                                ).trim()

                                if (testScript.contains('react-scripts test')) {

                                    echo(
                                        "React test script detected. Running tests with --passWithNoTests."
                                    )

                                    bat(
                                        'npm test -- --passWithNoTests --watchAll=false'
                                    )

                                } else {

                                    echo(
                                        "Running Node.js test script."
                                    )

                                    bat(
                                        'npm test --if-present'
                                    )
                                }

                            } else {

                                echo(
                                    "No npm test script found. Skipping tests."
                                )
                            }

                            def hasBuildScript = bat(
                                script:
                                    '''@echo off
node -e "const p=require('./package.json'); console.log(p.scripts && p.scripts.build ? 'true' : 'false');"''',
                                returnStdout: true
                            ).trim()

                            if (hasBuildScript == 'true') {

                                echo(
                                    "Build script detected. Running npm build."
                                )

                                bat(
                                    'npm run build'
                                )

                            } else {

                                echo(
                                    "No npm build script found. Skipping build."
                                )
                            }
                        }
                    }

                } else if (projectType == 'python') {

                    dir(serviceDir) {

                        if (
                            fileExists('pytest.ini') ||
                            fileExists('tests')
                        ) {

                            bat(
                                'python -m pytest'
                            )

                        } else {

                            echo(
                                "No pytest configuration found. Skipping tests."
                            )
                        }
                    }

                } else if (projectType == 'java') {

                    dir(serviceDir) {

                        if (fileExists('pom.xml')) {

                            bat(
                                'mvn test'
                            )
                        }
                    }

                } else if (projectType == 'go') {

                    dir(serviceDir) {

                        bat(
                            'go test ./...'
                        )
                    }

                } else if (projectType == 'docker') {

                    echo(
                        "Docker project detected. Dockerfile will perform application build."
                    )

                } else {

                    error(
                        "Unsupported project type: ${projectType}"
                    )
                }
            }

            echo(
                "All service build/test operations completed successfully."
            )
        }
    }
}




        stage('Prepare Dockerfiles') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def servicePath = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].path);" """,
                            returnStdout: true
                        ).trim()

                        def projectType = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].type);" """,
                            returnStdout: true
                        ).trim()

                        def framework = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].framework||'');" """,
                            returnStdout: true
                        ).trim()

                        def port = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].port||3000);" """,
                            returnStdout: true
                        ).trim()

                        def startCommand = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].startCommand||'');" """,
                            returnStdout: true
                        ).trim()

                        def isStatic = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].isStatic?'true':'false');" """,
                            returnStdout: true
                        ).trim()

                        def outputDirectory = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].outputDirectory||'');" """,
                            returnStdout: true
                        ).trim()

                        def existingDockerfile = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].existingDockerfile?'true':'false');" """,
                            returnStdout: true
                        ).trim()

                        def serviceDir =
                            "app\\${servicePath.replace('/', '\\')}"

                        echo """
========================================
 Preparing Dockerfile
 Service:  ${serviceName}
 Type:     ${projectType}
 Framework:${framework}
 Port:     ${port}
 Static:   ${isStatic}
========================================
"""

                        if (existingDockerfile == 'true') {

                            echo(
                                "Existing Dockerfile detected for ${serviceName}. Keeping it."
                            )

                        } else if (projectType == 'node' && isStatic == 'true') {

                            def outputDir =
                                outputDirectory ?: 'build'

                            writeFile(
                                file: "${serviceDir}\\Dockerfile",
                                text: """FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/${outputDir} /usr/share/nginx/html

EXPOSE ${port}

CMD ["nginx", "-g", "daemon off;"]
"""
                            )

                        } else if (projectType == 'node') {

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

                            if (!startCommand) {

                                error(
                                    "Python service ${serviceName} has no detected start command."
                                )
                            }

                            writeFile(
                                file: "${serviceDir}\\Dockerfile",
                                text: """FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE ${port}

CMD ["sh", "-c", "${startCommand}"]
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

                                error(
                                    "Java service ${serviceName} does not contain pom.xml."
                                )
                            }

                        } else if (projectType == 'docker') {

                            echo(
                                "Docker project detected. Existing Dockerfile is expected."
                            )

                        } else {

                            error(
                                "Cannot generate Dockerfile for ${serviceName}."
                            )
                        }
                    }

                    echo(
                        "Dockerfiles prepared for all services."
                    )
                }
            }
        }


        stage('Build Docker Images') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def servicePath = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].path);" """,
                            returnStdout: true
                        ).trim()

                        def safeServiceName =
                            serviceName
                                .toLowerCase()
                                .replaceAll('[^a-z0-9-]+', '-')
                                .replaceAll('^-+', '')
                                .replaceAll('-+$', '')

                        if (!safeServiceName) {
                            safeServiceName =
                                "service-${i + 1}"
                        }

                        def serviceDir =
                            "app\\${servicePath.replace('/', '\\')}"

                        def serviceAppId =
                            "${params.APP_ID}-${safeServiceName}"

                        def dockerImage =
                            "${env.DOCKER_USERNAME}/${serviceAppId}:${env.BUILD_NUMBER}"

                        echo """
========================================
 Building Docker Image
 Service: ${serviceName}
 Image:   ${dockerImage}
========================================
"""

                        dir(serviceDir) {

                            bat(
                                "docker build -t ${dockerImage} ."
                            )
                        }
                    }

                    echo(
                        "Docker images built successfully for all services."
                    )
                }
            }
        }


        stage('Push Docker Images') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    withCredentials([

                        usernamePassword(
                            credentialsId: 'dockerhub-credentials',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASSWORD'
                        )

                    ]) {

                        bat '''
@echo off

echo ==============================
echo Docker Hub Authentication
echo ==============================

powershell -NoProfile -Command "$env:DOCKER_PASSWORD | docker login docker.io -u $env:DOCKER_USER --password-stdin"

if errorlevel 1 (
    echo LOGIN FAILED
    exit /b 1
)

echo LOGIN SUCCESSFUL
'''

                        for (int i = 0; i < serviceCount; i++) {

                            def serviceName = bat(
                                script:
                                    """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                                returnStdout: true
                            ).trim()

                            def safeServiceName =
                                serviceName
                                    .toLowerCase()
                                    .replaceAll('[^a-z0-9-]+', '-')
                                    .replaceAll('^-+', '')
                                    .replaceAll('-+$', '')

                            if (!safeServiceName) {
                                safeServiceName =
                                    "service-${i + 1}"
                            }

                            def serviceAppId =
                                "${params.APP_ID}-${safeServiceName}"

                            def dockerImage =
                                "${env.DOCKER_USERNAME}/${serviceAppId}:${env.BUILD_NUMBER}"

                            echo(
                                "Pushing ${dockerImage}"
                            )

                            bat(
                                "docker push ${dockerImage}"
                            )
                        }
                    }

                    echo(
                        "All Docker images pushed successfully."
                    )
                }
            }
        }


        stage('Prepare Kubernetes Manifests') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    bat(
                        'if exist k8s\\generated rmdir /s /q k8s\\generated'
                    )

                    bat(
                        'mkdir k8s\\generated'
                    )

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def servicePath = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].path);" """,
                            returnStdout: true
                        ).trim()

                        def projectType = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].type);" """,
                            returnStdout: true
                        ).trim()

                        def framework = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].framework||'');" """,
                            returnStdout: true
                        ).trim()

                        def port = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].port||3000);" """,
                            returnStdout: true
                        ).trim()

                        def healthPath = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].healthPath||'/');" """,
                            returnStdout: true
                        ).trim()

                        def isStatic = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].isStatic?'true':'false');" """,
                            returnStdout: true
                        ).trim()

                        def outputDirectory = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].outputDirectory||'');" """,
                            returnStdout: true
                        ).trim()

                        def existingDockerfile = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].existingDockerfile?'true':'false');" """,
                            returnStdout: true
                        ).trim()

                        def safeServiceName =
                            serviceName
                                .toLowerCase()
                                .replaceAll('[^a-z0-9-]+', '-')
                                .replaceAll('^-+', '')
                                .replaceAll('-+$', '')

                        if (!safeServiceName) {
                            safeServiceName =
                                "service-${i + 1}"
                        }

                        def serviceAppId =
                            "${params.APP_ID}-${safeServiceName}"

                        def dockerImage =
                            "${env.DOCKER_USERNAME}/${serviceAppId}:${env.BUILD_NUMBER}"

                        echo """
========================================
 Preparing Kubernetes
 Service:      ${serviceName}
 Application:  ${serviceAppId}
 Image:        ${dockerImage}
 Port:         ${port}
 Health Path:  ${healthPath}
========================================
"""

                        withEnv([

                            "APP_ID=${serviceAppId}",
                            "APP_NAME=${params.APP_NAME}-${serviceName}",
                            "BUILD_NUMBER=${env.BUILD_NUMBER}",
                            "DOCKER_IMAGE=${dockerImage}",

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

                        bat(
                            "copy /Y k8s\\configmap-rendered.yaml k8s\\generated\\${serviceAppId}-configmap.yaml"
                        )

                        bat(
                            "copy /Y k8s\\secret-rendered.yaml k8s\\generated\\${serviceAppId}-secret.yaml"
                        )

                        bat(
                            "copy /Y k8s\\deployment-rendered.yaml k8s\\generated\\${serviceAppId}-deployment.yaml"
                        )

                        bat(
                            "copy /Y k8s\\service-rendered.yaml k8s\\generated\\${serviceAppId}-service.yaml"
                        )

                        bat(
                            "copy /Y k8s\\hpa-rendered.yaml k8s\\generated\\${serviceAppId}-hpa.yaml"
                        )

                        bat(
                            "copy /Y k8s\\ingress-rendered.yaml k8s\\generated\\${serviceAppId}-ingress.yaml"
                        )
                    }

                    echo(
                        "Kubernetes manifests prepared for all services."
                    )
                }
            }
        }


        stage('Deploy to Kubernetes') {

            steps {

                script {

                    echo(
                        "Deploying all generated Kubernetes resources."
                    )

                    bat(
                        "kubectl apply -f k8s\\generated"
                    )

                    echo(
                        "All Kubernetes resources applied successfully."
                    )
                }
            }
        }


        stage('Health Check') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def safeServiceName =
                            serviceName
                                .toLowerCase()
                                .replaceAll('[^a-z0-9-]+', '-')
                                .replaceAll('^-+', '')
                                .replaceAll('-+$', '')

                        if (!safeServiceName) {
                            safeServiceName =
                                "service-${i + 1}"
                        }

                        def serviceAppId =
                            "${params.APP_ID}-${safeServiceName}"

                        echo """
========================================
 Health Check
 Service: ${serviceName}
========================================
"""

                        bat(
                            "kubectl get pods -l app=${serviceAppId}"
                        )

                        bat(
                            "kubectl get service ${serviceAppId}-service"
                        )
                    }

                    echo(
                        "Health checks completed for all services."
                    )
                }
            }
        }


        stage('Deployment Verification') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def safeServiceName =
                            serviceName
                                .toLowerCase()
                                .replaceAll('[^a-z0-9-]+', '-')
                                .replaceAll('^-+', '')
                                .replaceAll('-+$', '')

                        if (!safeServiceName) {
                            safeServiceName =
                                "service-${i + 1}"
                        }

                        def serviceAppId =
                            "${params.APP_ID}-${safeServiceName}"

                        echo """
========================================
 Deployment Verification
 Service: ${serviceName}
 Deployment: ${serviceAppId}
========================================
"""

                        bat(
                            "kubectl rollout status deployment/${serviceAppId} --timeout=120s"
                        )

                        bat(
                            "kubectl get deployment ${serviceAppId}"
                        )

                        bat(
                            "kubectl get pods -l app=${serviceAppId}"
                        )

                        bat(
                            "kubectl get service ${serviceAppId}-service"
                        )

                        bat(
                            "kubectl get ingress ${serviceAppId}-ingress"
                        )
                    }

                    echo(
                        "Deployment verification completed for all services."
                    )
                }
            }
        }


        stage('Deployment Summary') {

            steps {

                script {

                    def serviceCountText = bat(
                        script:
                            '''@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s.length);"''',
                        returnStdout: true
                    ).trim()

                    def serviceCount =
                        Integer.parseInt(serviceCountText)

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

Detected Services:
    ${serviceCount}

==================================================
"""

                    for (int i = 0; i < serviceCount; i++) {

                        def serviceName = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].name);" """,
                            returnStdout: true
                        ).trim()

                        def servicePath = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].path);" """,
                            returnStdout: true
                        ).trim()

                        def projectType = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].type);" """,
                            returnStdout: true
                        ).trim()

                        def framework = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].framework||'');" """,
                            returnStdout: true
                        ).trim()

                        def port = bat(
                            script:
                                """@echo off
node -e "const s=JSON.parse(require('fs').readFileSync('deployflow-services.json','utf8')); console.log(s[${i}].port||3000);" """,
                            returnStdout: true
                        ).trim()

                        def safeServiceName =
                            serviceName
                                .toLowerCase()
                                .replaceAll('[^a-z0-9-]+', '-')
                                .replaceAll('^-+', '')
                                .replaceAll('-+$', '')

                        if (!safeServiceName) {
                            safeServiceName =
                                "service-${i + 1}"
                        }

                        def serviceAppId =
                            "${params.APP_ID}-${safeServiceName}"

                        echo """
--------------------------------------------------
Service:
    ${serviceName}

Path:
    ${servicePath}

Project Type:
    ${projectType}

Framework:
    ${framework}

Port:
    ${port}

Docker Image:
    ${env.DOCKER_USERNAME}/${serviceAppId}:${env.BUILD_NUMBER}

Kubernetes:
    Deployment: ${serviceAppId}

    Service:    ${serviceAppId}-service

    Ingress:    ${serviceAppId}-ingress

Application URL:
    http://${serviceAppId}.localhost
--------------------------------------------------
"""
                    }

                    echo """
==================================================
        DeployFlow Deployment Complete
==================================================
"""
                }
            }
        }
    }

    post {

        success {

            echo(
                "DeployFlow pipeline completed successfully."
            )
        }

        failure {

            echo(
                "DeployFlow pipeline failed."
            )
        }

        always {

            echo(
                "Pipeline finished."
            )
        }
    }
}