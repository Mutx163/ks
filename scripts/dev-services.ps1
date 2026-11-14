#Requires -Version 7.0
<#
.SYNOPSIS
    城科卷王 · 本地共享测试服务管理器（单实例）
.DESCRIPTION
    统一管理两个本地开发服务，同一时刻最多一个实例：
      api : wrangler dev --local --port 8787 --persist-to .tmp-services/d1
      web : vite --port 3000 --strictPort

    设计依据 docs/共享测试服务-方案.md：
      - 固定端口，被占拒绝启动，绝不自动换端口
      - 单实例：命名互斥锁 Global\Ks_DevServices_Mutex + 端口探测 + PID 指纹
      - 只结束本脚本记录、命令行匹配本项目服务的进程树（taskkill /T）
      - 健康检查以 HTTP 为准：api GET /api/banks 200 且 ok:true；web GET / 200 且含标题
      - PID / 日志 / lease 全部落在 .tmp-services/（已被 .tmp-*/ 忽略）

.PARAMETER Action
    start | stop | status | restart
.PARAMETER Service
    api | web | all（默认 all）
.PARAMETER Owner
    本轮任务 owner，写进 lease 便于追溯（默认 $env:KS_OWNER 或当前用户名）
.PARAMETER Task
    本轮任务名，写进 lease（默认 $env:KS_TASK 或 dev）
.PARAMETER TimeoutSec
    单个服务启动后等待健康检查的最长秒数（默认 60）

.EXAMPLE
    pwsh -File scripts/dev-services.ps1 -Action start -Owner 测试官 -Task "R2/R4 验收"
    pwsh -File scripts/dev-services.ps1 -Action status
    pwsh -File scripts/dev-services.ps1 -Action stop
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action,

    [ValidateSet('api', 'web', 'all')]
    [string]$Service = 'all',

    [string]$Owner = $(if ($env:KS_OWNER) { $env:KS_OWNER } else { $env:USERNAME }),
    [string]$Task = $(if ($env:KS_TASK) { $env:KS_TASK } else { 'dev' }),
    [int]$TimeoutSec = 60,

    # 可选的 wrangler dev --var 透传（KEY=VALUE 或 KEY:VALUE，可多次）。
    # 只用于本地测试，例如涉及后台登录的用例传 ADMIN_PASSWORD_HASH=<hash>；
    # 脚本不保存、不打印任何值，默认不传时行为与原来完全一致。
    [string[]]$ApiVar = @()
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $Root '.tmp-services'
$D1Dir = Join-Path $StateDir 'd1'
$LeaseFile = Join-Path $StateDir 'lease.json'
$ApiVarsFile = Join-Path $StateDir 'api.vars'
$MutexName = 'Global\Ks_DevServices_Mutex'

# 规范化 --var：接受 KEY=VALUE / KEY:VALUE，统一转成 wrangler 的 KEY:VALUE。
$NormalizedVars = @()
foreach ($raw in $ApiVar) {
    $m = [regex]::Match($raw, '^([A-Za-z_][A-Za-z0-9_]*)[=:](.+)$')
    if (-not $m.Success) {
        Write-Host "[dev-services] ApiVar 格式错误：应为 KEY=VALUE 或 KEY:VALUE（收到：$raw）"
        exit 1
    }
    $NormalizedVars += [pscustomobject]@{ Key = $m.Groups[1].Value; Value = $m.Groups[2].Value }
}

$ServiceDefs = @{
    api = @{
        Port      = 8787
        HealthUrl = 'http://127.0.0.1:8787/api/banks'
        LogBase   = 'api'
    }
    web = @{
        Port      = 3000
        HealthUrl = 'http://127.0.0.1:3000/'
        LogBase   = 'web'
    }
}

function Write-Log([string]$Message) {
    Write-Host "[dev-services] $Message"
}

function Get-Targets {
    if ($Service -eq 'all') { return @('api', 'web') }
    return @($Service)
}

function Initialize-StateDir {
    if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
    if (-not (Test-Path $D1Dir)) { New-Item -ItemType Directory -Path $D1Dir -Force | Out-Null }
}

function Get-PidFile([string]$Name) { Join-Path $StateDir "$Name.pid" }

function Get-OutLog([string]$Name) { Join-Path $StateDir "$Name.out.log" }
function Get-ErrLog([string]$Name) { Join-Path $StateDir "$Name.err.log" }

