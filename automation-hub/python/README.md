# Python / Playwright Test Framework

Vendored, app-agnostic Playwright + pytest + Allure framework. Generated tests
from the Automation Hub UI land under `tests/<app>/`; shared page objects
live under `pages/<app>/`. This directory (`autotest_framework/`) is the
generic core — it has no knowledge of any specific app.

## Layout

```
python/
├── autotest_framework/   # vendored core (config, fixtures, base page, logger) — app-agnostic
├── pages/<app>/           # shared Playwright page objects, one folder per app
├── tests/<app>/           # generated tests + that app's conftest.py (do_login override)
├── conftest.py            # registers autotest_framework fixtures + auto-screenshot hook
├── pytest.ini
├── requirements.txt
└── .env.example
```

## Bootstrap

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
pytest --collect-only
pytest tests/myapp -m regression
```

(On macOS/Linux: `source .venv/bin/activate` instead of the `Activate.ps1` step.)

## Environment selection

Set `ENVIRONMENT` to the name of a JSON file in
`autotest_framework/config/environments/` (e.g. `qa_app` →
`environments/qa_app.json`). Defaults to `qa_app` if unset.

```powershell
$env:ENVIRONMENT = "qa_app"
pytest
```

Each environment JSON can point at OS env vars for its base URL and
credentials via `base_url_env` / `username_env` / `password_env` — this is
how per-app secrets stay out of the framework and out of source control.

## Credentials & configuration

Config is loaded in this order (first value found wins):

1. `automation-hub/python/.env` (this directory — framework-local overrides)
2. `automation-hub/.env` (the hub's own env — `MYAPP_LOGIN_USER`,
   `MYAPP_LOGIN_PASSWORD`, `MYAPP_BASE_URL`, etc.)

Copy `.env.example` to `.env` in this directory only if you need to override
something locally; otherwise credentials and URLs are inherited from
`automation-hub/.env` automatically.

## Writing app tests

Each app under `tests/<app>/` needs its own `conftest.py` that overrides the
`do_login` fixture (the base framework's `do_login` raises
`NotImplementedError` by design — it has no app-specific login flow):

```python
# tests/myapp/conftest.py
import pytest
from autotest_framework.config import config

@pytest.fixture
def do_login():
    def _do_login(page):
        page.goto(config.base_url + "/login")
        page.fill("#username", config.username)
        page.fill("#password", config.password)
        page.click("#submit")
        page.wait_for_url("**/dashboard**")
    return _do_login
```

Page objects for that app go in `pages/<app>/` and subclass
`autotest_framework.src.pages.base_page.BasePage`.

## Reports

Allure results are written to `reports/allure-results/`; screenshots,
videos, traces, and logs are under `reports/` as well (all gitignored).

```powershell
.\make.ps1 report      # allure serve reports/allure-results
```
