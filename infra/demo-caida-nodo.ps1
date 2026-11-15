# Demostración para clase: prueba de carga contra el balanceador y, a mitad,
# se apaga de golpe un nodo de la API. El resultado debe salir con 0 errores.
# Uso (desde la carpeta infra, con el laboratorio arrancado):  .\demo-caida-nodo.ps1
$ErrorActionPreference = "Continue"
$env:API_URL = "http://localhost:8080"
$env:DURATION = "20"
$env:CONNECTIONS = "50"

Write-Host "Lanzando prueba de carga de 20 segundos..." -ForegroundColor Cyan
$job = Start-Job -ScriptBlock { param($dir) Set-Location $dir; $env:API_URL="http://localhost:8080"; $env:DURATION="20"; $env:CONNECTIONS="50"; node ..\loadtest\run.js } -ArgumentList (Get-Location).Path

Start-Sleep -Seconds 6
Write-Host "Apagando api-2 de golpe (docker kill)..." -ForegroundColor Yellow
docker compose kill api-2 | Out-Null

Start-Sleep -Seconds 6
Write-Host "Volviendo a arrancar api-2..." -ForegroundColor Green
docker compose start api-2 | Out-Null

Receive-Job -Job $job -Wait -AutoRemoveJob
