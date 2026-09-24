$buildNumber = $env:BUILD_NUMBER

$template = Get-Content "k8s\deployment.yaml" -Raw

$rendered = $template -replace "IMAGE_TAG", $buildNumber

Set-Content "k8s\deployment-rendered.yaml" $rendered