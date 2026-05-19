$ErrorActionPreference = "Stop"
$root = "C:\chzzk"
Set-Location "$root\bridge"

Get-Content "$root\.env" | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { return }
    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$name" -Value $value
}
$env:CHZZK_TOKEN_STORE = "$root\bridge\.chzzk-tokens.json"

& node dist/index.js
