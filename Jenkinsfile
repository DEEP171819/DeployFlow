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
                }
            }
        }

    stage('Deploy to Kubernetes') {
    steps {
        bat 'kubectl set image deployment/deployflow deployflow=deepak97813/deployflow:%BUILD_NUMBER%'
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