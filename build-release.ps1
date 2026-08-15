$ErrorActionPreference = "Continue"
taskkill /F /IM termgent.exe /T 2>$null
Start-Sleep -Milliseconds 500
$ErrorActionPreference = "Stop"
$env:PATH = "C:\Users\pk\AppData\Local\nvm\v22.22.2;$env:PATH"
npm run build
npx electron-builder --win --dir --config.directories.output="dist-package"
if (!(Test-Path "release\win-unpacked")) { New-Item -ItemType Directory -Path "release\win-unpacked" -Force }
Copy-Item "dist-package\win-unpacked\*" -Destination "release\win-unpacked" -Recurse -Force

# Sync CLI binaries to ~/.termgent/bin
$termgentBin = "$env:USERPROFILE\.termgent\bin"
if (!(Test-Path $termgentBin)) { New-Item -ItemType Directory -Path $termgentBin -Force }
Copy-Item "dist\cli\*" -Destination $termgentBin -Force
