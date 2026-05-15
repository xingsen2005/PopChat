[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = $SCRIPT_DIR
$DIST_DIR = Join-Path $PROJECT_DIR "dist"
$RELEASE_DIR = Join-Path $PROJECT_DIR "release-final"
$CACHE_DIR = Join-Path $PROJECT_DIR "builder-cache"
$PACKAGE_JSON = Join-Path $PROJECT_DIR "package.json"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [INFO] $Message" -ForegroundColor Yellow
}

function Invoke-NpmCommand {
    param(
        [string]$Command,
        [string]$WorkingDir
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c npm $Command"
    $psi.WorkingDirectory = $WorkingDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()
    $proc.WaitForExit()

    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    $exitCode = $proc.ExitCode

    if ($stdout) {
        $stdout -split "`r?`n" | ForEach-Object { if ($_ -match '\S') { Write-Host "    $_" } }
    }
    if ($stderr) {
        $stderr -split "`r?`n" | ForEach-Object { if ($_ -match '\S') { Write-Host "    $_" } }
    }

    return $exitCode
}

function Invoke-NpxCommand {
    param(
        [string]$Command,
        [string]$WorkingDir
    )
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c npx $Command"
    $psi.WorkingDirectory = $WorkingDir
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
    $stderrTask = $proc.StandardError.ReadToEndAsync()
    $proc.WaitForExit()

    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    $exitCode = $proc.ExitCode

    if ($stdout) {
        $stdout -split "`r?`n" | ForEach-Object { if ($_ -match '\S') { Write-Host "    $_" } }
    }
    if ($stderr) {
        $stderr -split "`r?`n" | ForEach-Object { if ($_ -match '\S') { Write-Host "    $_" } }
    }

    return $exitCode
}

$overallStart = Get-Date

Write-Host ""
Write-Host "  ____  _        __          __              _   " -ForegroundColor Magenta
Write-Host " |  _ \(_)___  __\ \        / /_ _ _ __ ___ | |_" -ForegroundColor Magenta
Write-Host " | |_) | / __|/ _ \ \ /\ / / _` | '_ ` _ \| __|" -ForegroundColor Magenta
Write-Host " |  __/| \__ \  __/\ V  V / (_| | | | | | | |_" -ForegroundColor Magenta
Write-Host " |_|   |_|___/\___| \_/\_/ \__,_|_| |_| |_|\__|" -ForegroundColor Magenta
Write-Host ""
Write-Host "  PopChat Automated Build Script v1.0" -ForegroundColor White
Write-Host "  Target: Portable Single-File EXE (Windows x64)" -ForegroundColor White
Write-Host ""

# ============================================================
# Step 1: Environment Check
# ============================================================
Write-Step "Step 1/7: Environment Check"

$envOk = $true

$nodePath = Get-Command node -ErrorAction SilentlyContinue
if ($nodePath) {
    $nodeVer = & node --version
    Write-Success "Node.js: $nodeVer"
}
else {
    Write-Fail "Node.js not found. Please install Node.js >= 18."
    $envOk = $false
}

$npmPath = Get-Command npm -ErrorAction SilentlyContinue
if ($npmPath) {
    $npmVer = & npm --version
    Write-Success "npm: v$npmVer"
}
else {
    Write-Fail "npm not found. Please install npm."
    $envOk = $false
}

if ($nodePath) {
    $nodeMajor = [int]($nodeVer -replace 'v', '' -split '\.')[0]
    if ($nodeMajor -lt 18) {
        Write-Fail "Node.js version must be >= 18, current: $nodeVer"
        $envOk = $false
    }
}

if (-not $envOk) {
    Write-Fail "Environment check failed. Please install missing dependencies."
    exit 1
}

Write-Success "Environment check passed"

# ============================================================
# Step 2: Project Directory Validation
# ============================================================
Write-Step "Step 2/7: Project Directory Validation"

if (-not (Test-Path $PACKAGE_JSON)) {
    Write-Fail "package.json not found at: $PACKAGE_JSON"
    Write-Info "Please run this script from the project root directory."
    exit 1
}
Write-Success "package.json found"

$requiredSrcFiles = @(
    "src\main.ts",
    "src\main.tsx",
    "src\App.tsx",
    "src\preload.js",
    "src\index.css",
    "src\types\index.ts",
    "src\utils\storage.ts",
    "src\utils\api.ts",
    "src\components\SettingsPanel.tsx",
    "src\components\ChatArea.tsx",
    "src\components\Sidebar.tsx",
    "src\components\ModelManagement.tsx",
    "src\components\ModelConfigModal.tsx",
    "scripts\build.mjs",
    "tsconfig.json",
    "index.html",
    "postcss.config.js"
)

$srcMissing = $false
foreach ($file in $requiredSrcFiles) {
    $fullPath = Join-Path $PROJECT_DIR $file
    if (-not (Test-Path $fullPath)) {
        Write-Fail "Missing: $file"
        $srcMissing = $true
    }
}

if ($srcMissing) {
    Write-Fail "Required source files are missing."
    exit 1
}
Write-Success "All required source files present"

# ============================================================
# Step 3: Dependency Installation
# ============================================================
Write-Step "Step 3/7: Dependency Check & Installation"

$nodeModulesDir = Join-Path $PROJECT_DIR "node_modules"
$needInstall = $false

$criticalModules = @("electron", "react", "react-dom", "esbuild", "vite")
$missingModules = $false
foreach ($mod in $criticalModules) {
    if (-not (Test-Path (Join-Path $nodeModulesDir $mod))) {
        $missingModules = $true
        break
    }
}

if ($missingModules) {
    Write-Info "Critical modules missing, running npm install..."
    $needInstall = $true
}
elseif (-not (Test-Path $nodeModulesDir)) {
    Write-Info "node_modules not found, running npm install..."
    $needInstall = $true
}
else {
    $lockFile = Join-Path $PROJECT_DIR "package-lock.json"
    if (Test-Path $lockFile) {
        $lockHash = (Get-FileHash $lockFile -Algorithm MD5).Hash
        $hashFile = Join-Path $nodeModulesDir ".install-hash"
        if (Test-Path $hashFile) {
            $savedHash = (Get-Content $hashFile -Raw).Trim()
            if ($lockHash -ne $savedHash) {
                Write-Info "package-lock.json changed, reinstalling..."
                $needInstall = $true
            }
        }
        else {
            Write-Info "No install hash found, running npm install..."
            $needInstall = $true
        }
    }
    else {
        $needInstall = $true
    }
}

if ($needInstall) {
    Write-Success "Installing dependencies..."
    $installExit = Invoke-NpmCommand "install" $PROJECT_DIR
    if ($installExit -ne 0) {
        Write-Fail "npm install failed (exit code: $installExit)"
        exit 1
    }
    $lockFile = Join-Path $PROJECT_DIR "package-lock.json"
    if (Test-Path $lockFile) {
        $lockHash = (Get-FileHash $lockFile -Algorithm MD5).Hash
        Set-Content -Path (Join-Path $nodeModulesDir ".install-hash") -Value $lockHash -NoNewline
    }
    Write-Success "Dependencies installed successfully"
}
else {
    Write-Success "Dependencies up to date (skipped install)"
}

# ============================================================
# Step 4: Builder Cache Configuration
# ============================================================
Write-Step "Step 4/7: Builder Cache Configuration"

if (Test-Path $CACHE_DIR) {
    $env:ELECTRON_BUILDER_CACHE = $CACHE_DIR
    Write-Success "ELECTRON_BUILDER_CACHE set to: $CACHE_DIR"

    $cacheItems = @("electron", "winCodeSign")
    foreach ($item in $cacheItems) {
        $itemPath = Join-Path $CACHE_DIR $item
        if (Test-Path $itemPath) {
            Write-Success "Cache present: $item"
        }
        else {
            Write-Info "Cache missing: $item (will be downloaded during packaging)"
        }
    }
}
else {
    Write-Info "No local builder-cache found. electron-builder will download on demand."
    Write-Info "To speed up future builds, keep the builder-cache directory."
}

# ============================================================
# Step 5: Clean Previous Build Artifacts
# ============================================================
Write-Step "Step 5/7: Clean Previous Build Artifacts"

if (Test-Path $DIST_DIR) {
    Remove-Item -Recurse -Force $DIST_DIR
    Write-Success "dist directory cleaned"
}
else {
    Write-Info "No previous dist directory to clean"
}

if (Test-Path $RELEASE_DIR) {
    $oldFiles = Get-ChildItem $RELEASE_DIR -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in '.exe', '.blockmap', '.yml' }
    if ($oldFiles) {
        foreach ($f in $oldFiles) {
            Remove-Item -Force $f.FullName
            Write-Success "Removed: $($f.Name)"
        }
    }
}

