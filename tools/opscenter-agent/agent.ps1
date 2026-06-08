# Example usage:
# .\agent.ps1 -ApiUrl "http://localhost:5000/api/client-agent/heartbeat" -Token "opscenter-agent-token"

param(
  [string]$Token,
  [string]$ApiUrl,
  [string]$ClientId = $env:COMPUTERNAME,
  [string]$Department = "",
  [string]$Block = "",
  [string]$AgentVersion = "1.0.0",
  [switch]$Loop,
  [int]$IntervalSeconds = 60
)

# Resolve Token
if (-not $Token) {
    $Token = $env:CLIENT_AGENT_TOKEN
}
if (-not $Token) {
    if ($env:NODE_ENV -ne "production") {
        $Token = "opscenter-agent-token"
    } else {
        Write-Error "Missing agent token. Run with -Token or set CLIENT_AGENT_TOKEN."
        exit 1
    }
}

# Resolve ApiUrl (heartbeat URL)
if (-not $ApiUrl) {
    $ApiUrl = $env:CLIENT_AGENT_API_URL
}
if (-not $ApiUrl) {
    $ApiUrl = "http://localhost:5000/api/client-agent/heartbeat"
}

$normalizedApiUrl = $ApiUrl.TrimEnd('/')
if ($normalizedApiUrl.EndsWith("/client-agent/heartbeat")) {
  $apiBaseUrl = $normalizedApiUrl -replace '/client-agent/heartbeat$', ''
  $heartbeatUrl = $normalizedApiUrl
} else {
  $apiBaseUrl = $normalizedApiUrl
  $heartbeatUrl = "$apiBaseUrl/client-agent/heartbeat"
}
$servicesUrl = "$($apiBaseUrl.TrimEnd('/'))/client-agent/services"
$serviceChecksUrl = "$($apiBaseUrl.TrimEnd('/'))/client-agent/service-checks"

$ErrorActionPreference = "Stop"

$headers = @{ Authorization = "Bearer $Token" }
$hostnameValue = $env:COMPUTERNAME
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1 -ExpandProperty IPAddress)

function Get-ResourceSnapshot {
  $cpu = $null
  $memory = $null
  $disk = $null
  $lastBoot = $null

  try {
    $cpuMeasure = Get-CimInstance Win32_Processor -ErrorAction Stop | Measure-Object -Property LoadPercentage -Average
    if ($cpuMeasure.Count -gt 0) { $cpu = [math]::Round($cpuMeasure.Average, 2) }
  } catch {}

  try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    if ($os.TotalVisibleMemorySize -gt 0) {
      $usedMemory = $os.TotalVisibleMemorySize - $os.FreePhysicalMemory
      $memory = [math]::Round(($usedMemory / $os.TotalVisibleMemorySize) * 100, 2)
    }
    $lastBoot = $os.LastBootUpTime.ToUniversalTime().ToString("o")
  } catch {}

  try {
    $drive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction Stop
    if ($drive.Size -gt 0) {
      $disk = [math]::Round((($drive.Size - $drive.FreeSpace) / $drive.Size) * 100, 2)
    }
  } catch {}

  return @{
    cpuUsage     = $cpu
    memoryUsage  = $memory
    diskUsage    = $disk
    lastBootTime = $lastBoot
  }
}

function Send-AgentHeartbeat {
  param(
    [Nullable[int]]$LatencyMs,
    [hashtable]$Resources
  )

  $highUsage = ($Resources.cpuUsage -ge 85) -or ($Resources.memoryUsage -ge 85) -or ($Resources.diskUsage -ge 85)
  $status = if (($LatencyMs -ne $null -and $LatencyMs -gt 500) -or $highUsage) { "slow" } else { "online" }
  $payload = @{
    clientId     = $ClientId
    hostname     = $hostnameValue
    ipAddress    = $ipAddress
    department   = $Department
    block        = $Block
    agentVersion = $AgentVersion
    status       = $status
    latencyMs    = $LatencyMs
    cpuUsage     = $Resources.cpuUsage
    memoryUsage  = $Resources.memoryUsage
    diskUsage    = $Resources.diskUsage
    lastBootTime = $Resources.lastBootTime
  }

  Invoke-RestMethod -Uri $heartbeatUrl -Method Post -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json) | Out-Null
  Write-Host "Heartbeat sent successfully for $hostnameValue"
}

