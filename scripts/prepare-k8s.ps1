$buildNumber = $env:BUILD_NUMBER
$appId = $env:APP_ID
$appName = $env:APP_NAME

$projectType = $env:PROJECT_TYPE
$framework = $env:FRAMEWORK
$port = $env:PORT
$healthPath = $env:HEALTH_PATH
$isStatic = $env:IS_STATIC
$outputDirectory = $env:OUTPUT_DIRECTORY

$envVarsJson = $env:ENV_VARS
$secretsJson = $env:SECRETS

Write-Host "Preparing Kubernetes manifests..."
Write-Host "APP_ID: $appId"
Write-Host "APP_NAME: $appName"
Write-Host "BUILD_NUMBER: $buildNumber"
Write-Host "PROJECT_TYPE: $projectType"
Write-Host "FRAMEWORK: $framework"
Write-Host "PORT: $port"
Write-Host "HEALTH_PATH: $healthPath"
Write-Host "IS_STATIC: $isStatic"

# Validate required deployment values
if ([string]::IsNullOrWhiteSpace($appId)) {
    throw "APP_ID is required."
}

if ([string]::IsNullOrWhiteSpace($appName)) {
    throw "APP_NAME is required."
}

if ([string]::IsNullOrWhiteSpace($buildNumber)) {
    throw "BUILD_NUMBER is required."
}

if ([string]::IsNullOrWhiteSpace($port)) {
    $port = "3000"
}

$portNumber = 0

if (-not [int]::TryParse($port, [ref]$portNumber)) {
    throw "Invalid PORT value: $port"
}

if ($portNumber -lt 1 -or $portNumber -gt 65535) {
    throw "PORT must be between 1 and 65535."
}

if ([string]::IsNullOrWhiteSpace($healthPath)) {
    $healthPath = "/"
}

if (-not $healthPath.StartsWith("/")) {
    $healthPath = "/$healthPath"
}

# Prevent invalid Kubernetes/application paths
if (
    $healthPath.Contains("`n") -or
    $healthPath.Contains("`r")
) {
    throw "Invalid HEALTH_PATH."
}

# Parse environment variables
try {
    if ([string]::IsNullOrWhiteSpace($envVarsJson)) {
        $environmentVariables = @{}
    }
    else {
        $environmentVariables =
            $envVarsJson | ConvertFrom-Json
    }
}
catch {
    throw "Invalid ENV_VARS JSON: $($_.Exception.Message)"
}

# Parse secrets
try {
    if ([string]::IsNullOrWhiteSpace($secretsJson)) {
        $secrets = @{}
    }
    else {
        $secrets =
            $secretsJson | ConvertFrom-Json
    }
}
catch {
    throw "Invalid SECRETS JSON: $($_.Exception.Message)"
}

# Reserved variables managed by DeployFlow
$reservedVariables = @(
    "NODE_ENV",
    "APP_NAME",
    "PORT"
)

# Create ConfigMap
$configMapLines = @(
    "apiVersion: v1"
    "kind: ConfigMap"
    "metadata:"
    "  name: $appId-config"
    "data:"
    "  NODE_ENV: `"production`""
    "  APP_NAME: `"$appName`""
    "  PORT: `"$portNumber`""
)

foreach ($property in $environmentVariables.PSObject.Properties) {

    $key = $property.Name
    $value = [string]$property.Value

    if ($reservedVariables -contains $key) {
        throw "Environment variable '$key' is reserved by DeployFlow."
    }

    if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "Invalid environment variable name: $key"
    }

    $escapedValue =
        $value.Replace('\', '\\').Replace('"', '\"')

    $configMapLines +=
        "  ${key}: `"$escapedValue`""
}

$configMapLines |
    Set-Content "k8s\configmap-rendered.yaml"

# Create Secret
$secretLines = @(
    "apiVersion: v1"
    "kind: Secret"
    "metadata:"
    "  name: $appId-secret"
    "type: Opaque"
    "stringData:"
)

foreach ($property in $secrets.PSObject.Properties) {

    $key = $property.Name
    $value = [string]$property.Value

    if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') {
        throw "Invalid secret name: $key"
    }

    $escapedValue =
        $value.Replace('\', '\\').Replace('"', '\"')

    $secretLines +=
        "  ${key}: `"$escapedValue`""
}

$secretLines |
    Set-Content "k8s\secret-rendered.yaml"

# Deployment
$deploymentTemplate =
    Get-Content "k8s\deployment.yaml" -Raw

$deploymentRendered =
    $deploymentTemplate `
        -replace "APP_ID", $appId `
        -replace "IMAGE_TAG", $buildNumber `
        -replace "APP_PORT", $portNumber `
        -replace "HEALTH_PATH", $healthPath

Set-Content `
    "k8s\deployment-rendered.yaml" `
    $deploymentRendered

# Service
$serviceTemplate =
    Get-Content "k8s\service.yaml" -Raw

$serviceRendered =
    $serviceTemplate `
        -replace "APP_ID", $appId `
        -replace "APP_PORT", $portNumber

Set-Content `
    "k8s\service-rendered.yaml" `
    $serviceRendered

# HPA
$hpaTemplate =
    Get-Content "k8s\hpa.yaml" -Raw

$hpaRendered =
    $hpaTemplate `
        -replace "APP_ID", $appId

Set-Content `
    "k8s\hpa-rendered.yaml" `
    $hpaRendered

# Ingress
$ingressTemplate =
    Get-Content "k8s\ingress.yaml" -Raw

$ingressRendered =
    $ingressTemplate `
        -replace "APP_ID", $appId `
        -replace "APP_PORT", $portNumber

Set-Content `
    "k8s\ingress-rendered.yaml" `
    $ingressRendered

Write-Host ""
Write-Host "Generated Kubernetes manifests:"

Get-ChildItem "k8s\*-rendered.yaml" |
    Select-Object Name

Write-Host ""
Write-Host "Deployment configuration:"
Write-Host " - Project Type: $projectType"
Write-Host " - Framework: $framework"
Write-Host " - Port: $portNumber"
Write-Host " - Health Path: $healthPath"
Write-Host " - Static: $isStatic"
Write-Host " - Output Directory: $outputDirectory"

Write-Host ""
Write-Host "Environment variables configured:"

$environmentVariables.PSObject.Properties |
    ForEach-Object {
        Write-Host " - $($_.Name)"
    }

Write-Host ""
Write-Host "Secrets configured:"

$secrets.PSObject.Properties |
    ForEach-Object {
        Write-Host " - $($_.Name)"
    }