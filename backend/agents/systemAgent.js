const { getSystemInformation } = require("../utils/systemMonitor");

/**
 * System Agent
 * Handles system, network, battery and uptime status responses.
 */

async function getSystemStatusResponse() {
    const system = await getSystemInformation();

    const batteryText =
        system.battery && system.battery.available
            ? String(system.battery.percent) + "%"
            : "unavailable";

    return {
        status: "success",
        intent: "system_status",
        message:
            "System online. CPU usage " +
            system.cpu.usage +
            "%, RAM usage " +
            system.memory.usage +
            "%, battery " +
            batteryText +
            "."
    };
}

async function getNetworkStatusResponse() {
    const system = await getSystemInformation();

    const online =
        system.network &&
        system.network.internet === true;

    const interfaceName =
        system.network &&
        system.network.interfaces &&
        system.network.interfaces.length
            ? system.network.interfaces[0].name
            : "Unknown";

    return {
        status: "success",
        intent: "network_status",
        message: online
            ? "Internet is online. Active interface: " +
              interfaceName +
              "."
            : "Internet connection appears to be offline."
    };
}

async function getBatteryStatusResponse() {
    const system = await getSystemInformation();

    if (!system.battery || !system.battery.available) {
        return {
            status: "success",
            intent: "battery_status",
            message:
                "Battery information is currently unavailable."
        };
    }

    return {
        status: "success",
        intent: "battery_status",
        message: system.battery.charging
            ? "Battery is at " +
              system.battery.percent +
              "% and currently charging."
            : "Battery is at " +
              system.battery.percent +
              "%."
    };
}

async function getUptimeStatusResponse() {
    const data = await getSystemInformation();

    const seconds =
        Math.floor(Number(data.uptime) || 0);

    const days =
        Math.floor(seconds / 86400);

    const hours =
        Math.floor((seconds % 86400) / 3600);

    const minutes =
        Math.floor((seconds % 3600) / 60);

    return {
        status: "success",
        intent: "uptime",
        message:
            "System uptime is " +
            days +
            " days, " +
            hours +
            " hours and " +
            minutes +
            " minutes."
    };
}

module.exports = {
    getSystemStatusResponse,
    getNetworkStatusResponse,
    getBatteryStatusResponse,
    getUptimeStatusResponse
};
