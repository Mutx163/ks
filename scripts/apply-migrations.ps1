# 本地迁移运行器（只作用于 --local，永不触碰生产）
#
# 背景：SQLite 没有 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，像 0003 这种“加列”迁移
# 无法在纯 SQL 里做条件分支。本脚本按文件名顺序执行 worker/migrations/*.sql，
# 并在执行 0003 之前先 `PRAGMA table_info(users)` 判断列是否已存在，已是 no-op。
# 这样整条链（0001→0005）可以反复重放而不报错。
#
# 用法：
#   pwsh -File scripts/apply-migrations.ps1 -PersistTo .tmp-r3/d1
#   pwsh -File scripts/apply-migrations.ps1 -PersistTo .tmp-r3/d1 -Config worker/wrangler.toml
#
# 注意：脚本只使用 `wrangler d1 execute --local`，没有 --remote，不会碰到生产库。

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$PersistTo,
    [string]$Database = 'ks-leaderboard',
    [string]$Config = 'worker/wrangler.toml',
    [string]$MigrationsDir = 'worker/migrations'
)

$ErrorActionPreference = 'Stop'
$env:NODE_OPTIONS = '--dns-result-order=ipv6first'
$env:CI = 'true'

if (-not (Test-Path $MigrationsDir)) { throw "找不到迁移目录: $MigrationsDir" }
if (-not (Test-Path $Config)) { throw "找不到 wrangler 配置: $Config" }

function Invoke-D1Local {
    param([string[]]$ArgList)
    $out = & wrangler d1 execute $Database --local --persist-to $PersistTo --config $Config @ArgList 2>&1
    if ($LASTEXITCODE -ne 0) {
        $text = ($out | Out-String).Trim()
        throw "wrangler 执行失败:`n$text"
    }
    return $out
}

$files = Get-ChildItem $MigrationsDir -Filter '*.sql' | Sort-Object Name
if ($files.Count -eq 0) { throw "迁移目录为空: $MigrationsDir" }

foreach ($f in $files) {
    # 0003 这类“加列”迁移：先查 pragma，已存在就跳过
    if ($f.Name -match 'add_bookmarks') {
        $json = Invoke-D1Local -ArgList @('--json', '--command', 'PRAGMA table_info(users)')
        $parsed = ($json | Out-String) | ConvertFrom-Json
        $cols = @($parsed.results | ForEach-Object { $_.name })
        if ($cols -contains 'bookmarks') {
            Write-Host "[skip] $($f.Name)  （users.bookmarks 已存在，幂等跳过）"
            continue
        }
    }

    # 0007 是 stats 重建，重放会丢数据：先查 season_id 是否已存在
    if ($f.Name -match 'stats_season') {
        $json = Invoke-D1Local -ArgList @('--json', '--command', 'PRAGMA table_info(stats)')
        $parsed = ($json | Out-String) | ConvertFrom-Json
        $cols = @($parsed.results | ForEach-Object { $_.name })
        if ($cols -contains 'season_id') {
            Write-Host "[skip] $($f.Name)  （stats.season_id 已存在，避免重复重建丢数据）"
            continue
        }
        Write-Host '[warn] 即将重建 stats 表（DROP 旧表）。生产执行前必须已 d1 export 快照。'
    }

    Invoke-D1Local -ArgList @('--file', $f.FullName) | Out-Null
    Write-Host "[ok]   $($f.Name)"
}

# 收尾核对：users 列清单
$json = Invoke-D1Local -ArgList @('--json', '--command', 'PRAGMA table_info(users)')
$parsed = ($json | Out-String) | ConvertFrom-Json
$cols = @($parsed.results | ForEach-Object { $_.name })
Write-Host ("users 列数: {0} -> {1}" -f $cols.Count, ($cols -join ','))
if ($cols.Count -ne 10) { throw "users 列数应为 10，实际 $($cols.Count)" }
Write-Host 'MIGRATIONS_OK'
