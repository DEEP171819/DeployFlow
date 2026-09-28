const k8s = require("@kubernetes/client-node");

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const autoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

async function getApplicationUrl(applicationId) {

    try {

        const response =
            await networkingApi.listIngressForAllNamespaces();

        const ingresses =
            response.items || [];

        const prefix =
            `${applicationId}-`;

        const applicationIngresses =
            ingresses.filter(ingress => {

                const name =
                    ingress.metadata?.name || "";

                return (
                    name.startsWith(prefix) &&
                    ingress.spec?.rules?.length
                );
            });

        /*
         * Prefer the frontend ingress for
         * multi-service applications.
         */
        const frontendIngress =
            applicationIngresses.find(ingress => {

                const name =
                    ingress.metadata?.name || "";

                return (
                    name ===
                    `${applicationId}-frontend-ingress`
                );
            });

        const selectedIngress =
            frontendIngress ||
            (
                applicationIngresses.length === 1
                    ? applicationIngresses[0]
                    : null
            );

        if (selectedIngress) {

            const host =
                selectedIngress
                    .spec
                    .rules?.[0]
                    ?.host;

            if (host) {

                return `http://${host}`;
            }
        }

    } catch (error) {

        console.error(
            "Unable to discover application Ingress:",
            error.message
        );
    }

    return `http://${applicationId}.localhost`;
}

module.exports = {
    appsApi,
    coreApi,
    autoscalingApi,
    networkingApi,
    getApplicationUrl
};