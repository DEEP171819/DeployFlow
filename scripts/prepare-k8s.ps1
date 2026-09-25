$buildNumber = $env:BUILD_NUMBER
$appId = $env:APP_ID

$template = Get-Content "k8s\deployment.yaml" -Raw

$rendered = $template `
    -replace "APP_ID", $appId `
    -replace "IMAGE_TAG", $buildNumber

Set-Content "k8s\deployment-rendered.yaml" $rendered