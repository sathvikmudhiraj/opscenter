import { createApp } from "./app";
import { closeDatabase } from "./config/database";
import { env } from "./config/env";
import { startInfrastructureMonitor, stopInfrastructureMonitor } from "./services/infrastructureMonitor.service";

async function bootstrap() {
  if (env.nodeEnv === "development") {
    console.log(`Client agent token loaded: ${env.clientAgentToken ? "yes" : "no"}`);
  }
  const app = createApp();
  const server = app.listen(env.port, env.host, () => {
    console.log(`OpsCenter API listening on http://${env.host}:${env.port}`);
  });
  startInfrastructureMonitor();

  process.on("SIGINT", async () => {
    stopInfrastructureMonitor();
    server.close();
    await closeDatabase();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start OpsCenter API", error);
  process.exit(1);
});
