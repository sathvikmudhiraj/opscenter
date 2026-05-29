const net = require("net");
const { execFileSync } = require("child_process");
const concurrently = require("concurrently");

const frontendPort = 3000;
const backendPort = 5000;

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

function stopWorkspaceProcesses() {
  if (process.platform !== "win32") return;

  const workspace = process.cwd().replace(/'/g, "''");
  const current = process.pid;
  const command = [
    "$workspace = '" + workspace + "'",
    "$current = " + current,
    "$matches = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -eq 'node.exe' -or $_.Name -eq 'cmd.exe') -and",
    "  $_.ProcessId -ne $current -and",
    "  $_.CommandLine -like \"*$workspace*\" -and",
    "  (",
    "    $_.CommandLine -like '*next*start*' -or",
    "    $_.CommandLine -like '*next*dev*' -or",
    "    $_.CommandLine -like '*ts-node-dev*' -or",
    "    $_.CommandLine -like '*dist/server.js*' -or",
    "    $_.CommandLine -like '*npm*run*start*frontend*' -or",
    "    $_.CommandLine -like '*npm*run*start*backend*' -or",
    "    $_.CommandLine -like '*npm*run*dev*backend*'",
    "  )",
    "}",
    "foreach ($process in $matches) {",
    "  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue",
    "}"
  ].join("\n");

  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { stdio: "ignore" });
  } catch {
    console.warn("[start] Could not clean old OpsCenter processes automatically.");
  }
}

async function main() {
  stopWorkspaceProcesses();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const frontendFree = await isPortFree(frontendPort);
  const backendFree = await isPortFree(backendPort);
  if (!frontendFree || !backendFree) {
    console.error(`[start] Port check failed. Frontend ${frontendPort}: ${frontendFree ? "free" : "busy"}, backend ${backendPort}: ${backendFree ? "free" : "busy"}.`);
    process.exit(1);
  }

  console.log(`[start] Frontend: http://localhost:${frontendPort}`);
  console.log(`[start] Backend:  http://localhost:${backendPort}/api`);

  const { result } = concurrently(
    [
      {
        command: "npm run start --workspace @opscenter/backend",
        name: "backend",
        prefixColor: "green",
        env: { PORT: String(backendPort), FRONTEND_URL: `http://localhost:${frontendPort}` }
      },
      {
        command: "npm run start --workspace @opscenter/frontend",
        name: "frontend",
        prefixColor: "cyan",
        env: { PORT: String(frontendPort), NEXT_PUBLIC_API_URL: `http://localhost:${backendPort}` }
      }
    ],
    {
      killOthersOn: ["failure"],
      prefix: "name"
    }
  );

  await result;
}

main().catch((error) => {
  console.error("[start] Failed to start OpsCenter", error);
  process.exit(1);
});