function Read-PidInfo([string]$Name) {
    $file = Get-PidFile $Name
    if (-not (Test-Path $file)) { return $null }
    try { return (Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Save-PidInfo([string]$Name, [int]$ProcessId, [int]$Port, [string]$CmdLine) {
    $info = [ordered]@{
        pid       = $ProcessId
        port      = $Port
        startedAt = (Get-Date).ToString('o')
        cmdline   = $CmdLine
    }
    $info | ConvertTo-Json -Compress | Set-Content -Path (Get-PidFile $Name) -Encoding UTF8
}

function Remove-PidInfo([string]$Name) {
    $file = Get-PidFile $Name
    if (Test-Path $file) { Remove-Item $file -Force }
}

function Write-ApiVarKeys {
    if ($NormalizedVars.Count -eq 0) {
        if (Test-Path $ApiVarsFile) { Remove-Item $ApiVarsFile -Force }
        return
    }
    $NormalizedVars | ForEach-Object { $_.Key } | Set-Content -Path $ApiVarsFile -Encoding UTF8
}

function Get-ApiVarKeys {
    if (-not (Test-Path $ApiVarsFile)) { return @() }
    return @(Get-Content $ApiVarsFile -Encoding UTF8 | Where-Object { $_ })
}

function Get-PortOwner([int]$Port) {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) { return [int]$conn.OwningProcess }
    return $null
}

function Get-CmdLine([int]$ProcessId) {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($p) { return [string]$p.CommandLine }
    return $null
}

function Test-Health([string]$Name) {
    $def = $ServiceDefs[$Name]
    try {
        $resp = Invoke-WebRequest -Uri $def.HealthUrl -UseBasicParsing -NoProxy -TimeoutSec 3 -ErrorAction Stop
        if ($resp.StatusCode -ne 200) { return $false }
        if ($Name -eq 'api') {
            return ($resp.Content -match '"ok"\s*:\s*true')
        }
        return ($resp.Content -match '<title>[^<]*城科卷王')
    } catch {
        return $false
    }
}

function Wait-Health([string]$Name, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Health $Name) { return $true }
        Start-Sleep -Milliseconds 750
    }
    return $false
}

function Wait-PortFree([int]$Port, [int]$Seconds = 10) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-PortOwner $Port)) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return (-not (Get-PortOwner $Port))
}

function Test-IsOurService([string]$Name, [int]$ProcessId) {
    $cmd = Get-CmdLine $ProcessId
    if (-not $cmd) { return $false }
    $def = $ServiceDefs[$Name]
    $pattern = if ($Name -eq 'api') { 'wrangler' } else { 'vite' }
    return (($cmd -match $pattern) -and ($cmd -match [string]$def.Port))
}

function Get-Residue {
    return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -in @('node.exe', 'workerd.exe', 'esbuild.exe') -and
            $_.CommandLine -match 'wrangler|workerd|esbuild|vite'
        })
}

function Write-Tail([string]$Name) {
    foreach ($log in @((Get-ErrLog $Name), (Get-OutLog $Name))) {
        if (Test-Path $log) {
            $lines = Get-Content $log -Tail 20 -ErrorAction SilentlyContinue
            if ($lines) {
                Write-Log "--- $(Split-Path -Leaf $log) 尾部 ---"
                $lines | ForEach-Object { Write-Host "    $_" }
            }
        }
    }
}

