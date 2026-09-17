const { exec, spawn } = require("child_process");

function openApp(app) {
    const commands = {
        "calc.exe": ["calc.exe", []],
        "notepad.exe": ["notepad.exe", []],
        "chrome.exe": ["cmd.exe", ["/c", "start", "", "chrome"]],
        "code": ["cmd.exe", ["/c", "start", "", "code"]]
    };

    const target = commands[app];
    if (!target) {
        return Promise.resolve({
            success: false,
            message: "Blocked: untrusted desktop application."
        });
    }

    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        try {
            const child = spawn(target[0], target[1], {
                shell: false,
                detached: target[0] !== "powershell.exe",
                stdio: "ignore",
                windowsHide: target[0] !== "powershell.exe"
            });

            child.once("error", (error) => {
                console.error(`[ULTRON] ${app} launch error:`, error);
                finish({ success: false, message: `${app} could not be launched.` });
            });

            child.once("spawn", () => {
                child.unref();
                finish({ success: true, message: `${app} launched successfully` });
            });

            setTimeout(() => {
                finish({ success: false, message: `${app} launch timed out.` });
            }, 5000).unref();
        } catch (error) {
            console.error(`[ULTRON] ${app} launch error:`, error);
            finish({ success: false, message: `${app} could not be launched.` });
        }
    });
}

async function typeText(text) {
    return new Promise((resolve) => {
        const safeText = String(text || "");

        if (!safeText.trim()) {
            resolve({
                success: false,
                message: "Type karne ke liye text nahi mila."
            });
            return;
        }

        const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class NativeInput
{
    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;
    private const int SW_RESTORE = 9;

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit, Size = 32)]
    private struct INPUTUNION
    {
        [FieldOffset(0)]
        public KEYBDINPUT ki;
    }

    // Win64 INPUT layout:
    // DWORD type at offset 0
    // 4-byte alignment padding
    // 32-byte union at offset 8
    // Total size = 40 bytes
    [StructLayout(LayoutKind.Explicit, Size = 40)]
    private struct INPUT
    {
        [FieldOffset(0)]
        public uint type;

        [FieldOffset(8)]
        public INPUTUNION U;
    }

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint SendInput(
        uint nInputs,
        [In] INPUT[] pInputs,
        int cbSize
    );

    public static string TypeUnicode(IntPtr hWnd, string text)
    {
        if (hWnd == IntPtr.Zero)
            return "NO_HWND";

        ShowWindow(hWnd, SW_RESTORE);

        // Windows can reject SetForegroundWindow when another process owns
        // the foreground lock. Try the native call first, then fall back to
        // WScript.Shell AppActivate from PowerShell before giving up.
        bool foregroundRequested = SetForegroundWindow(hWnd);

        System.Threading.Thread.Sleep(250);

        // The caller already activates the Notepad process before this
        // native call. Avoid referencing PowerShell variables from C#.
        if (GetForegroundWindow() != hWnd)
        {
            System.Threading.Thread.Sleep(500);
        }

        if (GetForegroundWindow() != hWnd)
            return foregroundRequested ? "WRONG_FOREGROUND" : "FOREGROUND_FAILED";

        var inputs = new INPUT[text.Length * 2];

        int index = 0;

        foreach (char c in text)
        {
            inputs[index] = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new INPUTUNION
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = c,
                        dwFlags = KEYEVENTF_UNICODE,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };

            index++;

            inputs[index] = new INPUT
            {
                type = INPUT_KEYBOARD,
                U = new INPUTUNION
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = c,
                        dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time = 0,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };

            index++;
        }

        int inputSize = Marshal.SizeOf(typeof(INPUT));

        uint sent = SendInput(
            (uint)inputs.Length,
            inputs,
            inputSize
        );

        if (sent != inputs.Length)
        {
            int errorCode = Marshal.GetLastWin32Error();

            return "SENDINPUT_FAILED:" +
                   sent + "/" +
                   inputs.Length +
                   ":SIZE=" +
                   inputSize +
                   ":ERROR=" +
                   errorCode;
        }

        return "TYPE_SUCCESS:SIZE=" + inputSize + ":SENT=" + sent;
    }
}
"@

# Always launch a fresh Notepad instance so the HWND belongs
# to the exact process we are going to activate and type into.
$p = Start-Process notepad.exe -PassThru

$timeout = 0

while ($timeout -lt 80) {
    Start-Sleep -Milliseconds 100

    try {
        $p.Refresh()
    } catch {}

    if ($p.MainWindowHandle -ne 0) {
        break
    }

    $timeout++
}

