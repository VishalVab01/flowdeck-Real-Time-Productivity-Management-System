"""Module 4: Productivity Insights backend tests"""
import os
import time
import uuid
import datetime as dt

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_a(session):
    email = f"qa+a{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{API}/auth/register", json={
        "name": "User A", "email": email, "password": "qa12345"
    })
    assert r.status_code == 201, r.text
    return {"email": email, "token": r.json()["token"], "id": r.json()["user"]["id"]}


@pytest.fixture(scope="module")
def user_b(session):
    email = f"qa+b{uuid.uuid4().hex[:8]}@test.com"
    r = session.post(f"{API}/auth/register", json={
        "name": "User B", "email": email, "password": "qa12345"
    })
    assert r.status_code == 201, r.text
    return {"email": email, "token": r.json()["token"], "id": r.json()["user"]["id"]}


def hdrs(u):
    return {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}


# --- Auth requirement ---
def test_insights_requires_auth(session):
    r = session.get(f"{API}/insights")
    assert r.status_code == 401


def test_insights_invalid_token(session):
    r = session.get(f"{API}/insights", headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401


# --- Shape ---
def test_insights_shape_empty_user(session, user_a):
    r = session.get(f"{API}/insights", headers=hdrs(user_a))
    assert r.status_code == 200, r.text
    d = r.json()
    # Required keys
    for k in ["generatedAt", "totals", "completedToday", "completedThisWeek",
              "completionRate", "mostActiveCategory", "dailyActivity",
              "categoryDistribution", "insights"]:
        assert k in d, f"missing key {k}"
    # Totals shape
    for k in ["total", "pending", "inProgress", "completed", "overdue"]:
        assert k in d["totals"]
        assert isinstance(d["totals"][k], int)
    # dailyActivity shape: 14 entries oldest->newest with today as last
    assert isinstance(d["dailyActivity"], list)
    assert len(d["dailyActivity"]) == 14
    today_utc = dt.datetime.utcnow().strftime("%Y-%m-%d")
    assert d["dailyActivity"][-1]["date"] == today_utc
    # ascending dates
    dates = [e["date"] for e in d["dailyActivity"]]
    assert dates == sorted(dates)
    for e in d["dailyActivity"]:
        assert "date" in e and "count" in e
        assert isinstance(e["count"], int)
    # insights[] always contains today line (matches spec wording)
    assert isinstance(d["insights"], list)
    joined = " ".join(d["insights"]).lower()
    assert ("you completed" in joined) or ("haven't completed" in joined)
    # completionRate range
    assert 0 <= d["completionRate"] <= 100


# --- Functional: completedToday increments after completing a task ---
def test_completed_today_increments(session, user_a):
    # baseline
    r = session.get(f"{API}/insights", headers=hdrs(user_a))
    base = r.json()["completedToday"]
    base_completed = r.json()["totals"]["completed"]

    # create task
    r = session.post(f"{API}/tasks", json={
        "title": "TEST_complete_today", "category": "Work", "status": "Pending"
    }, headers=hdrs(user_a))
    assert r.status_code == 201, r.text
    tid = r.json()["task"]["id"]

    # complete
    r = session.put(f"{API}/tasks/{tid}", json={"status": "Completed"}, headers=hdrs(user_a))
    assert r.status_code == 200

    # poll insights
    time.sleep(0.5)
    r = session.get(f"{API}/insights", headers=hdrs(user_a))
    assert r.status_code == 200
    d = r.json()
    assert d["completedToday"] == base + 1
    assert d["totals"]["completed"] == base_completed + 1
    # last bucket of dailyActivity should reflect today's count
    assert d["dailyActivity"][-1]["count"] >= 1
    # insight string should mention completed N today
    assert any("you completed" in s.lower() for s in d["insights"])


# --- User isolation ---
def test_user_isolation(session, user_a, user_b):
    # user_b must not see user_a's tasks
    r = session.get(f"{API}/insights", headers=hdrs(user_b))
    assert r.status_code == 200
    db = r.json()
    assert db["totals"]["completed"] == 0
    assert db["completedToday"] == 0
    assert db["totals"]["total"] == 0
    assert db["categoryDistribution"] == []
    assert db["mostActiveCategory"] is None


# --- Most active category & sorted distribution ---
def test_most_active_category_and_sort(session, user_b):
    # Create 3 Work, 1 Personal, 2 Hobby
    cats = ["Work"] * 3 + ["Personal"] * 1 + ["Hobby"] * 2
    for i, c in enumerate(cats):
        r = session.post(f"{API}/tasks", json={
            "title": f"TEST_cat_{i}", "category": c, "status": "Pending"
        }, headers=hdrs(user_b))
        assert r.status_code == 201

    r = session.get(f"{API}/insights", headers=hdrs(user_b))
    assert r.status_code == 200
    d = r.json()
    assert d["mostActiveCategory"] == "Work"
    counts = [c["count"] for c in d["categoryDistribution"]]
    assert counts == sorted(counts, reverse=True)
    # totals.total should be at least 6
    assert d["totals"]["total"] >= 6
    assert d["totals"]["pending"] >= 6


# --- Completion rate ---
def test_completion_rate(session, user_b):
    # complete one task for user_b -> rate becomes ~ 1/total*100
    r = session.get(f"{API}/tasks", headers=hdrs(user_b))
    tasks = r.json()["tasks"]
    assert len(tasks) > 0
    tid = tasks[0]["id"]
    session.put(f"{API}/tasks/{tid}", json={"status": "Completed"}, headers=hdrs(user_b))

    r = session.get(f"{API}/insights", headers=hdrs(user_b))
    d = r.json()
    total = d["totals"]["total"]
    completed = d["totals"]["completed"]
    expected = round((completed / total) * 100) if total > 0 else 0
    assert d["completionRate"] == expected
    assert 0 <= d["completionRate"] <= 100
