"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppPoolService = void 0;
const utils_js_1 = require("../../core/utils.js");
class AppPoolService {
    store;
    constructor(store) {
        this.store = store;
    }
    allocate(productId) {
        const app = this.store.discordApps.find((entry) => entry.productId === productId &&
            entry.source === "app_pool" &&
            entry.poolStatus === "available" &&
            !(0, utils_js_1.isPlaceholderBotToken)(entry.botToken));
        if (!app) {
            throw new Error("Nao ha bots reais livres no pool para este produto.");
        }
        app.poolStatus = "allocated";
        return app;
    }
    release(discordAppId) {
        const app = this.store.discordApps.find((entry) => entry.id === discordAppId);
        if (!app) {
            return;
        }
        if (app.source !== "app_pool") {
            return;
        }
        app.poolStatus = "available";
    }
    listPool() {
        return this.store.discordApps;
    }
}
exports.AppPoolService = AppPoolService;
