import { createApp } from "./app";
import { closeDatabase } from "./config/database";
import { env } from "./config/env";

async function bootstrap() {
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`OpsCenter API listening on http://localhost:${env.port}`);
  });

  process.on("SIGINT", async () => {
    server.close();
    await closeDatabase();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start OpsCenter API", error);
  process.exit(1);
});
