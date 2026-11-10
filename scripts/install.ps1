# Install a skill from this repository (Windows PowerShell).
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 claude
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 codex
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 openclaw C:\path\to\workspace
param([Parameter(Mandatory=$true)][ValidateSet('claude','codex','openclaw')][string]$Target, [string]$Workspace)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
switch ($Target) {
  'claude'   { $skill = 'show-me';   $dest = Join-Path $HOME '.claude\skills' }
  'codex'    { $skill = 'show-me';   $dest = Join-Path $HOME '.agents\skills' }
  'openclaw' { if (-not $Workspace) { throw 'Give the OpenClaw workspace folder.' }; $skill = 'phone-viz'; $dest = Join-Path $Workspace 'skills' }
}
New-Item -ItemType Directory -Force $dest | Out-Null
$target = Join-Path $dest $skill
if (Test-Path $target) {
  $backups = Join-Path (Split-Path -Parent $dest) 'skill-backups'
  New-Item -ItemType Directory -Force $backups | Out-Null
  $backup = Join-Path $backups ("$skill-" + (Get-Date -Format 'yyyyMMddHHmmss'))
  Move-Item $target $backup
  Write-Host "Moved the previous $skill to $backup"
}
Copy-Item -Recurse (Join-Path $root "skills\$skill") $target
Write-Host "Installed: $target"
try { $v = (node --version) -replace '^v',''; if ([int]$v.Split('.')[0] -lt 22) { Write-Warning "Node $v found; the scripts need Node 22 or newer." } } catch { Write-Warning 'Node not found; the scripts need Node 22 or newer.' }
