"""Comprehensive backend tests for LexManager API."""
import time
import uuid
import pytest
import requests
from datetime import date, timedelta


# ============ Auth ============
class TestAuth:
    def test_root(self, api_url, session):
        r = session.get(f"{api_url}/")
        assert r.status_code == 200
        assert "LexManager" in r.json().get("message", "")

    def test_register_new_user(self, api_url, session):
        unique = f"TEST_{uuid.uuid4().hex[:8]}@lex.in"
        r = session.post(f"{api_url}/auth/register", json={
            "name": "TEST_User", "email": unique, "password": "pass1234",
            "bar_council_no": "T/1234/2020", "city": "Delhi"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        u = data["user"]
        assert u["email"] == unique.lower()
        assert "id" in u
        assert "password_hash" not in u
        assert "_id" not in u

    def test_register_duplicate_email(self, api_url, session):
        r = session.post(f"{api_url}/auth/register", json={
            "name": "Demo", "email": "demo@lex.in", "password": "demo1234"
        })
        assert r.status_code == 400

    def test_login_demo_user(self, api_url, session):
        r = session.post(f"{api_url}/auth/login", json={"email": "demo@lex.in", "password": "demo1234"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == "demo@lex.in"

    def test_login_wrong_password(self, api_url, session):
        r = session.post(f"{api_url}/auth/login", json={"email": "demo@lex.in", "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self, api_url, session):
        r = session.post(f"{api_url}/auth/login", json={"email": "nouser@lex.in", "password": "pass1234"})
        assert r.status_code == 401

    def test_me_no_token(self, api_url, session):
        r = session.get(f"{api_url}/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self, api_url, session):
        r = session.get(f"{api_url}/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_me_with_token(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/auth/me", headers=demo_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "demo@lex.in"
        assert "password_hash" not in u
        assert "_id" not in u

    def test_update_me(self, api_url, session, demo_headers):
        r = session.put(f"{api_url}/auth/me", headers=demo_headers, json={
            "name": "Adv. Demo Kumar", "bar_council_no": "D/99999/2020",
            "gstin": "07ABCDE1234F1Z5", "hourly_rate": 3000.0
        })
        assert r.status_code == 200
        u = r.json()
        assert u["gstin"] == "07ABCDE1234F1Z5"
        assert u["hourly_rate"] == 3000.0
        # verify persistence via GET
        r2 = session.get(f"{api_url}/auth/me", headers=demo_headers)
        assert r2.json()["hourly_rate"] == 3000.0


# ============ Dashboard ============
class TestDashboard:
    def test_dashboard_stats_unauth(self, api_url, session):
        r = session.get(f"{api_url}/dashboard/stats")
        assert r.status_code == 401

    def test_dashboard_stats_shape(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/dashboard/stats", headers=demo_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ["active_matters", "unbilled_amount", "overdue_amount", "overdue_count",
                    "hearings_this_week", "todays_hearings", "upcoming_deadlines", "outstanding_invoices"]:
            assert key in d, f"Missing {key}"
        assert isinstance(d["todays_hearings"], list)
        assert isinstance(d["upcoming_deadlines"], list)
        assert isinstance(d["outstanding_invoices"], list)
        assert d["active_matters"] >= 0


# ============ Clients (incl. conflict-check ordering) ============
class TestClients:
    def test_list_clients_unauth(self, api_url, session):
        assert session.get(f"{api_url}/clients").status_code == 401

    def test_list_clients(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/clients", headers=demo_headers)
        assert r.status_code == 200
        clients = r.json()
        assert isinstance(clients, list)
        assert len(clients) >= 5  # demo seed
        for c in clients:
            assert "_id" not in c
            assert "matter_count" in c

    def test_filter_clients_status_active(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/clients?status=active", headers=demo_headers)
        assert r.status_code == 200
        for c in r.json():
            assert c["status"] == "active"

    def test_filter_clients_search(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/clients?q=Sharma", headers=demo_headers)
        assert r.status_code == 200
        results = r.json()
        # at least one match expected
        assert any("sharma" in (c.get("name") or "").lower() for c in results)

    def test_conflict_check_route_not_captured_as_id(self, api_url, session, demo_headers):
        """CRITICAL: /clients/conflict-check must not be captured by /clients/{client_id}."""
        r = session.get(f"{api_url}/clients/conflict-check?name=Sharma", headers=demo_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "conflict" in data and "matches" in data
        assert isinstance(data["matches"], list)
        assert data["conflict"] is True  # demo has Rajesh Kumar Sharma

    def test_conflict_check_no_match(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/clients/conflict-check?name=NoSuchPersonZZZ", headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["conflict"] is False
        assert r.json()["matches"] == []

    def test_create_get_update_delete_client(self, api_url, session, demo_headers):
        # CREATE
        payload = {"name": "TEST_Client_X", "phone": "9999900000", "city": "Delhi", "status": "active"}
        r = session.post(f"{api_url}/clients", json=payload, headers=demo_headers)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["name"] == "TEST_Client_X"
        assert "_id" not in r.json()

        # GET
        r = session.get(f"{api_url}/clients/{cid}", headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["id"] == cid
        assert "matters" in r.json() and isinstance(r.json()["matters"], list)

        # UPDATE
        upd = {**payload, "phone": "8888800000"}
        r = session.put(f"{api_url}/clients/{cid}", json=upd, headers=demo_headers)
        assert r.status_code == 200
        # verify
        r = session.get(f"{api_url}/clients/{cid}", headers=demo_headers)
        assert r.json()["phone"] == "8888800000"

        # DELETE
        r = session.delete(f"{api_url}/clients/{cid}", headers=demo_headers)
        assert r.status_code == 200
        # verify 404
        r = session.get(f"{api_url}/clients/{cid}", headers=demo_headers)
        assert r.status_code == 404

    def test_get_unknown_client_404(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/clients/non-existent-id", headers=demo_headers)
        assert r.status_code == 404


# ============ Matters ============
class TestMatters:
    def test_list_matters(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/matters", headers=demo_headers)
        assert r.status_code == 200
        matters = r.json()
        assert len(matters) >= 5
        # enrichment
        for m in matters:
            assert "client_name" in m
            assert "next_hearing" in m
            assert "_id" not in m

    def test_get_matter_detail(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/matters", headers=demo_headers)
        mid = r.json()[0]["id"]
        r = session.get(f"{api_url}/matters/{mid}", headers=demo_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ["client", "notes", "events", "time_entries", "invoices"]:
            assert key in d

    def test_create_matter_and_filter(self, api_url, session, demo_headers):
        clients = session.get(f"{api_url}/clients", headers=demo_headers).json()
        cid = clients[0]["id"]
        payload = {"client_id": cid, "title": "TEST_Matter_XYZ", "matter_type": "civil",
                   "fee_type": "hourly", "hourly_rate": 4000.0, "stage": "filing", "status": "active"}
        r = session.post(f"{api_url}/matters", json=payload, headers=demo_headers)
        assert r.status_code == 200
        mid = r.json()["id"]
        # filter by client_id
        r = session.get(f"{api_url}/matters?client_id={cid}", headers=demo_headers)
        assert any(m["id"] == mid for m in r.json())
        # search
        r = session.get(f"{api_url}/matters?q=TEST_Matter_XYZ", headers=demo_headers)
        assert any(m["id"] == mid for m in r.json())
        # cleanup
        session.delete(f"{api_url}/matters/{mid}", headers=demo_headers)


# ============ Events ============
class TestEvents:
    def test_list_events(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/events", headers=demo_headers)
        assert r.status_code == 200
        events = r.json()
        assert len(events) >= 5
        for e in events:
            if e.get("matter_id"):
                assert "matter_title" in e

    def test_filter_events_by_date_range(self, api_url, session, demo_headers):
        today = date.today().isoformat()
        end = (date.today() + timedelta(days=30)).isoformat()
        r = session.get(f"{api_url}/events?start={today}&end={end}", headers=demo_headers)
        assert r.status_code == 200
        for e in r.json():
            assert today <= e["date"] <= end

    def test_create_update_delete_event(self, api_url, session, demo_headers):
        payload = {"title": "TEST_Event", "event_type": "task",
                   "date": (date.today() + timedelta(days=2)).isoformat(),
                   "time": "10:00", "status": "scheduled"}
        r = session.post(f"{api_url}/events", json=payload, headers=demo_headers)
        assert r.status_code == 200
        eid = r.json()["id"]
        # update
        upd = {**payload, "title": "TEST_Event_Updated"}
        r = session.put(f"{api_url}/events/{eid}", json=upd, headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_Event_Updated"
        # delete
        r = session.delete(f"{api_url}/events/{eid}", headers=demo_headers)
        assert r.status_code == 200


# ============ Time Entries ============
class TestTimeEntries:
    def test_list_time_entries(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/time-entries", headers=demo_headers)
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) >= 5
        for e in entries:
            assert "matter_title" in e

    def test_unbilled_filter(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/time-entries?unbilled=true", headers=demo_headers)
        assert r.status_code == 200
        for e in r.json():
            assert e.get("invoice_id") is None
            assert e.get("is_billable") is True

    def test_create_time_entry_calc_amount(self, api_url, session, demo_headers):
        matters = session.get(f"{api_url}/matters", headers=demo_headers).json()
        mid = matters[0]["id"]
        payload = {"matter_id": mid, "activity": "research", "duration_mins": 90,
                   "date": date.today().isoformat(), "is_billable": True, "hourly_rate": 4000.0,
                   "description": "TEST_TE"}
        r = session.post(f"{api_url}/time-entries", json=payload, headers=demo_headers)
        assert r.status_code == 200
        d = r.json()
        # 90/60 * 4000 = 6000
        assert d["billed_amount"] == 6000.0
        # cleanup
        session.delete(f"{api_url}/time-entries/{d['id']}", headers=demo_headers)


# ============ Invoices ============
class TestInvoices:
    def test_list_invoices(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/invoices", headers=demo_headers)
        assert r.status_code == 200
        invs = r.json()
        assert len(invs) >= 2
        for inv in invs:
            assert "client_name" in inv
            assert "matter_title" in inv

    def test_filter_invoices_by_status(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/invoices?status=overdue", headers=demo_headers)
        assert r.status_code == 200
        for inv in r.json():
            assert inv["status"] == "overdue"

    def test_create_invoice_calculates_totals(self, api_url, session, demo_headers):
        matters = session.get(f"{api_url}/matters", headers=demo_headers).json()
        m = matters[0]
        payload = {
            "client_id": m["client_id"], "matter_id": m["id"],
            "issue_date": date.today().isoformat(),
            "due_date": (date.today() + timedelta(days=15)).isoformat(),
            "line_items": [{"description": "TEST_LI", "quantity": 2, "rate": 5000, "amount": 10000}],
            "disbursements": [{"description": "Court fee", "quantity": 1, "rate": 1000, "amount": 1000}],
            "include_gst": True, "status": "draft"
        }
        r = session.post(f"{api_url}/invoices", json=payload, headers=demo_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["subtotal"] == 11000.0
        assert d["gst_amount"] == 1980.0  # 18% of 11000
        assert d["total_amount"] == 12980.0
        assert d["invoice_number"].startswith("INV-")
        inv_id = d["id"]
        # GET detail
        r = session.get(f"{api_url}/invoices/{inv_id}", headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["client"] is not None
        assert r.json()["matter"] is not None
        # Partial payment
        r = session.post(f"{api_url}/invoices/{inv_id}/payment",
                         json={"paid_amount": 5000}, headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "partial"
        # Full payment
        r = session.post(f"{api_url}/invoices/{inv_id}/payment",
                         json={"paid_amount": 7980}, headers=demo_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "paid"
        # cleanup
        session.delete(f"{api_url}/invoices/{inv_id}", headers=demo_headers)

    def test_invoice_no_gst(self, api_url, session, demo_headers):
        matters = session.get(f"{api_url}/matters", headers=demo_headers).json()
        m = matters[0]
        payload = {
            "client_id": m["client_id"], "matter_id": m["id"],
            "issue_date": date.today().isoformat(),
            "line_items": [{"description": "X", "quantity": 1, "rate": 5000, "amount": 5000}],
            "include_gst": False
        }
        r = session.post(f"{api_url}/invoices", json=payload, headers=demo_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["gst_amount"] == 0.0
        assert d["total_amount"] == 5000.0
        session.delete(f"{api_url}/invoices/{d['id']}", headers=demo_headers)


# ============ Notes ============
class TestNotes:
    def test_create_list_delete_note(self, api_url, session, demo_headers):
        matters = session.get(f"{api_url}/matters", headers=demo_headers).json()
        mid = matters[0]["id"]
        r = session.post(f"{api_url}/notes", json={
            "matter_id": mid, "content": "TEST_Note_content", "note_type": "general"
        }, headers=demo_headers)
        assert r.status_code == 200
        nid = r.json()["id"]
        # list filtered
        r = session.get(f"{api_url}/notes?matter_id={mid}", headers=demo_headers)
        assert r.status_code == 200
        assert any(n["id"] == nid for n in r.json())
        # delete
        r = session.delete(f"{api_url}/notes/{nid}", headers=demo_headers)
        assert r.status_code == 200


# ============ Seed Idempotency ============
class TestSeed:
    def test_seed_idempotent(self, api_url, session, demo_headers):
        # demo user already has data
        r = session.post(f"{api_url}/seed-demo", headers=demo_headers)
        assert r.status_code == 200
        # If data exists, should NOT seed again
        assert r.json().get("seeded") is False


# ============ Multi-tenancy / lawyer scoping ============
class TestScoping:
    def test_users_only_see_own_data(self, api_url, session):
        # Register a fresh user
        unique = f"TEST_iso_{uuid.uuid4().hex[:6]}@lex.in"
        r = session.post(f"{api_url}/auth/register", json={
            "name": "Isolated", "email": unique, "password": "pass1234"
        })
        assert r.status_code == 200
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        # Should have NO clients
        r = session.get(f"{api_url}/clients", headers=h)
        assert r.status_code == 200
        assert r.json() == []
        # Should have no matters
        assert session.get(f"{api_url}/matters", headers=h).json() == []
        assert session.get(f"{api_url}/invoices", headers=h).json() == []
