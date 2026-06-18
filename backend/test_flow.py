"""
End-to-end smoke test using FastAPI's TestClient — exercises:
1. Create session
2. Two participants join
3. Both swipe right on the same movie -> expect a match broadcast
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# 1. Create session (unanimous match required, 2 participants)
resp = client.post("/sessions", json={"match_threshold": 1.0})
assert resp.status_code == 200, resp.text
code = resp.json()["code"]
print(f"Created session: {code}")

# 2. Two people join
r1 = client.post(f"/sessions/{code}/join", json={"name": "Alice"})
r2 = client.post(f"/sessions/{code}/join", json={"name": "Bob"})
assert r1.status_code == 200, r1.text
assert r2.status_code == 200, r2.text

alice_id = r1.json()["participant_id"]
bob_id = r2.json()["participant_id"]
deck = r1.json()["deck"]
print(f"Deck has {len(deck)} movies")
print(f"Participant count after both joined: {r2.json()['participant_count']}")

movie_id = deck[0]["id"]
print(f"Both will swipe right on: {deck[0]['title']}")

# 3. Connect both over WebSocket and swipe
with client.websocket_connect(f"/ws/{code}/{alice_id}") as ws_alice:
    presence1 = ws_alice.receive_json()
    print("Alice connected, presence:", presence1["active_count"])

    with client.websocket_connect(f"/ws/{code}/{bob_id}") as ws_bob:
        presence2 = ws_alice.receive_json()  # alice sees bob join
        bob_presence = ws_bob.receive_json()
        print("Both connected, presence broadcast:", presence2["active_count"])

        # Alice swipes right
        ws_alice.send_json({"type": "swipe", "movie_id": movie_id, "direction": "right"})
        update1_alice = ws_alice.receive_json()
        update1_bob = ws_bob.receive_json()
        print("After Alice's swipe ->", update1_alice)
        assert update1_alice["type"] == "swipe_update"
        assert update1_alice["votes"] == 1

        # Bob swipes right on the same movie -> should trigger a match
        ws_bob.send_json({"type": "swipe", "movie_id": movie_id, "direction": "right"})
        match_alice = ws_alice.receive_json()
        match_bob = ws_bob.receive_json()

        print("After Bob's swipe, Alice received:", match_alice)
        assert match_alice["type"] == "match", f"Expected match, got {match_alice}"
        assert match_alice["movie"]["id"] == movie_id
        print(f"\n✅ MATCH confirmed on '{match_alice['movie']['title']}' — test passed!")
