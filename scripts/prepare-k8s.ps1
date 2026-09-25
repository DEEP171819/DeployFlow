$buildNumber = $env:BUILD_NUMBER
$appId = $env:APP_ID

$deploymentTemplate = Get-Content "k8s\deployment.yaml" -Raw

$deploymentRendered = $deploymentTemplate `
    -replace "APP_ID", $appId `
    -replace "IMAGE_TAG", $buildNumber

Set-Content "k8s\deployment-rendered.yaml" $deploymentRendered

$serviceTemplate = Get-Content "k8s\service.yaml" -Raw

$serviceRendered = $serviceTemplate `
    -replace "APP_ID", $appId

Set-Content "k8s\service-rendered.yaml" $serviceRendered