from fastapi.testclient import TestClient

import main


def test_health_open_and_missing_key_is_401(monkeypatch):
    monkeypatch.setattr(main, "AI_KEY", "cle-de-test-32-caracteres-minimum")
    client = TestClient(main.app)
    health = client.get("/health")
    assert health.status_code == 200
    denied = client.get("/anomalies/status")
    assert denied.status_code == 401


def test_heavy_semaphore_returns_429(monkeypatch):
    monkeypatch.setattr(main, "AI_KEY", "")
    held = 0
    while main._HEAVY.acquire(blocking=False):
        held += 1
    try:
        client = TestClient(main.app)
        res = client.post("/anomalies", json={"mouvements": []})
        assert res.status_code == 429
    finally:
        for _ in range(held):
            main._HEAVY.release()
