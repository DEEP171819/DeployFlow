const k8s = require("@kubernetes/client-node");

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const autoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);

module.exports = {
    appsApi,
    coreApi,
    autoscalingApi
};