if (-not $p -or $p.MainWindowHandle -eq 0) {
    Write-Output "NO_NOTEPAD_WINDOW"
    exit
}

try {
    $shell = New-Object -ComObject WScript.Shell
    $shell.AppActivate($p.Id) | Out-Null
    Start-Sleep -Milliseconds 250
} catch {}

$result = [NativeInput]::TypeUnicode(
    $p.MainWindowHandle,
    '${safeText.replace(/'/g, "''")}'
)

Write-Output $result
`;

        const tempFile = require("path").join(
    require("os").tmpdir(),
    `ultron-type-${Date.now()}.ps1`
);

require("fs").writeFileSync(
    tempFile,
    "\uFEFF" + psCommand,
    "utf8"
);

exec(
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
            { timeout: 10000, windowsHide: true },
            (error, stdout, stderr) => {
                const output = String(stdout || "").trim();

                if (error) {
                    resolve({
                        success: false,
                        message: `Desktop typing failed: ${stderr || error.message}`
                    });
                    return;
                }

                if (output === "TYPE_SUCCESS") {
                    resolve({
                        success: true,
                        message: `Text type kar diya: ${safeText}`
                    });
                    return;
                }

                resolve({
                    success: false,
                    message: `Notepad typing failed: ${output || "Unknown error"}`
                });
            }
        );
    });
}

async function pressKey(key) {
    const keyMap = {
        "enter": 0x0D,
        "tab": 0x09,
        "escape": 0x1B,
        "esc": 0x1B,
        "backspace": 0x08,
        "space": 0x20,
        "delete": 0x2E,
        "up": 0x26,
        "down": 0x28,
        "left": 0x25,
        "right": 0x27
    };

    const shortcutMap = {
        "ctrl+a": [0x11, 0x41],
        "ctrl+c": [0x11, 0x43],
        "ctrl+v": [0x11, 0x56],
        "ctrl+x": [0x11, 0x58],
        "ctrl+s": [0x11, 0x53],
        "ctrl+z": [0x11, 0x5A],
        "ctrl+y": [0x11, 0x59],
        "alt+tab": [0x12, 0x09],
        "shift+tab": [0x10, 0x09]
    };

    const keyName = String(key || "").toLowerCase().trim();

    const sequence = shortcutMap[keyName]
        ? shortcutMap[keyName]
        : keyMap[keyName]
            ? [keyMap[keyName]]
            : null;

    if (!sequence) {
        return {
            success: false,
            message: `Unknown key or shortcut: ${key}`
        };
    }

    const psCommand = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class UltronKeyboard
{
    [DllImport("user32.dll")]
    public static extern void keybd_event(
        byte bVk,
        byte bScan,
        uint dwFlags,
        UIntPtr dwExtraInfo
    );

    public const uint KEYEVENTF_KEYUP = 0x0002;
}
"@

$keys = @(__KEYS__)

foreach ($k in $keys) {
    [UltronKeyboard]::keybd_event(
        [byte]$k,
        0,
        0,
        [UIntPtr]::Zero
    )
}

Start-Sleep -Milliseconds 50

for ($i = $keys.Length - 1; $i -ge 0; $i--) {
    [UltronKeyboard]::keybd_event(
        [byte]$keys[$i],
        0,
        [UltronKeyboard]::KEYEVENTF_KEYUP,
        [UIntPtr]::Zero
    )
}

"KEY_SUCCESS"
`;

    const tempFile = require("path").join(
        require("os").tmpdir(),
        `ultron-key-${Date.now()}.ps1`
    );

    require("fs").writeFileSync(
        tempFile,
        "\uFEFF" + psCommand.replace(
            "__KEYS__",
            sequence.join(",")
        ),
        "utf8"
    );

    return new Promise((resolve) => {
        exec(
            `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`,
            (error, stdout, stderr) => {

                try {
                    require("fs").unlinkSync(tempFile);
                } catch {}

                const output = String(stdout || "").trim();

                if (error || output !== "KEY_SUCCESS") {
                    resolve({
                        success: false,
                        message: `Keyboard action failed: ${output || stderr || error?.message || "Unknown error"}`
                    });
                    return;
                }

                resolve({
                    success: true,
                    message: `Keyboard action "${key}" completed successfully`
                });
            }
        );
    });
}
async function executeDesktopAction(action, value = "") {
    switch (action) {
        case "calculator":
            return openApp("calc.exe");

        case "notepad":
            return openApp("notepad.exe");

        case "chrome":
            return openApp("chrome.exe");

        case "vscode":
            return openApp("code");

        case "type":
            return typeText(value);

        case "press_key":
            return pressKey(value);

        case "explorer":
            return new Promise((resolve, reject) => {
                const process = spawn("explorer.exe", ["C:\\"]);

                process.on("error", reject);

                process.on("spawn", () => {
                    resolve({
                        success: true,
                        message: "File Explorer opened successfully"
                    });
                });
            });

        default:
            return {
                success: false,
                message: `Unknown desktop action: ${action}`
            };
    }
}


