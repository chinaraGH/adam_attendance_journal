$ErrorActionPreference = "Stop"

function Exec([string]$cmd) {
  $out = & powershell -NoProfile -Command $cmd 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $cmd`n$out"
  }
  return $out
}

function Git([string]$args) {
  $out = & git @args 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git $args`n$out"
  }
  return $out
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$intervalSeconds = 600
$pushIntervalSeconds = 3600

Write-Host "Autosave started in $repoRoot"
Write-Host " - commit every $intervalSeconds seconds to branch 'autosave'"
Write-Host " - push every $pushIntervalSeconds seconds to origin/autosave"
Write-Host "Press Ctrl+C to stop."

# Ensure autosave branch exists (local)
$autosaveExists = $true
try {
  Git "show-ref --verify --quiet refs/heads/autosave"
} catch {
  $autosaveExists = $false
}

if (-not $autosaveExists) {
  $current = (Git "rev-parse --abbrev-ref HEAD").Trim()
  Write-Host "Creating branch 'autosave' from '$current'..."
  Git "branch autosave"
}

$lastPushAt = Get-Date "1970-01-01T00:00:00Z"

while ($true) {
  Start-Sleep -Seconds $intervalSeconds

  # Only run if there are changes (including untracked)
  $status = (Git "status --porcelain").Trim()
  if ([string]::IsNullOrWhiteSpace($status)) {
    continue
  }

  # Avoid overlapping runs (e.g. if editor triggers git commands)
  $lockPath = Join-Path $repoRoot ".git\autosave.lock"
  try {
    $lockHandle = [System.IO.File]::Open($lockPath, "OpenOrCreate", "ReadWrite", "None")
  } catch {
    Write-Host "Autosave: lock is held, skipping this cycle."
    continue
  }

  try {
    # Switch to autosave to keep main clean
    $currentBranch = (Git "rev-parse --abbrev-ref HEAD").Trim()
    if ($currentBranch -ne "autosave") {
      Git "switch autosave"
    }

    # Stage and commit (safe message)
    Git "add -A"
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $msg = "WIP autosave: $ts"
    try {
      Git @("commit", "-m", $msg)
      Write-Host "Autosave commit created: $msg"
    } catch {
      # If nothing to commit after staging (rare), ignore.
      $err = $_.Exception.Message
      if ($err -match "nothing to commit") {
        continue
      }
      throw
    }

    # Push at most once per hour (and only if ahead)
    $now = Get-Date
    if (($now - $lastPushAt).TotalSeconds -ge $pushIntervalSeconds) {
      $aheadLine = (Git "status -sb").Split("`n") | Select-Object -First 1
      if ($aheadLine -match "\[ahead\s+\d+\]") {
        Git "push -u origin autosave"
        Write-Host "Autosave pushed to origin/autosave"
      }
      $lastPushAt = $now
    }
  } finally {
    if ($lockHandle) { $lockHandle.Dispose() }
  }
}

