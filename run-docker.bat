@echo off
REM Launcher script for Windows Local Docker Testing Tool
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-docker.ps1"
