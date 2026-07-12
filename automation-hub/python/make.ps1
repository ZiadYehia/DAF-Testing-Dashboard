param (
    [string]$Target = "help"
)

# Run from automation-hub/python/ — no directory changes needed.

switch ($Target) {
    "install" {
        Write-Host "Running pip install..."
        pip install -r requirements.txt
        Write-Host "Installing playwright chromium..."
        playwright install chromium
    }
    "test" {
        Write-Host "Running all tests..."
        pytest
    }
    "smoke" {
        Write-Host "Running smoke tests..."
        pytest -m smoke
    }
    "regression" {
        Write-Host "Running regression tests..."
        pytest -m regression
    }
    "e2e" {
        Write-Host "Running e2e tests..."
        pytest -m e2e
    }
    "headed" {
        Write-Host "Running tests in headed mode..."
        $env:HEADLESS = "false"
        pytest
    }
    "parallel" {
        Write-Host "Running tests in parallel..."
        pytest -n auto
    }
    "report" {
        Write-Host "Serving allure report..."
        allure serve reports/allure-results
    }
    "clean" {
        Write-Host "Cleaning reports directories..."
        foreach ($dir in @("reports", ".auth")) {
            if (Test-Path $dir) {
                Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    "help" {
        Write-Host "Available targets:"
        Write-Host "  .\make.ps1 install       - Install dependencies + Playwright chromium"
        Write-Host "  .\make.ps1 test          - Run all tests"
        Write-Host "  .\make.ps1 smoke         - Run smoke tests"
        Write-Host "  .\make.ps1 regression    - Run regression tests"
        Write-Host "  .\make.ps1 e2e           - Run e2e tests"
        Write-Host "  .\make.ps1 headed        - Run with browser visible"
        Write-Host "  .\make.ps1 parallel      - Run tests in parallel"
        Write-Host "  .\make.ps1 report        - Open Allure report"
        Write-Host "  .\make.ps1 clean         - Clean all reports"
    }
    default {
        Write-Host "Unknown target '$Target'." -ForegroundColor Red
        Write-Host "Run '.\make.ps1 help' to see available targets."
    }
}
