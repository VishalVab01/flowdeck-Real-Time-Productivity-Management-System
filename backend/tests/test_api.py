import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or 'https://module-builder-9.preview.emergentagent.com'
API = f"{BASE_URL}/api"

UNIQ = uuid.uuid4().hex[:8]
TEST_EMAIL = f"qa+{UNIQ}@test.com"
TEST_PASSWORD = "qa12345"
TEST_NAME = "QA User"

state = {}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Health check
def test_health(session):
    r = session.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# Auth - Register
def test_register_missing_fields(session):
    r = session.post(f"{API}/auth/register", json={"email": "x@y.com"})
    assert r.status_code == 400


def test_register_success(session):
    r = session.post(f"{API}/auth/register", json={
        "name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    assert r.status_code == 201, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str)
    assert data["user"]["email"] == TEST_EMAIL
    assert data["user"]["name"] == TEST_NAME
    assert "id" in data["user"]
    assert "passwordHash" not in data["user"]
    state["token"] = data["token"]
    state["user_id"] = data["user"]["id"]


def test_register_duplicate_email(session):
    r = session.post(f"{API}/auth/register", json={
        "name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    assert r.status_code == 409


# Auth - Login
def test_login_invalid_credentials(session):
    r = session.post(f"{API}/auth/login", json={
        "email": TEST_EMAIL, "password": "wrongpass"
    })
    assert r.status_code == 401


def test_login_success(session):
    r = session.post(f"{API}/auth/login", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == TEST_EMAIL
    state["token"] = data["token"]


# Auth - Me
def test_me_no_token(session):
    r = session.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_invalid_token(session):
    r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert r.status_code == 401


def test_me_valid_token(session):
    r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {state['token']}"})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == TEST_EMAIL


# Tasks - require auth
def test_tasks_require_auth(session):
    r = session.get(f"{API}/tasks")
    assert r.status_code == 401


def auth_headers():
    return {"Authorization": f"Bearer {state['token']}", "Content-Type": "application/json"}


def test_create_task_missing_title(session):
    r = session.post(f"{API}/tasks", json={"description": "no title"}, headers=auth_headers())
    assert r.status_code == 400


def test_create_task_invalid_status(session):
    r = session.post(f"{API}/tasks", json={"title": "x", "status": "Bad"}, headers=auth_headers())
    assert r.status_code == 400


def test_create_task_success(session):
    payload = {
        "title": "TEST_Task 1",
        "description": "desc",
        "category": "Work",
        "status": "Pending",
        "deadline": "2026-12-31T23:59:59.000Z",
    }
    r = session.post(f"{API}/tasks", json=payload, headers=auth_headers())
    assert r.status_code == 201, r.text
    t = r.json()["task"]
    assert t["title"] == payload["title"]
    assert t["status"] == "Pending"
    assert t["category"] == "Work"
    assert "id" in t
    state["task_id"] = t["id"]


def test_list_tasks_only_current_user(session):
    r = session.get(f"{API}/tasks", headers=auth_headers())
    assert r.status_code == 200
    tasks = r.json()["tasks"]
    assert any(t["id"] == state["task_id"] for t in tasks)


def test_update_task_invalid_status(session):
    r = session.put(f"{API}/tasks/{state['task_id']}", json={"status": "Bad"}, headers=auth_headers())
    assert r.status_code == 400


def test_update_task_status(session):
    r = session.put(f"{API}/tasks/{state['task_id']}", json={"status": "In Progress"}, headers=auth_headers())
    assert r.status_code == 200
    assert r.json()["task"]["status"] == "In Progress"
    # Persistence check
    g = session.get(f"{API}/tasks", headers=auth_headers())
    found = [t for t in g.json()["tasks"] if t["id"] == state["task_id"]][0]
    assert found["status"] == "In Progress"


def test_other_user_cannot_modify(session):
    # Register a second user
    other_email = f"qa+{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{API}/auth/register", json={
        "name": "Other", "email": other_email, "password": TEST_PASSWORD
    })
    assert r.status_code == 201
    other_token = r.json()["token"]
    headers = {"Authorization": f"Bearer {other_token}", "Content-Type": "application/json"}

    # Other user list shouldn't include first user's task
    g = session.get(f"{API}/tasks", headers=headers)
    assert g.status_code == 200
    assert all(t["id"] != state["task_id"] for t in g.json()["tasks"])

    # Update should 404
    u = session.put(f"{API}/tasks/{state['task_id']}", json={"status": "Completed"}, headers=headers)
    assert u.status_code == 404

    # Delete should 404
    d = session.delete(f"{API}/tasks/{state['task_id']}", headers=headers)
    assert d.status_code == 404


def test_delete_task_owner(session):
    r = session.delete(f"{API}/tasks/{state['task_id']}", headers=auth_headers())
    assert r.status_code == 200
    # Verify removed
    g = session.get(f"{API}/tasks", headers=auth_headers())
    assert all(t["id"] != state["task_id"] for t in g.json()["tasks"])