# ============================================================
# Step 6: Build (esbuild + Vite)
# ============================================================
Write-Step "Step 6/7: Building Application"

$buildStart = Get-Date

Write-Success "Running: npm run build"
$buildExit = Invoke-NpmCommand "run build" $PROJECT_DIR
if ($buildExit -ne 0) {
    Write-Fail "Build failed (exit code: $buildExit)"
    exit 1
}

$buildEnd = Get-Date
$buildDuration = ($buildEnd - $buildStart).TotalSeconds

$distMainCjs = Join-Path $DIST_DIR "main.cjs"
$distPreloadCjs = Join-Path $DIST_DIR "preload.cjs"
$distRendererHtml = Join-Path $DIST_DIR "renderer\index.html"

$buildArtifactsOk = $true
foreach ($artifact in @($distMainCjs, $distPreloadCjs, $distRendererHtml)) {
    if (Test-Path $artifact) {
        $size = [math]::Round((Get-Item $artifact).Length / 1KB, 1)
        Write-Success "Built: $(Split-Path $artifact -Leaf) ($size KB)"
    }
    else {
        Write-Fail "Missing build artifact: $artifact"
        $buildArtifactsOk = $false
    }
}

if (-not $buildArtifactsOk) {
    Write-Fail "Build artifacts incomplete"
    exit 1
}

