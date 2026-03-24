<#
.SYNOPSIS
    Mantis Agent Installer for Windows
.DESCRIPTION
    Installs Mantis Agent and its prerequisites (Node.js, Ollama).
    Usage: powershell -c "iwr -useb https://raw.githubusercontent.com/Rainworks-LLC/mantis-agent/main/install.ps1 | iex"
#>
param(
    [string]$Version = "latest",
    [switch]$SkipOllama,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# ─── UI helpers ───────────────────────────────────────────────────────────────

function Write-Info    { param([string]$Message) Write-Host "  . $Message" -ForegroundColor Gray }
function Write-Ok      { param([string]$Message) Write-Host "  + $Message" -ForegroundColor Green }
function Write-Warn    { param([string]$Message) Write-Host "  ! $Message" -ForegroundColor Yellow }
function Write-Err     { param([string]$Message) Write-Host "  x $Message" -ForegroundColor Red }
function Write-Step    { param([string]$Message) Write-Host "`n  $Message" -ForegroundColor Cyan }

$script:Stage = 0
$script:StageTotal = 3
function Write-Stage {
    param([string]$Message)
    $script:Stage++
    Write-Host "`n  [$($script:Stage)/$($script:StageTotal)] $Message" -ForegroundColor Green
}

function Write-Banner {
    Write-Host ""
    Write-Host "  Mantis Agent Installer" -ForegroundColor Green
    Write-Host "  Autonomous, self-constructing agents powered by Ollama" -ForegroundColor DarkGray
    Write-Host ""
}

# ─── Command resolution ──────────────────────────────────────────────────────

function Find-Command {
    param([string[]]$Candidates)
    foreach ($name in $Candidates) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Get-NpmPath {
    $path = Find-Command @("npm.cmd", "npm.exe", "npm")
    if (-not $path) { throw "npm not found on PATH." }
    return $path
}

function Get-MantisPath {
    return (Find-Command @("mantis.cmd", "mantis.exe", "mantis"))
}

function Add-ToProcessPath {
    param([string]$Dir)
    if (-not ($env:Path -split ";" | Where-Object { $_ -ieq $Dir })) {
        $env:Path = "$Dir;$env:Path"
    }
}

# ─── Node.js ──────────────────────────────────────────────────────────────────

$NodeMinMajor = 20

function Get-NodeMajor {
    try {
        $ver = & node --version 2>$null
        if ($ver -match "^v(\d+)") { return [int]$Matches[1] }
    } catch {}
    return 0
}

function Test-Node {
    $major = Get-NodeMajor
    if ($major -ge $NodeMinMajor) {
        $ver = & node --version 2>$null
        Write-Ok "Node.js $ver found"
        return $true
    }
    return $false
}

function Install-Node {
    Write-Warn "Node.js $NodeMinMajor+ is required but not found"

    if ($DryRun) {
        Write-Info "[dry-run] Would install Node.js via winget/choco/scoop"
        return
    }

    # Try winget
    if (Get-Command "winget.exe" -ErrorAction SilentlyContinue) {
        Write-Info "Installing Node.js via winget..."
        & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>$null
        # Refresh PATH
        $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"
        if (Test-Node) { return }
    }

    # Try Chocolatey
    if (Get-Command "choco.exe" -ErrorAction SilentlyContinue) {
        Write-Info "Installing Node.js via Chocolatey..."
        & choco install nodejs-lts -y 2>$null
        $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"
        if (Test-Node) { return }
    }

    # Try Scoop
    if (Get-Command "scoop.exe" -ErrorAction SilentlyContinue) {
        Write-Info "Installing Node.js via Scoop..."
        & scoop install nodejs-lts 2>$null
        if (Test-Node) { return }
    }

    Write-Err "Could not auto-install Node.js"
    Write-Host "  Install Node.js $NodeMinMajor+ manually: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# ─── Ollama ───────────────────────────────────────────────────────────────────

function Test-Ollama {
    if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
        Write-Ok "Ollama found"
        return $true
    }
    return $false
}

function Test-OllamaRunning {
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3
        Write-Ok "Ollama is running"
        return $true
    } catch {
        return $false
    }
}

function Request-OllamaInstall {
    if ($SkipOllama) {
        Write-Info "Skipping Ollama check (--SkipOllama)"
        return
    }

    Write-Warn "Ollama is not installed"
    Write-Host ""
    Write-Host "  Mantis Agent requires Ollama to run local LLMs." -ForegroundColor Gray
    Write-Host "  Install it from: https://ollama.com/download/windows" -ForegroundColor Gray
    Write-Host ""

    # Non-interactive pipes can't prompt
    if (-not [Environment]::UserInteractive) {
        Write-Info "Non-interactive session; install Ollama manually and rerun"
        return
    }

    $answer = Read-Host "  Install Ollama now? [Y/n]"
    if ([string]::IsNullOrWhiteSpace($answer) -or $answer -match "^[Yy]") {
        if ($DryRun) {
            Write-Info "[dry-run] Would download and run Ollama installer"
            return
        }

        # Try winget first
        if (Get-Command "winget.exe" -ErrorAction SilentlyContinue) {
            Write-Info "Installing Ollama via winget..."
            & winget install Ollama.Ollama --accept-source-agreements --accept-package-agreements 2>$null
            $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
            $env:Path = "$machinePath;$userPath"
            if (Test-Ollama) { return }
        }

        Write-Warn "Could not auto-install Ollama"
        Write-Host "  Download from: https://ollama.com/download/windows" -ForegroundColor Cyan
    } else {
        Write-Info "Skipping Ollama install - you can install it later from https://ollama.com"
    }
}

function Show-ModelSuggestion {
    try {
        $tags = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 3
        if ($tags.models -and $tags.models.Count -gt 0) {
            Write-Ok "Ollama has models available"
            return
        }
    } catch {}

    Write-Host ""
    Write-Info "No Ollama models found. Pull one to get started:"
    Write-Host "    ollama pull llama3.1" -ForegroundColor DarkGray
    Write-Host ""
}

# ─── npm global install ──────────────────────────────────────────────────────

function Get-NpmGlobalBinCandidates {
    param([string]$NpmPrefix)
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($NpmPrefix)) {
        $candidates += $NpmPrefix
        $candidates += (Join-Path $NpmPrefix "bin")
    }
    if (-not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
        $candidates += (Join-Path $env:APPDATA "npm")
    }
    return $candidates | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
}

