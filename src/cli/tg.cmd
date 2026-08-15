@echo off
where node.exe >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  node "%~dp0termgent.js" %*
  goto :eof
)

for /d %%D in ("%LOCALAPPDATA%\nvm\v*") do (
  if exist "%%D\node.exe" (
    "%%D\node.exe" "%~dp0termgent.js" %*
    goto :eof
  )
)

for /d %%D in ("%APPDATA%\nvm\v*") do (
  if exist "%%D\node.exe" (
    "%%D\node.exe" "%~dp0termgent.js" %*
    goto :eof
  )
)

if exist "%USERPROFILE%\AppData\Local\nvm\v22.22.2\node.exe" (
  "%USERPROFILE%\AppData\Local\nvm\v22.22.2\node.exe" "%~dp0termgent.js" %*
  goto :eof
)

if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" "%~dp0termgent.js" %*
  goto :eof
)

node "%~dp0termgent.js" %*