function Ensure-LocalSchema {
    # 本地 D1 空库没有 banks 表，/api/banks 会 500；先跑一次幂等 schema。
    # 只写 .tmp-services/d1 本地 sqlite，不碰生产。
    # 成功后落标记，后续 start 跳过（schema.sql 改了要删标记重跑）。
    $marker = Join-Path $D1Dir '.schema-ok'
    if (Test-Path $marker) { return }

    $schema = Join-Path $Root 'worker/schema.sql'
    $config = Join-Path $Root 'worker/wrangler.toml'
    if (-not (Test-Path $schema)) { throw "缺少 worker/schema.sql，无法初始化本地 D1" }
    $outLog = Join-Path $StateDir 'api.schema.log'
    $errLog = Join-Path $StateDir 'api.schema.err.log'
    Write-Log '初始化本地 D1（幂等 schema.sql）...'
    $argList = @('--yes', 'wrangler', 'd1', 'execute', 'ks-leaderboard', '--local',
        '--persist-to', $D1Dir, '--file', $schema, '-c', $config)
    $p = Start-Process -FilePath 'npx.cmd' -ArgumentList $argList -WorkingDirectory $Root `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not $p.HasExited -and $sw.Elapsed.TotalSeconds -lt 120) {
        Start-Sleep -Milliseconds 250
        $p.Refresh()
    }
    if (-not $p.HasExited) {
        & taskkill.exe /PID $p.Id /T /F *> $null
        throw '本地 D1 schema 初始化超时（120s），可能有其他 wrangler 进程占用本地库'
    }
    if ($p.ExitCode -ne 0) {
        Write-Tail 'api'
        throw "本地 D1 schema 初始化失败（exit=$($p.ExitCode)），见 .tmp-services/api.schema.log"
    }
    Set-Content -Path $marker -Value (Get-Date).ToString('o') -Encoding UTF8
    Write-Log '本地 D1 schema 初始化完成'
}

function Write-ViteConfig {
    # 共享服务专用包装器：把 .tmp-*/ 与 .git/ 排除出 watch，
    # 避免 Chrome profile / sqlite 等被锁文件触发 EBUSY 拖崩 vite。
    # 只覆盖 dev server 选项，其余沿用项目 vite.config.js，不改业务配置。
    $path = Join-Path $StateDir 'vite.dev.config.mjs'
    $content = @'
// 共享服务专用 vite 配置包装器（由 scripts/dev-services.ps1 生成/使用）
import base from '../vite.config.js';

export default async (env) => {
    const cfg = typeof base === 'function' ? await base(env) : base;
    return {
        ...cfg,
        server: {
            ...(cfg.server || {}),
            port: 3000,
            strictPort: true,
            watch: {
                ...((cfg.server && cfg.server.watch) || {}),
                ignored: ['**/.tmp-*/**', '**/.git/**', '**/node_modules/**']
            }
        }
    };
};
'@
    Set-Content -Path $path -Value $content -Encoding UTF8
    return $path
}

function Start-One([string]$Name) {
    $def = $ServiceDefs[$Name]
    $port = [int]$def.Port
    $outLog = Get-OutLog $Name
    $errLog = Get-ErrLog $Name

    $ownerPid = Get-PortOwner $port
    if ($ownerPid) {
        throw "$Name 端口 $port 已被 PID $ownerPid 占用（$(Get-CmdLine $ownerPid)），拒绝启动（不自动换端口）"
    }

    if (Test-Path $outLog) { Remove-Item $outLog -Force -ErrorAction SilentlyContinue }
    if (Test-Path $errLog) { Remove-Item $errLog -Force -ErrorAction SilentlyContinue }

    if ($Name -eq 'api') {
        $argList = @('--yes', 'wrangler', 'dev', '--local', '--port', "$port",
            '--persist-to', $D1Dir, '-c', (Join-Path $Root 'worker/wrangler.toml'))
        foreach ($kv in $NormalizedVars) {
            # wrangler dev 的 --var 语法是 KEY:VALUE
            $argList += @('--var', ($kv.Key + ':' + $kv.Value))
        }
    } else {
        $viteConfig = Write-ViteConfig
        $argList = @('vite', '--config', $viteConfig, '--port', "$port", '--strictPort')
    }

    Write-Log "启动 $Name（端口 $port）..."
    $proc = Start-Process -FilePath 'npx.cmd' -ArgumentList $argList -WorkingDirectory $Root `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
    Save-PidInfo $Name $proc.Id $port ("npx.cmd " + ($argList -join ' '))

    if (-not (Wait-Health $Name $TimeoutSec)) {
        Write-Tail $Name
        # 清理刚起的失败进程，避免留残留
        if (Test-IsOurService $Name $proc.Id) { & taskkill.exe /PID $proc.Id /T /F *> $null }
        Remove-PidInfo $Name
        throw "$Name 启动失败：${TimeoutSec}s 内健康检查未通过（见 .tmp-services/$Name.*.log）"
    }

    if ($Name -eq 'api') {
        if ($NormalizedVars.Count -gt 0) {
            # 防静默失败：确认 --var 真的进了启动命令行；没进就当场结束并报错。
            $cmd = Get-CmdLine $proc.Id
            $missing = @()
            foreach ($kv in $NormalizedVars) {
                if (-not $cmd -or $cmd -notmatch [regex]::Escape('--var') -or $cmd -notmatch [regex]::Escape($kv.Key)) {
                    $missing += $kv.Key
                }
            }
            if ($missing.Count -gt 0) {
                if (Test-IsOurService $Name $proc.Id) { & taskkill.exe /PID $proc.Id /T /F *> $null }
                Remove-PidInfo $Name
                throw "api 已启动，但以下 --var 未出现在启动命令行：$($missing -join ', ')（可能未生效）"
            }
            Write-ApiVarKeys
            Write-Log "api vars：$($NormalizedVars.Key -join ', ')（--var 已传入，值不回显）"
        } else {
            Write-ApiVarKeys
        }
    }

    Write-Log "$Name OK：pid=$($proc.Id) port=$port health=OK（$(Get-Date -Format 'HH:mm:ss')）"
}

