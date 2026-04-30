import os
import pytest
import requests

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback to reading .env
    from pathlib import Path
    env = Path('/app/frontend/.env').read_text()
    for line in env.splitlines():
        if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().strip('"').rstrip('/')

API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session):
    """Login as demo user; returns JWT."""
    r = session.post(f"{API}/auth/login", json={"email": "demo@lex.in", "password": "demo1234"})
    if r.status_code != 200:
        pytest.skip(f"Demo user login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}
