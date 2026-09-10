const os = require("os");
const { execFile } = require("child_process");


/* =========================================================
   CPU USAGE
========================================================= */

function getCPUUsage() {
    const cpus = os.cpus();

    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
        idle += cpu.times.idle;

        total +=
            cpu.times.user +
            cpu.times.nice +
            cpu.times.sys +
            cpu.times.irq +
            cpu.times.idle;
    }

    return {
        idle,
        total
    };
}


function calculateCPUPercentage(start, end) {
    const idleDiff =
        end.idle - start.idle;

    const totalDiff =
        end.total - start.total;

    if (totalDiff <= 0) {
        return 0;
    }

    const usage =
        100 * (1 - idleDiff / totalDiff);

    return Math.max(
        0,
        Math.min(100, usage)
    );
}


/* =========================================================
   BATTERY
========================================================= */

function getBatteryInformation() {
    return new Promise((resolve) => {

        if (process.platform !== "win32") {
            resolve({
                available: false,
                percent: null,
                charging: false
            });

            return;
        }

        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json -Compress"
            ],
            (error, stdout) => {

                if (
                    error ||
                    !stdout ||
                    !stdout.trim()
                ) {
                    resolve({
                        available: false,
                        percent: null,
                        charging: false
                    });

                    return;
                }

                try {
                    const data =
                        JSON.parse(stdout.trim());

                    const battery =
                        Array.isArray(data)
                            ? data[0]
                            : data;

                    const percent =
                        Number(
                            battery.EstimatedChargeRemaining
                        );

                    const status =
                        Number(
                            battery.BatteryStatus
                        );

                    const charging =
                        status === 2 ||
                        status === 6;

                    resolve({
                        available:
                            Number.isFinite(percent),

                        percent:
                            Number.isFinite(percent)
                                ? percent
                                : null,

                        charging
                    });

                } catch (error) {
                    resolve({
                        available: false,
                        percent: null,
                        charging: false
                    });
                }
            }
        );
    });
}


/* =========================================================
   NETWORK INTERFACES
========================================================= */

function getNetworkInterfaces() {
    const interfaces =
        os.networkInterfaces();

    const networks = [];

    for (const [name, addresses] of Object.entries(interfaces)) {

        for (const address of addresses || []) {

            if (address.internal) {
                continue;
            }

            networks.push({
                name,
                address: address.address,
                family: address.family
            });
        }
    }

    return networks;
}


/* =========================================================
   INTERNET CONNECTIVITY
========================================================= */

function checkInternetConnection() {
    return new Promise((resolve) => {

        execFile(
            "powershell.exe",
            [
                "-NoProfile",
                "-Command",
                "(Test-Connection -ComputerName 1.1.1.1 -Count 1 -Quiet)"
            ],
            {
                timeout: 5000
            },
            (error, stdout) => {

                if (error) {
                    resolve(false);
                    return;
                }

                resolve(
                    stdout.trim().toLowerCase() ===
                    "true"
                );
            }
        );
    });
}


/* =========================================================
   SYSTEM INFORMATION
========================================================= */

async function getSystemInformation() {

    const startCPU =
        getCPUUsage();

    await new Promise(resolve => {
        setTimeout(resolve, 250);
    });

    const endCPU =
        getCPUUsage();

    const cpuUsage =
        calculateCPUPercentage(
            startCPU,
            endCPU
        );


    /* MEMORY */

    const totalMemory =
        os.totalmem();

    const freeMemory =
        os.freemem();

    const usedMemory =
        totalMemory - freeMemory;

    const memoryPercentage =
        totalMemory > 0
            ? (usedMemory / totalMemory) * 100
            : 0;


    /* BATTERY */

    const battery =
        await getBatteryInformation();


    /* NETWORK */

    const networkInterfaces =
        getNetworkInterfaces();

    const internet =
        await checkInternetConnection();


    return {

        platform:
            os.platform(),

        release:
            os.release(),

        architecture:
            os.arch(),

        hostname:
            os.hostname(),


        cpu: {

            model:
                os.cpus()[0]?.model ||
                "Unknown",

            cores:
                os.cpus().length,

            usage:
                Number(
                    cpuUsage.toFixed(1)
                )
        },


        memory: {

            total:
                totalMemory,

            free:
                freeMemory,

            used:
                usedMemory,

            usage:
                Number(
                    memoryPercentage.toFixed(1)
                )
        },


        battery,


        network: {

            internet,

            interfaces:
                networkInterfaces,

            interfaceCount:
                networkInterfaces.length
        },


        uptime:
            os.uptime()
    };
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
    getSystemInformation
};
