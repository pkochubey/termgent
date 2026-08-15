$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = "node"

$nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    $nvmDirs = Get-ChildItem -Path "$env:LOCALAPPDATA\nvm" -Filter "v*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    foreach ($dir in $nvmDirs) {
        $candidate = Join-Path $dir.FullName "node.exe"
        if (Test-Path $candidate) {
            $nodeExe = $candidate
            break
        }
    }
    if ($nodeExe -eq "node") {
        $candidates = @(
            "$env:ProgramFiles\nodejs\node.exe",
            "$env:ProgramFiles(x86)\nodejs\node.exe",
            "$env:LOCALAPPDATA\Programs\node\node.exe",
            "$env:USERPROFILE\AppData\Local\nvm\v22.22.2\node.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) {
                $nodeExe = $c
                break
            }
        }
    }
}

& $nodeExe "$scriptDir\termgent.js" @args
