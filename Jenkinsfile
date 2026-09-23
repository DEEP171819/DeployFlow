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
                bat 'docker build -t deployflow:%BUILD_NUMBER% .'
            }
        }

        stage('Run Application') {
            steps {
                bat 'docker stop deployflow-app || exit 0'
                bat 'docker rm deployflow-app || exit 0'
                bat 'docker run -d --name deployflow-app -p 3000:3000 deployflow:%BUILD_NUMBER%'
            }
        }

        stage('Health Check') {
            steps {
                bat 'curl http://localhost:3000/api/health'
            }
        }
    }
}