import { getSystemSettings } from "./settings.service";
import { recordScheduledInfrastructureHealthCheck } from "./serviceHealth.service";

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopped = false;

async function scheduleNext() {
  if (stopped) return;
  const settings = await getSystemSettings().catch(() => null);
  const seconds = Number(settings?.infrastructure.monitoringIntervalSeconds || 60);
  timer = setTimeout(runOnce, Math.max(10, seconds) * 1000);
  timer.unref?.();
}

async function runOnce() {
  if (running) {
    await scheduleNext();
    return;
  }
  running = true;
  try {
    await recordScheduledInfrastructureHealthCheck();
  } catch (error) {
    console.warn("[infrastructure-monitor] health check failed", error);
  } finally {
    running = false;
    await scheduleNext();
  }
}

export function startInfrastructureMonitor() {
  if (timer || running) return;
  stopped = false;
  timer = setTimeout(runOnce, 5000);
  timer.unref?.();
}

export function stopInfrastructureMonitor() {
  stopped = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
