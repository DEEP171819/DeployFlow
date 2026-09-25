$buildNumber = $env:BUILD_NUMBER
$appId = $env:APP_ID
$appName = $env:APP_NAME

$envVarsJson = $env:ENV_VARS
$secretsJson = $env:SECRETS

Write-Host "Preparing Kubernetes manifests..."
Write-Host "APP_ID: $appId"
Write-Host "APP_NAME: $appName"
Write-Host "BUILD_NUMBER: $buildNumber"

# Parse environment variables
try {
    if ([string]::IsNullOrWhiteSpace($envVarsJson)) {
        $environmentVariables = @{}
    }
    else {
        $environmentVariables = $envVarsJson | ConvertFrom-Json
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
        $secrets = $secretsJson | ConvertFrom-Json
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
    "  PORT: `"3000`""
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

    $escapedValue = $value.Replace('\', '\\').Replace('"', '\"')

    $configMapLines += "  ${key}: `"$escapedValue`""
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

    $escapedValue = $value.Replace('\', '\\').Replace('"', '\"')

    $secretLines += "  ${key}: `"$escapedValue`""
}

$secretLines |
    Set-Content "k8s\secret-rendered.yaml"

# Deployment
$deploymentTemplate =
    Get-Content "k8s\deployment.yaml" -Raw

$deploymentRendered =
    $deploymentTemplate `
        -replace "APP_ID", $appId `
        -replace "IMAGE_TAG", $buildNumber

Set-Content `
    "k8s\deployment-rendered.yaml" `
    $deploymentRendered

# Service
$serviceTemplate =
    Get-Content "k8s\service.yaml" -Raw

$serviceRendered =
    $serviceTemplate `
        -replace "APP_ID", $appId

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
        -replace "APP_ID", $appId

Set-Content `
    "k8s\ingress-rendered.yaml" `
    $ingressRendered

Write-Host ""
Write-Host "Generated Kubernetes manifests:"
Get-ChildItem "k8s\*-rendered.yaml" |
    Select-Object Name

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