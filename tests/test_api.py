"""API smoke via FastAPI TestClient."""

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"ok": True}


def test_personas():
    r = client.get("/api/personas")
    assert r.status_code == 200
    assert len(r.json()) == 4
    assert r.json()[0]["id"] == "CUST04957"


def test_garden_ok():
    r = client.get("/api/customers/CUST04957/garden?today=2026-09-15&save_first_pct=0.1")
    assert r.status_code == 200
    g = r.json()
    assert g["id"] == "CUST04957"
    assert g["stage"] in (1, 2, 3, 4)
    assert len(g["flowers"]) == 5
    assert g["save_first_pct"] == 0.1


def test_garden_default_save_first_zero():
    r = client.get("/api/customers/CUST04957/garden")
    assert r.json()["save_first_pct"] == 0.0


def test_garden_unknown_customer_404():
    r = client.get("/api/customers/CUST99999/garden")
    assert r.status_code == 404


def test_simulate_ok():
    r = client.post(
        "/api/customers/CUST04957/simulate",
        json={"today": "2026-09-15", "category": "Entertainment", "cut_pct": 0.2},
    )
    assert r.status_code == 200
    s = r.json()
    assert s["total"] > 0
    assert s["future"]["flower_state"] == "blooming"


def test_simulate_unknown_customer_404():
    r = client.post(
        "/api/customers/CUST99999/simulate",
        json={"today": "2026-09-15", "category": "Restaurants", "cut_pct": 0.2},
    )
    assert r.status_code == 404
