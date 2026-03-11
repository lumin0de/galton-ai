# Mata o processo na porta 3001 e reinicia a API
$p = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($p) {
    Stop-Process -Id $p -Force
    Write-Host "Processo $p encerrado." -ForegroundColor Yellow
} else {
    Write-Host "Porta 3001 ja esta livre." -ForegroundColor Green
}

Start-Sleep -Seconds 1
Write-Host "Iniciando API..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\api"
npm run dev
