@echo off
setlocal EnableDelayedExpansion
cd /d C:\chzzk\bridge

for /f "usebackq tokens=1,* delims==" %%A in ("C:\chzzk\.env") do (
  set "line=%%A"
  if not "!line:~0,1!"=="#" (
    set "%%A=%%B"
  )
)

set CHZZK_TOKEN_STORE=C:\chzzk\bridge\.chzzk-tokens.json
node dist\index.js
