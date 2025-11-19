# Windows One-Click Start Script for Glowtype Frontend

$envFile = "frontend\.env"
$exampleFile = "frontend\.env.example"

# 1. Check if .env exists
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env file..." -ForegroundColor Cyan
    if (Test-Path $exampleFile) {
        Copy-Item $exampleFile $envFile
    } else {
        New-Item -ItemType File -Path $envFile -Force | Out-Null
    }
}

# 2. Check if API Key is set
$currentContent = Get-Content $envFile -Raw
if ($currentContent -notmatch "VITE_GEMINI_API_KEY=AI") {
    Write-Host "Gemini API Key is missing or invalid." -ForegroundColor Yellow
    $apiKey = Read-Host "Please enter your Gemini API Key (or press Enter to skip)"
    
    if (-not [string]::IsNullOrWhiteSpace($apiKey)) {
        # Remove existing key line if present to avoid duplicates
        $lines = Get-Content $envFile
        $lines = $lines | Where-Object { $_ -notmatch "^VITE_GEMINI_API_KEY=" }
        $lines | Set-Content $envFile
        
        # Append new key
        Add-Content -Path $envFile -Value "VITE_GEMINI_API_KEY=$apiKey"
        Write-Host "API Key saved to $envFile" -ForegroundColor Green
    }
}

# 3. Start the frontend
Write-Host "Starting Glowtype Frontend..." -ForegroundColor Cyan
Set-Location frontend
npm run dev