Write-Success "Build completed in $([math]::Round($buildDuration, 1))s"

# ============================================================
# Step 7: Package (electron-builder -> portable EXE)
# ============================================================
Write-Step "Step 7/7: Packaging Portable EXE"

$packageStart = Get-Date

Write-Success "Running: electron-builder (portable, x64)"
$pkgExit = Invoke-NpxCommand "electron-builder --win portable --x64" $PROJECT_DIR
if ($pkgExit -ne 0) {
    Write-Fail "Packaging failed (exit code: $pkgExit)"
    exit 1
}

$packageEnd = Get-Date
$packageDuration = ($packageEnd - $packageStart).TotalSeconds

# ============================================================
# Final Verification
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  BUILD RESULT" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

$portableExe = Get-ChildItem $RELEASE_DIR -Filter "*.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*Setup*" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($portableExe) {
    $sizeMB = [math]::Round($portableExe.Length / 1MB, 2)
    Write-Success "Portable EXE: $($portableExe.Name)"
    Write-Success "File Size: $sizeMB MB"
    Write-Success "Location: $($portableExe.FullName)"
}
else {
    Write-Fail "Portable EXE not found in release-final directory"
    $unpackedDir = Join-Path $RELEASE_DIR "win-unpacked"
    if (Test-Path $unpackedDir) {
        $unpackedExe = Get-ChildItem $unpackedDir -Filter "*.exe" -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike "*setup*" } |
            Select-Object -First 1
        if ($unpackedExe) {
            Write-Info "Unpacked EXE found: $($unpackedExe.FullName)"
        }
    }
    exit 1
}

$overallEnd = Get-Date
$overallDuration = ($overallEnd - $overallStart).TotalSeconds

Write-Host ""
Write-Host "  Build Time Breakdown:" -ForegroundColor White
Write-Host "    Build (esbuild + Vite):    $([math]::Round($buildDuration, 1))s" -ForegroundColor Gray
Write-Host "    Package (electron-builder): $([math]::Round($packageDuration, 1))s" -ForegroundColor Gray
Write-Host "    Total:                      $([math]::Round($overallDuration, 1))s" -ForegroundColor White
Write-Host ""
Write-Success "All done! The portable EXE is ready at: $($portableExe.FullName)"
Write-Host ""