function Install-Mantis {
    $spec = "@rainworks-llc/mantis-agent"
    if ($Version -ne "latest") {
        $spec = "@rainworks-llc/mantis-agent@$Version"
    }

    if ($DryRun) {
        Write-Info "[dry-run] npm install -g $spec"
        return
    }

    Write-Info "Installing $spec globally via npm..."

    # Suppress noisy npm output
    $prevLogLevel = $env:NPM_CONFIG_LOGLEVEL
    $prevUpdateNotifier = $env:NPM_CONFIG_UPDATE_NOTIFIER
    $prevFund = $env:NPM_CONFIG_FUND
    $prevAudit = $env:NPM_CONFIG_AUDIT
    $env:NPM_CONFIG_LOGLEVEL = "error"
    $env:NPM_CONFIG_UPDATE_NOTIFIER = "false"
    $env:NPM_CONFIG_FUND = "false"
    $env:NPM_CONFIG_AUDIT = "false"

    try {
        $npmOutput = & (Get-NpmPath) install -g $spec 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Err "npm install failed"
            $npmOutput | ForEach-Object { Write-Host "  $_" }
            Write-Host ""
            Write-Host "  Try running manually:" -ForegroundColor Yellow
            Write-Host "    npm install -g $spec" -ForegroundColor Cyan
            exit 1
        }
        Write-Ok "Mantis Agent installed"
    } finally {
        $env:NPM_CONFIG_LOGLEVEL = $prevLogLevel
        $env:NPM_CONFIG_UPDATE_NOTIFIER = $prevUpdateNotifier
        $env:NPM_CONFIG_FUND = $prevFund
        $env:NPM_CONFIG_AUDIT = $prevAudit
    }
}

# ─── PATH check ──────────────────────────────────────────────────────────────

