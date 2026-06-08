# OpsCenter Demo Client Agent

The demo agent sends a client heartbeat to OpsCenter and then runs client-side connectivity checks once.

```powershell
.\agent.ps1 -Token "opscenter-agent-token" -ApiUrl "http://localhost:5000/api/client-agent/heartbeat" -Department "IT" -Block "Development"
```

Use a dedicated `CLIENT_AGENT_TOKEN` and a scheduled task or Windows service wrapper before production deployment.

The script posts heartbeat data to `/api/client-agent/heartbeat` and verified service results to `/api/client-agent/service-checks`.

`-ApiUrl` accepts either the API base URL (`http://localhost:5000/api`) or the full heartbeat URL (`http://localhost:5000/api/client-agent/heartbeat`).
