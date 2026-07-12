# ============================================
#     AUTOTEST FRAMEWORK — Commands
# ============================================
# Run from automation-hub/python/:  make <target>

install:
	pip install -r requirements.txt
	playwright install chromium

test:
	pytest

smoke:
	pytest -m smoke

regression:
	pytest -m regression

e2e:
	pytest -m e2e

headed:
	python -c "import os, sys, subprocess; env=os.environ.copy(); env['HEADLESS']='false'; sys.exit(subprocess.run(['pytest'], env=env).returncode)"

parallel:
	pytest -n auto

report:
	allure serve reports/allure-results

clean:
	python -c "import shutil; shutil.rmtree('reports', ignore_errors=True); shutil.rmtree('.auth', ignore_errors=True)"

help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies + Playwright chromium"
	@echo "  make test          - Run all tests"
	@echo "  make smoke         - Run smoke tests"
	@echo "  make regression    - Run regression tests"
	@echo "  make e2e           - Run e2e tests"
	@echo "  make headed        - Run with browser visible"
	@echo "  make parallel      - Run tests in parallel"
	@echo "  make report        - Open Allure report"
	@echo "  make clean         - Clean all reports"