function Stop-One([string]$Name) {
    $def = $ServiceDefs[$Name]
    $port = [int]$def.Port
    if ($Name -eq 'api' -and (Test-Path $ApiVarsFile)) { Remove-Item $ApiVarsFile -Force -ErrorAction SilentlyContinue }
    $info = Read-PidInfo $Name

    if (-not $info) {
        $ownerPid = Get-PortOwner $port
        if ($ownerPid) {
            Write-Log "$Name 无 PID 记录，但端口 $port 被 PID $ownerPid 占用（$(Get-CmdLine $ownerPid)），不自动结束"
            return 'unknown'
        }
        Write-Log "$Name 已停止（无 PID 记录、端口空闲）"
        return 'stopped'
    }

    $procId = [int]$info.pid
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if (-not $proc) {
        Remove-PidInfo $Name
        $ownerPid = Get-PortOwner $port
        if ($ownerPid) {
            Write-Log "$Name PID $procId 已不存在，但端口 $port 被 PID $ownerPid 占用，不自动结束"
            return 'unknown'
        }
        Write-Log "$Name 陈旧 PID 已清理（进程已不存在、端口空闲）"
        return 'stopped'
    }

    if (-not (Test-IsOurService $Name $procId)) {
        Write-Log "$Name PID $procId 命令行不匹配本项目服务，拒绝结束；请人工确认：$(Get-CmdLine $procId)"
        return 'refused'
    }

    Write-Log "结束 $Name（pid=$procId，含子进程 workerd/esbuild）..."
    & taskkill.exe /PID $procId /T /F *> $null
    for ($i = 0; $i -lt 20; $i++) {
        if (-not (Get-Process -Id $procId -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 250
    }
    Remove-PidInfo $Name

    if (-not (Wait-PortFree $port 10)) {
        $ownerPid = Get-PortOwner $port
        Write-Log "$Name 端口 $port 仍被 PID $ownerPid 占用（可能为未随父进程退出的子进程），需人工确认"
        return 'unknown'
    }
    Write-Log "$Name 已停止（端口 $port 空闲）"
    return 'stopped'
}

function Read-Lease {
    if (-not (Test-Path $LeaseFile)) { return $null }
    try { return (Get-Content $LeaseFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Test-LeaseActive {
    $lease = Read-Lease
    if (-not $lease) { return $false }
    try { return ([datetime]::Parse($lease.expiresAt) -gt (Get-Date)) } catch { return $false }
}

function Write-Lease {
    $lease = [ordered]@{
        owner     = $Owner
        task      = $Task
        startedAt = (Get-Date).ToString('o')
        expiresAt = (Get-Date).AddHours(2).ToString('o')
    }
    $lease | ConvertTo-Json -Compress | Set-Content -Path $LeaseFile -Encoding UTF8
}

function Clear-Lease {
    if (Test-Path $LeaseFile) { Remove-Item $LeaseFile -Force }
}

function Get-RunningNames {
    $names = @()
    foreach ($name in @('api', 'web')) {
        if (Test-Health $name) { $names += $name }
    }
    return $names
}

function Show-Status {
    Initialize-StateDir
    $lease = Read-Lease
    if ($lease) {
        $state = if (Test-LeaseActive) { 'active' } else { 'expired' }
        Write-Log "lease: $state owner=$($lease.owner) task=$($lease.task) startedAt=$($lease.startedAt) expiresAt=$($lease.expiresAt)"
    } else {
        Write-Log 'lease: none'
    }

    $running = 0
    foreach ($name in @('api', 'web')) {
        $def = $ServiceDefs[$name]
        $port = [int]$def.Port
        $info = Read-PidInfo $name
        $portOwner = Get-PortOwner $port
        $health = Test-Health $name
        if ($health) { $running++ }
        $pidText = if ($info) { $info.pid } else { '-' }
        $portText = if ($portOwner) { "LISTEN pid=$portOwner" } else { 'free' }
        $healthText = if ($health) { 'OK' } else { 'FAIL' }
        Write-Log ("{0}: health={1} pid={2} port={3} {4}" -f $name, $healthText, $pidText, $port, $portText)
        if ($name -eq 'api') {
            $keys = Get-ApiVarKeys
            if ($keys.Count -gt 0) { Write-Log ("api vars: {0}（值不回显）" -f ($keys -join ', ')) }
        }
    }
    Write-Log "SERVICES_RUNNING=$running"
    return $running
}

function Start-Core {
    Initialize-StateDir

    if (Test-LeaseActive) {
        $lease = Read-Lease
        throw "已有实例在跑（lease owner=$($lease.owner) task=$($lease.task)），先用 status 看"
    }

    $existing = Get-RunningNames
    if ($existing.Count -gt 0) {
        throw "已有实例在跑（$($existing -join ', ')），先用 status 看"
    }

    $targets = Get-Targets
    if ($targets -contains 'api') { Ensure-LocalSchema }

    foreach ($name in $targets) { Start-One $name }
    Write-Lease
    Write-Log "start 完成：$($targets -join ', ')；owner=$Owner task=$Task"
}

function Stop-Core {
    Initialize-StateDir
    $targets = if ($Service -eq 'all') { @('web', 'api') } else { @($Service) }
    $errors = 0
    foreach ($name in $targets) {
        $result = Stop-One $name
        if ($result -eq 'unknown' -or $result -eq 'refused') { $errors++ }
    }

    $running = Get-RunningNames
    if ($running.Count -eq 0) { Clear-Lease }

    $residue = Get-Residue
    Write-Log "残留检查：node/workerd/esbuild(wrangler|vite) = $($residue.Count)"
    if ($errors -gt 0) {
        Write-Log "stop 未完全成功：$errors 项需人工确认"
        return 3
    }
    return 0
}

function Enter-Gate {
    $mutex = $null
    try {
        $mutex = [System.Threading.Mutex]::new($false, $MutexName)
    } catch {
        $script:MutexName = 'Local\Ks_DevServices_Mutex'
        $mutex = [System.Threading.Mutex]::new($false, $script:MutexName)
    }
    $acquired = $false
    try {
        $acquired = $mutex.WaitOne(0)
    } catch [System.Threading.AbandonedMutexException] {
        $acquired = $true
    }
    if (-not $acquired) {
        $mutex.Dispose()
        return $null
    }
    return $mutex
}

function Exit-Gate($Mutex) {
    if ($null -ne $Mutex) {
        try { $Mutex.ReleaseMutex() } catch { }
        $Mutex.Dispose()
    }
}

$exitCode = 0

# status 是只读操作，不抢互斥锁：否则别人正在 start/stop 时会看不到状态。
if ($Action -eq 'status') {
    Show-Status | Out-Null
    exit 0
}

$gate = Enter-Gate
if ($null -eq $gate) {
    Write-Log '已有实例在跑（互斥锁被占用），先用 status 看'
    exit 2
}

try {
    switch ($Action) {
        'start' {
            try { Start-Core } catch { Write-Log "失败：$($_.Exception.Message)"; $exitCode = 2 }
        }
        'stop' {
            $exitCode = Stop-Core
        }
        'restart' {
            $stopCode = Stop-Core
            if ($stopCode -ne 0) {
                Write-Log 'restart 中止：stop 未完全成功'
                $exitCode = $stopCode
            } else {
                try { Start-Core } catch { Write-Log "失败：$($_.Exception.Message)"; $exitCode = 2 }
            }
        }
        'status' {
            Show-Status | Out-Null
        }
    }
} finally {
    Exit-Gate $gate
}

exit $exitCode
