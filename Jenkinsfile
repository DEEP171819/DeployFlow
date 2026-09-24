pipeline {
    agent any

    stages {

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
            bat 'docker build -t deepak97813/deployflow:%BUILD_NUMBER% .'
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
            bat 'docker push deepak97813/deployflow:%BUILD_NUMBER%'
            bat 'docker push deepak97813/deployflow:latest'
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
        bat 'kubectl annotate deployment/deployflow kubernetes.io/change-cause="Jenkins Build %BUILD_NUMBER%" --overwrite'
        bat 'kubectl apply -f k8s\\service.yaml'
        bat 'kubectl rollout status deployment/deployflow'
    }
}

        stage('Health Check') {
            steps {
                bat 'kubectl get pods'
                bat 'kubectl get deployment deployflow'
                bat 'kubectl get service deployflow-service'
            }
        }
    }
}