/**
 * Executes a desktop app and verifies that its process becomes active.
 * This is intentionally limited to trusted, predefined shell commands.
 */
async function executeAndVerifyApp(
    shellCommand,
    intent,
    processName,
    appTitle,
    successMessage,
    failureMessage
) {
    const launchMap = {
        "start calc.exe": ["calc.exe", []],
        "start notepad.exe": ["powershell.exe", ["-NoProfile", "-Command", "Start-Process -FilePath notepad.exe"]],
        "start chrome": ["cmd.exe", ["/c", "start", "", "chrome"]],
        "start code": ["cmd.exe", ["/c", "start", "", "code"]],
        'start "" "https://www.youtube.com"': ["cmd.exe", ["/c", "start", "", "https://www.youtube.com"]]
    };

    const target = launchMap[String(shellCommand || "").trim().toLowerCase()];

    if (!target) {
        return {
            status: "error",
            intent,
            success: false,
            verification: "blocked",
            message: failureMessage
        };
    }

    return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        try {
            const child = spawn(target[0], target[1], {
                shell: false,
                detached: target[0] !== "powershell.exe",
                stdio: "ignore",
                windowsHide: target[0] !== "powershell.exe"
            });

            child.once("error", (error) => {
                console.error(`[ULTRON] ${appTitle} launch error:`, error);
                finish({
                    status: "error",
                    intent,
                    success: false,
                    verification: "error",
                    message: failureMessage
                });
            });

            child.once("spawn", async () => {
                if (target[0] === "powershell.exe") {
                    await new Promise((r) => setTimeout(r, 1500));

                    const verification = await verifyProcessRunning(processName);

                    if (!verification.verified) {
                        finish({
                            status: "error",
                            intent,
                            success: false,
                            verification: "not_running",
                            message: failureMessage
                        });
                        return;
                    }
                }

                child.unref?.();

                finish({
                    status: "success",
                    intent,
                    success: true,
                    verification: target[0] === "powershell.exe"
                        ? "verified"
                        : "dispatched",
                    message: successMessage
                });
            });

            setTimeout(() => {
                finish({
                    status: "error",
                    intent,
                    success: false,
                    verification: "timeout",
                    message: `${appTitle} launch timed out.`
                });
            }, 5000).unref();
        } catch (error) {
            console.error(`[ULTRON] ${appTitle} launch error:`, error);
            finish({
                status: "error",
                intent,
                success: false,
                verification: "error",
                message: failureMessage
            });
        }
    });
}
/**
 * Verifies whether a Windows process is currently running.
 * This function ONLY checks process state; it does not launch anything.
 */
async function verifyProcessRunning(processName) {
    return new Promise((resolve) => {
        const safePattern = /^[a-zA-Z0-9._-]+$/;

        if (
            typeof processName !== "string" ||
            !processName ||
            !safePattern.test(processName)
        ) {
            return resolve({
                verified: false,
                processName,
                details: "Invalid or unsafe process name provided."
            });
        }

        const child = spawn(
            "tasklist.exe",
            ["/FI", `IMAGENAME eq ${processName}`, "/NH"],
            {
                shell: false,
                windowsHide: true
            }
        );

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (data) => {
            stdout += data.toString();
        });

        child.stderr?.on("data", (data) => {
            stderr += data.toString();
        });

        child.once("error", (error) => {
            resolve({
                verified: false,
                processName,
                details: `Execution Error: ${error.message}`
            });
        });

        child.once("close", (code) => {
            if (stderr) {
                resolve({
                    verified: false,
                    processName,
                    details: `System Error: ${stderr}`
                });
                return;
            }

            const isRunning = stdout
                .toLowerCase()
                .includes(processName.toLowerCase());

            resolve({
                verified: isRunning,
                processName,
                details: isRunning
                    ? "Process is active."
                    : "Process not found in task list."
            });
        });
    });
}
module.exports = {
    executeDesktopAction,
    verifyProcessRunning,
    executeAndVerifyApp
};

























