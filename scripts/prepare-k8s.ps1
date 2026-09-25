$buildNumber = $env:BUILD_NUMBER
$appId = $env:APP_ID
$appName = $env:APP_NAME

Write-Host "Preparing Kubernetes manifests..."
Write-Host "APP_ID: $appId"
Write-Host "APP_NAME: $appName"
Write-Host "BUILD_NUMBER: $buildNumber"

$deploymentTemplate = Get-Content "k8s\deployment.yaml" -Raw

$deploymentRendered = $deploymentTemplate `
    -replace "APP_ID", $appId `
    -replace "IMAGE_TAG", $buildNumber

Set-Content "k8s\deployment-rendered.yaml" $deploymentRendered


$serviceTemplate = Get-Content "k8s\service.yaml" -Raw

$serviceRendered = $serviceTemplate `
    -replace "APP_ID", $appId

Set-Content "k8s\service-rendered.yaml" $serviceRendered


$hpaTemplate = Get-Content "k8s\hpa.yaml" -Raw

$hpaRendered = $hpaTemplate `
    -replace "APP_ID", $appId

Set-Content "k8s\hpa-rendered.yaml" $hpaRendered


$configMapTemplate = Get-Content "k8s\configmap.yaml" -Raw

$configMapRendered = $configMapTemplate `
    -replace "APP_ID", $appId `
    -replace "APP_NAME", $appName

Set-Content "k8s\configmap-rendered.yaml" $configMapRendered


$secretTemplate = Get-Content "k8s\secret.yaml" -Raw

$secretRendered = $secretTemplate `
    -replace "APP_ID", $appId

Set-Content "k8s\secret-rendered.yaml" $secretRendered


Write-Host ""
Write-Host "Generated Kubernetes manifests:"
Get-ChildItem "k8s\*-rendered.yaml" | Select-Object Name