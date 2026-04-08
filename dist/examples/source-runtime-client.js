"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerRuntimeClient = void 0;
exports.exampleBotBootstrap = exampleBotBootstrap;
class ManagerRuntimeClient {
    managerApiUrl;
    instanceId;
    instanceSecret;
    constructor(managerApiUrl, instanceId, instanceSecret) {
        this.managerApiUrl = managerApiUrl;
        this.instanceId = instanceId;
        this.instanceSecret = instanceSecret;
    }
    async bootstrap() {
        const response = await fetch(`${this.managerApiUrl}/internal/instances/bootstrap`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                instanceId: this.instanceId,
                instanceSecret: this.instanceSecret,
            }),
        });
        if (!response.ok) {
            throw new Error(`Bootstrap falhou com status ${response.status}.`);
        }
        return (await response.json());
    }
    async heartbeat(metrics) {
        const response = await fetch(`${this.managerApiUrl}/internal/instances/heartbeat`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                instanceId: this.instanceId,
                instanceSecret: this.instanceSecret,
                metrics,
            }),
        });
        if (!response.ok) {
            throw new Error(`Heartbeat falhou com status ${response.status}.`);
        }
        return (await response.json());
    }
}
exports.ManagerRuntimeClient = ManagerRuntimeClient;
async function exampleBotBootstrap() {
    const managerApiUrl = process.env.MANAGER_API_URL;
    const instanceId = process.env.INSTANCE_ID;
    const instanceSecret = process.env.INSTANCE_SECRET;
    if (!managerApiUrl || !instanceId || !instanceSecret) {
        throw new Error("MANAGER_API_URL, INSTANCE_ID e INSTANCE_SECRET sao obrigatorios.");
    }
    const client = new ManagerRuntimeClient(managerApiUrl, instanceId, instanceSecret);
    const bootstrap = await client.bootstrap();
    console.log("Instancia liberada:", bootstrap.instance.id);
    console.log("Expira em:", bootstrap.instance.expiresAt);
    console.log("Config carregada:", bootstrap.config);
    const heartbeat = await client.heartbeat({
        guildCount: 1,
        memoryMb: 128,
        cpuPercent: 0.8,
        uptimeSeconds: 30,
    });
    console.log("Estado desejado pelo manager:", heartbeat.desiredState);
}
