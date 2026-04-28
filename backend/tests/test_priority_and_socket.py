"""Module 2 (Priority Engine) + Module 3 (Socket.io) tests.

Run after test_api.py (Module 1). Uses REACT_APP_BACKEND_URL.
"""
import os
import time
import uuid
import asyncio
import threading
import pytest
import requests
import socketio  # python-socketio

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"
PASSWORD = "qa12345"


# ---------------------------- helpers ----------------------------
def _register():
    email = f"qa+{uuid.uuid4().hex[:8]}@test.com"
    r = requests.post(f"{API}/auth/register", json={
        "name": "QA Prio", "email": email, "password": PASSWORD
    }, timeout=15)
    assert r.status_code == 201, r.text
    return r.json()["token"], r.json()["user"]["id"], email


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _create_task(token, **kw):
    r = requests.post(f"{API}/tasks", json=kw, headers=_h(token), timeout=15)
    assert r.status_code == 201, r.text
    return r.json()["task"]


def _iso(dt_seconds_from_now):
    from datetime import datetime, timezone, timedelta
    return (datetime.now(timezone.utc) + timedelta(seconds=dt_seconds_from_now)).isoformat()


# ---------------------------- fixtures ----------------------------
@pytest.fixture(scope="module")
def user_a():
    token, uid, email = _register()
    return {"token": token, "id": uid, "email": email}


@pytest.fixture(scope="module")
def user_b():
    token, uid, email = _register()
    return {"token": token, "id": uid, "email": email}


# ============================ Module 2 ============================
# Priority decoration on POST/PUT and ordering on GET

def test_post_returns_priority_fields(user_a):
    t = _create_task(user_a["token"], title="TEST_prio_post", deadline=_iso(3600))
    assert "priorityScore" in t and isinstance(t["priorityScore"], int)
    assert t["priorityLevel"] in ["Overdue", "High", "Medium", "Low", "Done"]


def test_put_returns_priority_fields(user_a):
    t = _create_task(user_a["token"], title="TEST_prio_put", deadline=_iso(3600))
    r = requests.put(f"{API}/tasks/{t['id']}", json={"status": "In Progress"},
                     headers=_h(user_a["token"]), timeout=15)
    assert r.status_code == 200
    body = r.json()["task"]
    assert "priorityScore" in body and "priorityLevel" in body


