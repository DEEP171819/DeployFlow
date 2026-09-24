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

        stage('Run Application') {
            steps {
                bat 'docker stop deployflow-app || exit 0'
                bat 'docker rm deployflow-app || exit 0'
                bat 'docker run -d --name deployflow-app -p 3000:3000 deepak97813/deployflow:%BUILD_NUMBER%'
            }
        }

        stage('Health Check') {
            steps {
                bat 'curl http://localhost:3000/api/health'
            }
        }
    }
}