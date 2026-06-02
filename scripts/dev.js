const net = require("net");
const os = require("os");
const { execFileSync } = require("child_process");
const concurrently = require("concurrently");

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function nextPort(start) {
  let port = start;
  while (!(await isPortFree(port))) {
    port += 1;
  }
  return port;
}

function stopStaleOpsCenterDevProcesses() {
  if (process.platform !== "win32") return;

  const workspace = process.cwd().replace(/'/g, "''");
  const scriptPid = process.pid;
  const command = [
    "$workspace = '" + workspace + "'",
    "$current = " + scriptPid,
    "$matches = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -eq 'node.exe' -or $_.Name -eq 'cmd.exe') -and",
    "  $_.ProcessId -ne $current -and",
    "  (",
    "    ($_.CommandLine -like \"*$workspace*\" -and (",
    "      $_.CommandLine -like '*ts-node-dev*' -or",
    "      $_.CommandLine -like '*next*dev*' -or",
    "      $_.CommandLine -like '*next*start*' -or",
    "      $_.CommandLine -like '*next*server*' -or",
    "      $_.CommandLine -like '*postcss.js*'",
    "    )) -or",
    "    $_.CommandLine -like '*npm run dev --workspace @opscenter*' -or",
    "    $_.CommandLine -like '*scripts/dev.js*'",
    "  )",
    "}",
    "foreach ($process in $matches) {",
    "  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue",
    "}"
  ].join("\n");

  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { stdio: "ignore" });
  } catch {
    console.warn("[dev] Could not clean stale dev processes automatically.");
  }
}

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return "localhost";
}

async function main() {
  stopStaleOpsCenterDevProcesses();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const frontendPort = await nextPort(3000);
  const backendPort = await nextPort(5000);
  const lanIp = getLanIp();
  const frontendUrl = `http://${lanIp}:${frontendPort}`;
  const apiUrl = `http://${lanIp}:${backendPort}`;

  if (frontendPort !== 3000) {
    console.log(`[dev] Port 3000 is busy. Frontend will start on ${frontendUrl}.`);
  }
  if (backendPort !== 5000) {
    console.log(`[dev] Port 5000 is busy. Backend will start on ${apiUrl}, and frontend will point to it.`);
  }

  console.log(`[dev] Frontend local:  http://localhost:${frontendPort}`);
  console.log(`[dev] Frontend network: ${frontendUrl}`);
  console.log(`[dev] Backend local:   http://localhost:${backendPort}/api`);
  console.log(`[dev] Backend network: ${apiUrl}/api`);

  const { result } = concurrently(
    [
      {
        command: "npm run dev --workspace @opscenter/backend",
        name: "backend",
        prefixColor: "green",
        env: { PORT: String(backendPort), HOST: "0.0.0.0", FRONTEND_URL: frontendUrl }
      },
      {
        command: `npm run dev --workspace @opscenter/frontend -- -p ${frontendPort}`,
        name: "frontend",
        prefixColor: "cyan",
        env: { PORT: String(frontendPort), NEXT_PUBLIC_API_URL: apiUrl, NODE_OPTIONS: "--max-old-space-size=4096" }
      }
    ],
    {
      killOthersOn: ["failure"],
      restartTries: 1,
      prefix: "name"
    }
  );

  await result;
}

main().catch((error) => {
  console.error("[dev] Failed to start OpsCenter dev environment", error);
  process.exit(1);
});