def test_priority_ordering_and_levels(user_b):
    """Create overdue, high(1h), low(5d), no-deadline, completed and verify order + levels."""
    tok = user_b["token"]
    overdue = _create_task(tok, title="TEST_overdue", deadline=_iso(-3600))   # 1h ago
    high = _create_task(tok, title="TEST_high", deadline=_iso(3600))          # 1h future
    low = _create_task(tok, title="TEST_low", deadline=_iso(5 * 86400))       # 5d future
    nodl = _create_task(tok, title="TEST_nodl")
    done = _create_task(tok, title="TEST_done", deadline=_iso(3600))
    requests.put(f"{API}/tasks/{done['id']}", json={"status": "Completed"},
                 headers=_h(tok), timeout=15)

    r = requests.get(f"{API}/tasks", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    tasks = r.json()["tasks"]
    by_id = {t["id"]: t for t in tasks}

    # Levels
    assert by_id[overdue["id"]]["priorityLevel"] == "Overdue"
    assert by_id[high["id"]]["priorityLevel"] == "High"
    assert by_id[low["id"]]["priorityLevel"] == "Low"
    assert by_id[nodl["id"]]["priorityLevel"] == "Low"
    assert by_id[done["id"]]["priorityLevel"] == "Done"

    # Score boundaries
    assert by_id[overdue["id"]]["priorityScore"] >= 1000
    assert by_id[high["id"]]["priorityScore"] <= 999
    assert by_id[done["id"]]["priorityScore"] == -1
    assert by_id[nodl["id"]]["priorityScore"] == 0

    # Overall ordering — find positions in returned list (only TEST_ ones we made)
    ours = [t for t in tasks if t["id"] in by_id]
    pos = {t["id"]: i for i, t in enumerate(ours)}
    assert pos[overdue["id"]] < pos[high["id"]] < pos[low["id"]] < pos[nodl["id"]] < pos[done["id"]]


def test_overdue_always_outranks_approaching(user_a):
    """An overdue task (even by a minute) must outrank the most-urgent approaching task."""
    tok = user_a["token"]
    overdue = _create_task(tok, title="TEST_overdue_min", deadline=_iso(-60))
    very_soon = _create_task(tok, title="TEST_very_soon", deadline=_iso(60))
    r = requests.get(f"{API}/tasks", headers=_h(tok), timeout=15)
    tasks = r.json()["tasks"]
    o = next(t for t in tasks if t["id"] == overdue["id"])
    s = next(t for t in tasks if t["id"] == very_soon["id"])
    assert o["priorityScore"] >= 1000
    assert s["priorityScore"] <= 999
    assert o["priorityScore"] > s["priorityScore"]


def test_tiebreaker_earlier_created_first(user_a):
    """Two no-deadline tasks (both score=0) — earlier createdAt must appear first."""
    tok = user_a["token"]
    first = _create_task(tok, title="TEST_tie_first")
    time.sleep(1.1)
    second = _create_task(tok, title="TEST_tie_second")
    r = requests.get(f"{API}/tasks", headers=_h(tok), timeout=15)
    tasks = r.json()["tasks"]
    ids_in_order = [t["id"] for t in tasks if t["id"] in (first["id"], second["id"])]
    assert ids_in_order == [first["id"], second["id"]]


# ============================ Module 3 ============================
# Socket.io reachability + JWT auth + per-user room scoping

SOCKET_PATH = "/api/socket.io/"


def _connect_blocking(token, timeout=10):
    """Returns (sio, connected_event) — caller must sio.disconnect() in finally."""
    sio = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
    connected = threading.Event()
    error = {"v": None}

    @sio.event
    def connect():
        connected.set()

    @sio.event
    def connect_error(data):
        error["v"] = data
        connected.set()  # unblock to inspect

    try:
        sio.connect(BASE_URL, socketio_path=SOCKET_PATH,
                    auth={"token": token} if token else {},
                    transports=["websocket"], wait=True, wait_timeout=timeout)
    except Exception as e:
        error["v"] = str(e)
    return sio, connected, error


def test_socket_rejects_without_token():
    sio = socketio.Client(reconnection=False)
    failed = {"v": False}
    try:
        sio.connect(BASE_URL, socketio_path=SOCKET_PATH, auth={},
                    transports=["websocket"], wait=True, wait_timeout=8)
    except Exception:
        failed["v"] = True
    assert failed["v"] or not sio.connected, "Socket connected without token (should reject)"
    if sio.connected:
        sio.disconnect()


def test_socket_accepts_valid_token(user_a):
    sio, connected, error = _connect_blocking(user_a["token"])
    try:
        assert sio.connected, f"Socket failed to connect with valid token: {error['v']}"
    finally:
        if sio.connected:
            sio.disconnect()


def test_socket_emits_task_created_to_owner(user_a):
    sio = socketio.Client(reconnection=False)
    received = []
    sio.on("task:created", lambda data: received.append(data))
    sio.connect(BASE_URL, socketio_path=SOCKET_PATH,
                auth={"token": user_a["token"]},
                transports=["websocket"], wait=True, wait_timeout=10)
    try:
        time.sleep(0.5)  # ensure room joined
        t = _create_task(user_a["token"], title="TEST_sock_create",
                         deadline=_iso(3600))
        # Wait up to 2s
        for _ in range(20):
            if any(r.get("id") == t["id"] for r in received):
                break
            time.sleep(0.1)
        assert any(r.get("id") == t["id"] for r in received), \
            f"Did not receive task:created within 2s. Got: {received}"
        # Decorated payload
        match = next(r for r in received if r.get("id") == t["id"])
        assert "priorityScore" in match and "priorityLevel" in match
    finally:
        sio.disconnect()


def test_socket_emits_updated_and_deleted(user_a):
    sio = socketio.Client(reconnection=False)
    updates, deletes = [], []
    sio.on("task:updated", lambda d: updates.append(d))
    sio.on("task:deleted", lambda d: deletes.append(d))
    sio.connect(BASE_URL, socketio_path=SOCKET_PATH,
                auth={"token": user_a["token"]},
                transports=["websocket"], wait=True, wait_timeout=10)
    try:
        time.sleep(0.3)
        t = _create_task(user_a["token"], title="TEST_sock_upd",
                         deadline=_iso(3600))
        # Update
        requests.put(f"{API}/tasks/{t['id']}", json={"status": "In Progress"},
                     headers=_h(user_a["token"]), timeout=15)
        for _ in range(20):
            if any(u.get("id") == t["id"] for u in updates): break
            time.sleep(0.1)
        assert any(u.get("id") == t["id"] for u in updates), \
            f"No task:updated received. Got: {updates}"

        # Delete
        requests.delete(f"{API}/tasks/{t['id']}", headers=_h(user_a["token"]),
                        timeout=15)
        for _ in range(20):
            if any(d.get("id") == t["id"] for d in deletes): break
            time.sleep(0.1)
        assert any(d.get("id") == t["id"] for d in deletes), \
            f"No task:deleted received. Got: {deletes}"
    finally:
        sio.disconnect()


def test_socket_per_user_isolation(user_a, user_b):
    """User A's task creation must NOT emit to user B."""
    sio_b = socketio.Client(reconnection=False)
    received_b = []
    sio_b.on("task:created", lambda d: received_b.append(d))
    sio_b.connect(BASE_URL, socketio_path=SOCKET_PATH,
                  auth={"token": user_b["token"]},
                  transports=["websocket"], wait=True, wait_timeout=10)
    try:
        time.sleep(0.3)
        t = _create_task(user_a["token"], title="TEST_iso", deadline=_iso(3600))
        time.sleep(1.5)
        leaked = [r for r in received_b if r.get("id") == t["id"]]
        assert not leaked, f"User B leaked event from user A: {leaked}"
    finally:
        sio_b.disconnect()
