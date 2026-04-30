"""Tests for NEW LexManager endpoints: AI drafting, drafts CRUD, documents CRUD."""
import uuid
import pytest


# Tiny 1x1 PNG in base64 data URL form (keep test small/fast)
TINY_PNG_B64 = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


@pytest.fixture(scope="module")
def demo_matter_id(api_url, session, demo_headers):
    r = session.get(f"{api_url}/matters", headers=demo_headers)
    assert r.status_code == 200, r.text
    matters = r.json()
    assert len(matters) > 0, "No demo matters available"
    return matters[0]["id"]


@pytest.fixture(scope="module")
def second_user_headers(api_url, session):
    """Register a second isolated user to verify multi-tenancy."""
    unique = f"TEST_tenant_{uuid.uuid4().hex[:6]}@lex.in"
    r = session.post(f"{api_url}/auth/register", json={
        "name": "TEST_Tenant", "email": unique, "password": "pass1234"
    })
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============ AI Endpoints ============
class TestAIEndpoints:
    def test_draft_from_facts_requires_auth(self, api_url, session):
        r = session.post(f"{api_url}/ai/draft-from-facts", json={
            "document_type": "legal_notice", "facts": "Test"
        })
        assert r.status_code == 401

    def test_strengthen_requires_auth(self, api_url, session):
        r = session.post(f"{api_url}/ai/strengthen", json={"text": "hi", "mode": "strengthen"})
        assert r.status_code == 401

    def test_draft_from_facts_legal_notice(self, api_url, session, demo_headers):
        payload = {
            "document_type": "legal_notice",
            "facts": "Client Rajesh Kumar paid Rs. 2,00,000 advance to opposite party Bharat Traders on 15 Jan 2025 for supply of steel rods. Opposite party failed to deliver and has not refunded despite multiple reminders.",
            "court_name": "Saket District Court, Delhi",
            "client_name": "Rajesh Kumar",
            "opposing_party": "Bharat Traders"
        }
        r = session.post(f"{api_url}/ai/draft-from-facts", json=payload,
                         headers=demo_headers, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
        data = r.json()
        assert "content" in data
        assert "document_type" in data
        assert data["document_type"] == "legal_notice"
        content = data["content"]
        assert isinstance(content, str)
        assert len(content) > 200, "Draft content is too short"
        # Loose check for formal Indian legal English — at least one of these should appear
        markers = ["legal notice", "hon'ble", "notice", "client", "rajesh", "bharat traders"]
        assert any(m in content.lower() for m in markers), \
            f"Content lacks legal notice markers: {content[:300]}"

    def test_strengthen_mode(self, api_url, session, demo_headers):
        payload = {
            "text": "My client gave money to the other guy but he didn't give back.",
            "mode": "strengthen"
        }
        r = session.post(f"{api_url}/ai/strengthen", json=payload,
                         headers=demo_headers, timeout=40)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
        data = r.json()
        assert "content" in data
        assert isinstance(data["content"], str)
        assert len(data["content"]) > 20


# ============ Drafts CRUD ============
class TestDrafts:
    created_draft_id = None

    def test_list_drafts_requires_auth(self, api_url, session):
        assert session.get(f"{api_url}/drafts").status_code == 401

    def test_create_draft_requires_auth(self, api_url, session):
        r = session.post(f"{api_url}/drafts", json={
            "matter_id": "x", "title": "t", "document_type": "other", "content": "c"
        })
        assert r.status_code == 401

    def test_create_draft(self, api_url, session, demo_headers, demo_matter_id):
        payload = {
            "matter_id": demo_matter_id,
            "title": "TEST_Draft_LegalNotice",
            "document_type": "legal_notice",
            "content": "IN THE HON'BLE COURT... (test content)",
            "status": "draft"
        }
        r = session.post(f"{api_url}/drafts", json=payload, headers=demo_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert d["version"] == 1
        assert d["matter_id"] == demo_matter_id
        assert d["title"] == "TEST_Draft_LegalNotice"
        assert d["document_type"] == "legal_notice"
        assert "_id" not in d
        TestDrafts.created_draft_id = d["id"]

    def test_list_drafts_filtered_by_matter(self, api_url, session, demo_headers, demo_matter_id):
        assert TestDrafts.created_draft_id, "Create test must run first"
        r = session.get(f"{api_url}/drafts?matter_id={demo_matter_id}", headers=demo_headers)
        assert r.status_code == 200
        drafts = r.json()
        assert isinstance(drafts, list)
        ids = [d["id"] for d in drafts]
        assert TestDrafts.created_draft_id in ids
        # Enrichment check
        for d in drafts:
            assert "matter_title" in d
            assert "_id" not in d

    def test_get_draft_detail(self, api_url, session, demo_headers):
        assert TestDrafts.created_draft_id
        r = session.get(f"{api_url}/drafts/{TestDrafts.created_draft_id}", headers=demo_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == TestDrafts.created_draft_id
        assert "matter" in d and d["matter"] is not None
        assert "_id" not in d

    def test_update_draft_increments_version(self, api_url, session, demo_headers, demo_matter_id):
        assert TestDrafts.created_draft_id
        payload = {
            "matter_id": demo_matter_id,
            "title": "TEST_Draft_LegalNotice_v2",
            "document_type": "legal_notice",
            "content": "Updated content v2",
            "status": "final"
        }
        r = session.put(f"{api_url}/drafts/{TestDrafts.created_draft_id}",
                        json=payload, headers=demo_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["version"] == 2
        assert d["title"] == "TEST_Draft_LegalNotice_v2"
        assert d["status"] == "final"
        # Persistence check
        r2 = session.get(f"{api_url}/drafts/{TestDrafts.created_draft_id}", headers=demo_headers)
        assert r2.json()["version"] == 2

    def test_get_unknown_draft_404(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/drafts/does-not-exist", headers=demo_headers)
        assert r.status_code == 404

    def test_update_unknown_draft_404(self, api_url, session, demo_headers, demo_matter_id):
        r = session.put(f"{api_url}/drafts/does-not-exist", json={
            "matter_id": demo_matter_id, "title": "x", "document_type": "other",
            "content": "c", "status": "draft"
        }, headers=demo_headers)
        assert r.status_code == 404

    def test_multitenancy_drafts(self, api_url, session, demo_headers,
                                  second_user_headers, demo_matter_id):
        assert TestDrafts.created_draft_id
        # Second user should NOT see demo's draft
        r = session.get(f"{api_url}/drafts", headers=second_user_headers)
        assert r.status_code == 200
        assert TestDrafts.created_draft_id not in [d["id"] for d in r.json()]
        # Second user should NOT fetch demo's draft directly
        r = session.get(f"{api_url}/drafts/{TestDrafts.created_draft_id}",
                        headers=second_user_headers)
        assert r.status_code == 404
        # Second user should NOT update it
        r = session.put(f"{api_url}/drafts/{TestDrafts.created_draft_id}", json={
            "matter_id": demo_matter_id, "title": "hack", "document_type": "other",
            "content": "x", "status": "draft"
        }, headers=second_user_headers)
        assert r.status_code == 404

    def test_delete_draft(self, api_url, session, demo_headers):
        assert TestDrafts.created_draft_id
        r = session.delete(f"{api_url}/drafts/{TestDrafts.created_draft_id}",
                           headers=demo_headers)
        assert r.status_code == 200
        # Verify gone
        r = session.get(f"{api_url}/drafts/{TestDrafts.created_draft_id}",
                        headers=demo_headers)
        assert r.status_code == 404


# ============ Documents CRUD ============
class TestDocuments:
    created_doc_id = None

    def test_list_documents_requires_auth(self, api_url, session):
        assert session.get(f"{api_url}/documents").status_code == 401

    def test_upload_document_requires_auth(self, api_url, session):
        r = session.post(f"{api_url}/documents", json={
            "matter_id": "x", "name": "a.png", "file_type": "image",
            "file_size": 100, "base64": TINY_PNG_B64
        })
        assert r.status_code == 401

    def test_upload_document(self, api_url, session, demo_headers, demo_matter_id):
        payload = {
            "matter_id": demo_matter_id,
            "name": "TEST_tinypixel.png",
            "file_type": "image",
            "mime_type": "image/png",
            "file_size": 95,
            "base64": TINY_PNG_B64,
            "category": "evidence"
        }
        r = session.post(f"{api_url}/documents", json=payload, headers=demo_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert d["name"] == "TEST_tinypixel.png"
        assert d["category"] == "evidence"
        # CRITICAL: response must NOT include base64
        assert "base64" not in d
        assert "_id" not in d
        TestDocuments.created_doc_id = d["id"]

    def test_list_documents_excludes_base64(self, api_url, session, demo_headers, demo_matter_id):
        assert TestDocuments.created_doc_id
        r = session.get(f"{api_url}/documents?matter_id={demo_matter_id}", headers=demo_headers)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        ids = [d["id"] for d in docs]
        assert TestDocuments.created_doc_id in ids
        for d in docs:
            assert "base64" not in d, "List endpoint must NOT return base64 field"
            assert "_id" not in d

    def test_get_document_includes_base64(self, api_url, session, demo_headers):
        assert TestDocuments.created_doc_id
        r = session.get(f"{api_url}/documents/{TestDocuments.created_doc_id}",
                        headers=demo_headers)
        assert r.status_code == 200
        d = r.json()
        assert "base64" in d, "Detail endpoint must return base64 field"
        assert d["base64"].startswith("data:image/png;base64,")
        assert "_id" not in d

    def test_get_unknown_document_404(self, api_url, session, demo_headers):
        r = session.get(f"{api_url}/documents/does-not-exist", headers=demo_headers)
        assert r.status_code == 404

    def test_upload_large_document_returns_413(self, api_url, session, demo_headers, demo_matter_id):
        # MAX_DOC_SIZE = 10MB; threshold in code is len(base64) > 10MB * 1.4 = 14MB
        # Build a string > 14MB (characters)
        big_chunk = "A" * (15 * 1024 * 1024)  # 15MB of chars
        payload = {
            "matter_id": demo_matter_id,
            "name": "TEST_big.bin",
            "file_type": "other",
            "mime_type": "application/octet-stream",
            "file_size": len(big_chunk),
            "base64": f"data:application/octet-stream;base64,{big_chunk}",
            "category": "other"
        }
        r = session.post(f"{api_url}/documents", json=payload, headers=demo_headers, timeout=60)
        assert r.status_code == 413, f"Expected 413, got {r.status_code}: {r.text[:200]}"

    def test_multitenancy_documents(self, api_url, session, demo_headers,
                                     second_user_headers, demo_matter_id):
        assert TestDocuments.created_doc_id
        # Second user cannot list demo's doc
        r = session.get(f"{api_url}/documents", headers=second_user_headers)
        assert r.status_code == 200
        assert TestDocuments.created_doc_id not in [d["id"] for d in r.json()]
        # Second user cannot fetch demo's doc by id
        r = session.get(f"{api_url}/documents/{TestDocuments.created_doc_id}",
                        headers=second_user_headers)
        assert r.status_code == 404

    def test_delete_document(self, api_url, session, demo_headers):
        assert TestDocuments.created_doc_id
        r = session.delete(f"{api_url}/documents/{TestDocuments.created_doc_id}",
                           headers=demo_headers)
        assert r.status_code == 200
        # Verify gone
        r = session.get(f"{api_url}/documents/{TestDocuments.created_doc_id}",
                        headers=demo_headers)
        assert r.status_code == 404
