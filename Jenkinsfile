
pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                deleteDir()
                git branch: params.BRANCH,
                    url: params.REPOSITORY
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('Test') {
            steps {
                bat 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                bat 'docker build -t deepak97813/%APP_ID%:%BUILD_NUMBER% -t deepak97813/%APP_ID%:latest .'
            }
        }

        stage('Push Docker Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USERNAME',
                    passwordVariable: 'DOCKER_PASSWORD'
                )]) {
                    bat 'docker login -u %DOCKER_USERNAME% -p %DOCKER_PASSWORD%'
                    bat 'docker push deepak97813/%APP_ID%:%BUILD_NUMBER%'
                    bat 'docker push deepak97813/%APP_ID%:latest'
                }
            }
        }

        stage('Prepare Kubernetes Manifest') {
            steps {
                powershell '.\\scripts\\prepare-k8s.ps1'
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                bat 'kubectl apply -f k8s\\configmap.yaml'
                bat 'kubectl apply -f k8s\\secret.yaml'
                bat 'kubectl apply -f k8s\\deployment-rendered.yaml'
                bat 'kubectl annotate deployment/%APP_ID% kubernetes.io/change-cause="Jenkins Build %BUILD_NUMBER%" --overwrite'
                bat 'kubectl apply -f k8s\\service-rendered.yaml'
                bat 'kubectl apply -f k8s\\hpa-rendered.yaml'

                script {
                    try {
                        bat 'kubectl rollout status deployment/%APP_ID% --timeout=120s'
                    } catch (Exception e) {
                        echo 'Deployment failed. Rolling back to the previous revision...'
                        bat 'kubectl rollout undo deployment/%APP_ID%'
                        bat 'kubectl rollout status deployment/%APP_ID% --timeout=120s'
                        throw e
                    }
                }
            }
        }

        stage('Health Check') {
            steps {
                bat 'kubectl get pods -l app=%APP_ID%'
                bat 'kubectl get deployment %APP_ID%'
                bat 'kubectl get service %APP_ID%-service'
                bat 'kubectl get hpa %APP_ID%'
                bat 'kubectl rollout status deployment/%APP_ID% --timeout=120s'
            }
        }

        stage('Deployment Verification') {
            steps {
                bat 'kubectl get pods -l app=%APP_ID% -o wide'
                bat 'kubectl get hpa %APP_ID%'
                bat 'kubectl top pods -l app=%APP_ID%'
            }
        }

        stage('Deployment Summary') {
            steps {
                script {
                    def image = bat(
                        script: 'kubectl get deployment %APP_ID% -o=jsonpath="{.spec.template.spec.containers[0].image}"',
                        returnStdout: true
                    ).trim()

                    def replicas = bat(
                        script: 'kubectl get deployment %APP_ID% -o=jsonpath="{.status.readyReplicas}/{.status.replicas}"',
                        returnStdout: true
                    ).trim()

                    def hpa = bat(
                        script: 'kubectl get hpa %APP_ID% -o=jsonpath="{.status.currentReplicas}/{.spec.maxReplicas}"',
                        returnStdout: true
                    ).trim()

                    echo """
==============================
 DeployFlow Deployment Summary
==============================
Build:        #${BUILD_NUMBER}
Docker Image: ${image}
Ready Pods:   ${replicas}
HPA Replicas: ${hpa}
Deployment:   SUCCESSFUL
==============================
"""
                }
            }
        }
    }
}