function Resolve-AgentUrl {
  param([string]$TargetUrl)
  if ([string]::IsNullOrWhiteSpace($TargetUrl)) { return "" }
  if ($TargetUrl -match '^https?://') { return $TargetUrl }
  if ($TargetUrl.StartsWith("/")) {
    return "$($apiBaseUrl.TrimEnd('/'))$TargetUrl"
  }
  return $TargetUrl
}

function Test-AgentService {
  param(
    [string]$ServiceKey,
    [string]$ServiceName,
    [string]$TargetUrl
  )

  $resolvedUrl = Resolve-AgentUrl $TargetUrl
  $checkedAt = (Get-Date).ToUniversalTime().ToString("o")
  if ([string]::IsNullOrWhiteSpace($resolvedUrl)) {
    return @{
      serviceKey   = $ServiceKey
      serviceName  = $ServiceName
      targetUrl    = $TargetUrl
      status       = "cannot_verify"
      latencyMs    = $null
      dnsMs        = $null
      errorMessage = "Service URL is not configured"
      checkedAt    = $checkedAt
    }
  }

  $dnsMs = $null
  try {
    $hostName = ([Uri]$resolvedUrl).DnsSafeHost
    if ($hostName) {
      $dnsWatch = [Diagnostics.Stopwatch]::StartNew()
      Resolve-DnsName -Name $hostName -ErrorAction Stop | Out-Null
      $dnsWatch.Stop()
      $dnsMs = [int]$dnsWatch.ElapsedMilliseconds
    }
  } catch {
    return @{
      serviceKey   = $ServiceKey
      serviceName  = $ServiceName
      targetUrl    = $resolvedUrl
      status       = "cannot_verify"
      latencyMs    = $null
      dnsMs        = $dnsMs
      errorMessage = "DNS resolution failed: $($_.Exception.Message)"
      checkedAt    = $checkedAt
    }
  }

  $watch = [Diagnostics.Stopwatch]::StartNew()
  try {
    Invoke-WebRequest -Uri $resolvedUrl -Method Head -UseBasicParsing -TimeoutSec 15 | Out-Null
    $watch.Stop()
    $latency = [int]$watch.ElapsedMilliseconds
    return @{
      serviceKey   = $ServiceKey
      serviceName  = $ServiceName
      targetUrl    = $resolvedUrl
      status       = if ($latency -gt 500) { "slow" } else { "online" }
      latencyMs    = $latency
      dnsMs        = $dnsMs
      errorMessage = ""
      checkedAt    = $checkedAt
    }
  } catch {
    $watch.Stop()
    $message = $_.Exception.Message
    $status = if ($message -match "certificate|SSL|TLS|DNS|name") { "cannot_verify" } else { "offline" }
    return @{
      serviceKey   = $ServiceKey
      serviceName  = $ServiceName
      targetUrl    = $resolvedUrl
      status       = $status
      latencyMs    = [int]$watch.ElapsedMilliseconds
      dnsMs        = $dnsMs
      errorMessage = $message
      checkedAt    = $checkedAt
    }
  }
}

function Send-AgentServiceChecks {
  $servicesResponse = Invoke-RestMethod -Uri $servicesUrl -Method Get -Headers $headers
  $checks = @()
  foreach ($service in @($servicesResponse.data)) {
    $checks += Test-AgentService $service.serviceKey $service.serviceName $service.targetUrl
  }
  $payload = @{
    clientId = $ClientId
    hostname = $hostnameValue
    checks = $checks
  }
  Invoke-RestMethod -Uri $serviceChecksUrl -Method Post -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 5) | Out-Null
  Write-Host "Agent service checks sent successfully for $hostnameValue ($($checks.Count) services)"
}

function Invoke-AgentRun {
  $pingResults = Test-Connection -ComputerName "8.8.8.8" -Count 4 -ErrorAction SilentlyContinue
  $received = @($pingResults).Count
  $averagePing = if ($received) { [math]::Round(($pingResults | Measure-Object -Property ResponseTime -Average).Average, 0) } else { $null }
  Send-AgentHeartbeat $averagePing (Get-ResourceSnapshot)
  Send-AgentServiceChecks
}

if ($Loop) {
  while ($true) {
    Invoke-AgentRun
    Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
  }
}

Invoke-AgentRun
exit 0