function Ensure-MantisOnPath {
    if (Get-MantisPath) {
        Write-Ok "mantis CLI is on PATH"
        return $true
    }

    # Try to find it in npm global dirs and add to PATH
    $npmPrefix = $null
    try {
        $npmPrefix = (& (Get-NpmPath) config get prefix 2>$null).Trim()
    } catch {}

    $npmBins = Get-NpmGlobalBinCandidates -NpmPrefix $npmPrefix
    foreach ($dir in $npmBins) {
        if (Test-Path (Join-Path $dir "mantis.cmd")) {
            $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
            if (-not ($userPath -split ";" | Where-Object { $_ -ieq $dir })) {
                [Environment]::SetEnvironmentVariable("Path", "$userPath;$dir", "User")
                $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
                Write-Warn "Added $dir to user PATH (restart terminal if command not found)"
            }
            Add-ToProcessPath $dir
            return $true
        }
    }

    Write-Warn "mantis is not on PATH yet"
    Write-Host "  Restart PowerShell or add the npm global install folder to PATH." -ForegroundColor Yellow
    if ($npmBins.Count -gt 0) {
        Write-Host "  Expected path (one of):" -ForegroundColor Gray
        foreach ($dir in $npmBins) {
            Write-Host "    $dir" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  Hint: run `"npm config get prefix`" to find your npm global path." -ForegroundColor Gray
    }
    return $false
}

# ─── Doctor ───────────────────────────────────────────────────────────────────

function Invoke-Doctor {
    $mantis = Get-MantisPath
    if (-not $mantis) { return }
    Write-Info "Running mantis doctor..."
    try { & $mantis doctor } catch {}
}

# ─── Completion messages ─────────────────────────────────────────────────────

$Completions = @(
    "The mantis is ready. Tell it what to build."
    "Workspace created. Your agent awaits instructions."
    "Installed. Time to create your first agent."
    "All set. Run mantis create to get started."
    "The mantis has landed. Let's build something."
    "Tools? Memory? Personality? Your agent handles all of it."
    "One CLI, infinite agents. Go wild."
    "Agents that build their own tools. What could go wrong?"
)

function Get-CompletionMessage {
    return $Completions[(Get-Random -Maximum $Completions.Count)]
}

# ─── Main ─────────────────────────────────────────────────────────────────────

function Show-AutonomyWarning {
    Write-Host "  Warning: Use at Your Own Risk" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Mantis agents are autonomous. Once created, an agent can:" -ForegroundColor Gray
    Write-Host "    - Execute shell commands on your machine" -ForegroundColor Gray
    Write-Host "    - Read and write files in its workspace" -ForegroundColor Gray
    Write-Host "    - Build and run its own tools" -ForegroundColor Gray
    Write-Host "    - Fetch URLs from the internet" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Self-built tool code runs in a sandboxed child process," -ForegroundColor Gray
    Write-Host "  but built-in tools run with your user permissions." -ForegroundColor Gray
    Write-Host "  Review the docs before giving an agent access to sensitive data." -ForegroundColor Gray
    Write-Host ""

    if (-not [Environment]::UserInteractive) {
        Write-Info "Non-interactive install - proceeding (you accept the above by continuing)"
        return
    }

    $answer = Read-Host "  Continue with installation? [Y/n]"
    if (-not [string]::IsNullOrWhiteSpace($answer) -and $answer -notmatch "^[Yy]") {
        Write-Host ""
        Write-Info "Installation cancelled."
        exit 0
    }
}

function Main {
    Write-Banner
    Show-AutonomyWarning

    # Show plan
    Write-Step "Install plan"
    Write-Host "    Version:  $Version" -ForegroundColor Gray
    Write-Host "    Method:   npm (global)" -ForegroundColor Gray
    Write-Host "    OS:       Windows" -ForegroundColor Gray
    if ($DryRun) {
        Write-Host "    Dry run:  yes" -ForegroundColor Gray
    }

    # ── Stage 1: Environment ──
    Write-Stage "Preparing environment"

    if (-not (Test-Node)) {
        Install-Node
        if (-not (Test-Node)) {
            Write-Err "Node.js $NodeMinMajor+ is required"
            Write-Host "  Install manually: https://nodejs.org" -ForegroundColor Yellow
            exit 1
        }
    }

    if (-not (Test-Ollama)) {
        Request-OllamaInstall
    } else {
        if (-not (Test-OllamaRunning)) {
            Write-Warn "Ollama is installed but not running"
            Write-Info "Start it from the system tray or run: ollama serve"
        }
    }

    # ── Stage 2: Install ──
    Write-Stage "Installing Mantis Agent"

    Install-Mantis

    # ── Stage 3: Finalize ──
    Write-Stage "Finalizing"

    $null = Ensure-MantisOnPath
    Invoke-Doctor

    if (Test-OllamaRunning) {
        Show-ModelSuggestion
    }

    # ── Done ──
    $ver = $null
    try { $ver = & (Get-MantisPath) --version 2>$null } catch {}

    Write-Host ""
    if ($ver) {
        Write-Host "  Mantis Agent installed successfully (v$ver)!" -ForegroundColor Green
    } else {
        Write-Host "  Mantis Agent installed successfully!" -ForegroundColor Green
    }
    Write-Host "  $(Get-CompletionMessage)" -ForegroundColor DarkGray
    Write-Host ""

    Write-Step "Next steps"
    Write-Host "    mantis create          Create your first agent" -ForegroundColor DarkGray
    Write-Host "    mantis chat <agent>    Start chatting" -ForegroundColor DarkGray
    Write-Host "    mantis serve --open    Open the web UI" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Docs: https://github.com/Rainworks-LLC/mantis-agent" -ForegroundColor Gray
    Write-Host ""
}

Main
