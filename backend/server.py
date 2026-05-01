from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
db_name = os.environ.get('DB_NAME', 'lexmanager')

if not mongo_url:
    raise RuntimeError("MONGO_URL environment variable is not set. Go to Vercel → Settings → Environment Variables and add it.")

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

JWT_SECRET = os.environ.get('JWT_SECRET', 'lexmanager-secret-change-me')
JWT_ALGO = 'HS256'

app = FastAPI()
api_router = APIRouter(prefix="/api")


@app.get("/api/health")
async def health():
    try:
        await client.admin.command('ping')
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    return {
        "status": "ok",
        "mongo_url_set": bool(mongo_url),
        "db_name": db_name,
        "db_status": db_status,
        "jwt_secret_set": JWT_SECRET != 'lexmanager-secret-change-me',
    }


# ============ Models ============
def now_iso():
    return datetime.now(timezone.utc).isoformat()


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    bar_council_no: Optional[str] = None
    city: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    bar_council_no: Optional[str] = None
    city: Optional[str] = None
    chamber_address: Optional[str] = None
    gstin: Optional[str] = None
    hourly_rate: Optional[float] = 2500.0


class UserUpdate(BaseModel):
    name: Optional[str] = None
    bar_council_no: Optional[str] = None
    city: Optional[str] = None
    chamber_address: Optional[str] = None
    gstin: Optional[str] = None
    hourly_rate: Optional[float] = None


class ClientIn(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    client_type: str = "individual"
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    referral_source: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None


class MatterIn(BaseModel):
    client_id: str
    title: str
    matter_type: str = "civil"
    court_name: Optional[str] = None
    court_room: Optional[str] = None
    case_number: Optional[str] = None
    opposing_party: Optional[str] = None
    opposing_counsel: Optional[str] = None
    fee_type: str = "hourly"
    hourly_rate: Optional[float] = None
    fixed_fee: Optional[float] = None
    retainer_amount: Optional[float] = None
    stage: str = "filing"
    status: str = "active"
    description: Optional[str] = None


class EventIn(BaseModel):
    matter_id: Optional[str] = None
    title: str
    event_type: str = "hearing"  # hearing | deadline | appointment | task
    date: str  # ISO date string
    time: Optional[str] = None
    court_name: Optional[str] = None
    court_room: Optional[str] = None
    description: Optional[str] = None
    status: str = "scheduled"
    outcome: Optional[str] = None


class TimeEntryIn(BaseModel):
    matter_id: str
    activity: str = "other"
    description: Optional[str] = None
    duration_mins: int
    date: str
    is_billable: bool = True
    hourly_rate: Optional[float] = None


class InvoiceLineItem(BaseModel):
    description: str
    quantity: float = 1.0
    rate: float
    amount: float


class InvoiceIn(BaseModel):
    client_id: str
    matter_id: str
    invoice_number: Optional[str] = None
    issue_date: str
    due_date: Optional[str] = None
    line_items: List[InvoiceLineItem] = []
    disbursements: List[InvoiceLineItem] = []
    include_gst: bool = False
    notes: Optional[str] = None
    status: str = "draft"


class InvoicePaymentIn(BaseModel):
    paid_amount: float
    status: Optional[str] = "paid"


class NoteIn(BaseModel):
    matter_id: str
    content: str
    note_type: str = "general"


# ============ Auth Helpers ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def strip_id(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ============ Auth Endpoints ============
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": payload.name,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "bar_council_no": payload.bar_council_no,
        "city": payload.city,
        "chamber_address": None,
        "gstin": None,
        "hourly_rate": 2500.0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(dict(user_doc))
    token = create_token(user_id)
    user_out = {k: v for k, v in user_doc.items() if k != "password_hash"}
    user_out.pop("created_at", None)
    return {"token": token, "user": user_out}


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["id"])
    user_out = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "bar_council_no": user.get("bar_council_no"),
        "city": user.get("city"),
        "chamber_address": user.get("chamber_address"),
        "gstin": user.get("gstin"),
        "hourly_rate": user.get("hourly_rate", 2500.0),
    }
    return {"token": token, "user": user_out}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    user.pop("password_hash", None)
    user.pop("created_at", None)
    return user


@api_router.put("/auth/me")
async def update_me(payload: UserUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated


# ============ Clients ============
@api_router.get("/clients/conflict-check")
async def conflict_check(name: str, user=Depends(get_current_user)):
    """Check if a proposed opposing party matches any existing client."""
    name_lower = name.lower().strip()
    if not name_lower:
        return {"conflict": False, "matches": []}
    clients = await db.clients.find({"lawyer_id": user["id"]}, {"_id": 0}).to_list(1000)
    matches = [c for c in clients if name_lower in (c.get("name") or "").lower()]
    return {"conflict": len(matches) > 0, "matches": matches[:5]}


@api_router.get("/clients")
async def list_clients(user=Depends(get_current_user), q: Optional[str] = None, status: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if status and status != "all":
        query["status"] = status
    clients = await db.clients.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    if q:
        q_lower = q.lower()
        clients = [
            c for c in clients
            if q_lower in (c.get("name") or "").lower()
            or q_lower in (c.get("phone") or "").lower()
            or q_lower in (c.get("city") or "").lower()
        ]
    # attach matter_count
    for c in clients:
        c["matter_count"] = await db.matters.count_documents({"client_id": c["id"], "lawyer_id": user["id"]})
    return clients


@api_router.post("/clients")
async def create_client(payload: ClientIn, user=Depends(get_current_user)):
    client_id = str(uuid.uuid4())
    doc = payload.dict()
    doc.update({
        "id": client_id,
        "lawyer_id": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.clients.insert_one(dict(doc))
    doc.pop("_id", None)
    doc["matter_count"] = 0
    return doc


@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user=Depends(get_current_user)):
    c = await db.clients.find_one({"id": client_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Client not found")
    c["matters"] = await db.matters.find({"client_id": client_id, "lawyer_id": user["id"]}, {"_id": 0}).to_list(100)
    return c


@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, payload: ClientIn, user=Depends(get_current_user)):
    updates = payload.dict()
    updates["updated_at"] = now_iso()
    res = await db.clients.update_one({"id": client_id, "lawyer_id": user["id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return await db.clients.find_one({"id": client_id}, {"_id": 0})


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user=Depends(get_current_user)):
    await db.clients.delete_one({"id": client_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Matters ============
@api_router.get("/matters")
async def list_matters(user=Depends(get_current_user), q: Optional[str] = None, status: Optional[str] = None, client_id: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if status and status != "all":
        query["status"] = status
    if client_id:
        query["client_id"] = client_id
    matters = await db.matters.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    if q:
        q_lower = q.lower()
        matters = [
            m for m in matters
            if q_lower in (m.get("title") or "").lower()
            or q_lower in (m.get("case_number") or "").lower()
            or q_lower in (m.get("opposing_party") or "").lower()
        ]
    # attach client name + next hearing + outstanding amount
    for m in matters:
        c = await db.clients.find_one({"id": m["client_id"]}, {"_id": 0, "name": 1})
        m["client_name"] = (c or {}).get("name")
        next_event = await db.events.find_one(
            {"matter_id": m["id"], "event_type": "hearing", "status": "scheduled"},
            {"_id": 0},
            sort=[("date", 1)]
        )
        m["next_hearing"] = next_event
    return matters


@api_router.post("/matters")
async def create_matter(payload: MatterIn, user=Depends(get_current_user)):
    matter_id = str(uuid.uuid4())
    doc = payload.dict()
    doc.update({
        "id": matter_id,
        "lawyer_id": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.matters.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/matters/{matter_id}")
async def get_matter(matter_id: str, user=Depends(get_current_user)):
    m = await db.matters.find_one({"id": matter_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Matter not found")
    c = await db.clients.find_one({"id": m["client_id"]}, {"_id": 0})
    m["client"] = c
    m["notes"] = await db.notes.find({"matter_id": matter_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    m["events"] = await db.events.find({"matter_id": matter_id}, {"_id": 0}).sort("date", 1).to_list(100)
    m["time_entries"] = await db.time_entries.find({"matter_id": matter_id}, {"_id": 0}).sort("date", -1).to_list(200)
    m["invoices"] = await db.invoices.find({"matter_id": matter_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return m


@api_router.put("/matters/{matter_id}")
async def update_matter(matter_id: str, payload: MatterIn, user=Depends(get_current_user)):
    updates = payload.dict()
    updates["updated_at"] = now_iso()
    res = await db.matters.update_one({"id": matter_id, "lawyer_id": user["id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Matter not found")
    return await db.matters.find_one({"id": matter_id}, {"_id": 0})


@api_router.delete("/matters/{matter_id}")
async def delete_matter(matter_id: str, user=Depends(get_current_user)):
    await db.matters.delete_one({"id": matter_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Events (Calendar) ============
@api_router.get("/events")
async def list_events(user=Depends(get_current_user), start: Optional[str] = None, end: Optional[str] = None, matter_id: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if matter_id:
        query["matter_id"] = matter_id
    if start or end:
        date_q = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lte"] = end
        query["date"] = date_q
    events = await db.events.find(query, {"_id": 0}).sort("date", 1).to_list(1000)
    # enrich
    for e in events:
        if e.get("matter_id"):
            m = await db.matters.find_one({"id": e["matter_id"]}, {"_id": 0, "title": 1, "client_id": 1})
            e["matter_title"] = (m or {}).get("title")
            if m and m.get("client_id"):
                c = await db.clients.find_one({"id": m["client_id"]}, {"_id": 0, "name": 1})
                e["client_name"] = (c or {}).get("name")
    return events


@api_router.post("/events")
async def create_event(payload: EventIn, user=Depends(get_current_user)):
    ev_id = str(uuid.uuid4())
    doc = payload.dict()
    doc.update({
        "id": ev_id,
        "lawyer_id": user["id"],
        "created_at": now_iso(),
    })
    await db.events.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.put("/events/{event_id}")
async def update_event(event_id: str, payload: EventIn, user=Depends(get_current_user)):
    updates = payload.dict()
    res = await db.events.update_one({"id": event_id, "lawyer_id": user["id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return await db.events.find_one({"id": event_id}, {"_id": 0})


@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user=Depends(get_current_user)):
    await db.events.delete_one({"id": event_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Time Entries ============
@api_router.get("/time-entries")
async def list_time_entries(user=Depends(get_current_user), matter_id: Optional[str] = None, unbilled: Optional[bool] = None):
    query = {"lawyer_id": user["id"]}
    if matter_id:
        query["matter_id"] = matter_id
    if unbilled:
        query["invoice_id"] = None
        query["is_billable"] = True
    entries = await db.time_entries.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    for e in entries:
        m = await db.matters.find_one({"id": e["matter_id"]}, {"_id": 0, "title": 1, "client_id": 1})
        e["matter_title"] = (m or {}).get("title")
        if m and m.get("client_id"):
            c = await db.clients.find_one({"id": m["client_id"]}, {"_id": 0, "name": 1})
            e["client_name"] = (c or {}).get("name")
    return entries


@api_router.post("/time-entries")
async def create_time_entry(payload: TimeEntryIn, user=Depends(get_current_user)):
    te_id = str(uuid.uuid4())
    rate = payload.hourly_rate
    if rate is None:
        matter = await db.matters.find_one({"id": payload.matter_id}, {"_id": 0, "hourly_rate": 1})
        rate = (matter or {}).get("hourly_rate") or user.get("hourly_rate") or 2500.0
    amount = round((payload.duration_mins / 60.0) * rate, 2) if payload.is_billable else 0.0
    doc = payload.dict()
    doc.update({
        "id": te_id,
        "lawyer_id": user["id"],
        "hourly_rate": rate,
        "billed_amount": amount,
        "invoice_id": None,
        "created_at": now_iso(),
    })
    await db.time_entries.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.delete("/time-entries/{entry_id}")
async def delete_time_entry(entry_id: str, user=Depends(get_current_user)):
    await db.time_entries.delete_one({"id": entry_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Invoices ============
async def _generate_invoice_number(lawyer_id: str) -> str:
    year = datetime.now(timezone.utc).year
    count = await db.invoices.count_documents({"lawyer_id": lawyer_id})
    return f"INV-{year}-{(count + 1):04d}"


@api_router.get("/invoices")
async def list_invoices(user=Depends(get_current_user), status: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if status and status != "all":
        query["status"] = status
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    for inv in invoices:
        c = await db.clients.find_one({"id": inv.get("client_id")}, {"_id": 0, "name": 1})
        inv["client_name"] = (c or {}).get("name")
        m = await db.matters.find_one({"id": inv.get("matter_id")}, {"_id": 0, "title": 1})
        inv["matter_title"] = (m or {}).get("title")
    return invoices


@api_router.post("/invoices")
async def create_invoice(payload: InvoiceIn, user=Depends(get_current_user)):
    inv_id = str(uuid.uuid4())
    invoice_number = payload.invoice_number or await _generate_invoice_number(user["id"])
    line_total = sum(li.amount for li in payload.line_items)
    disb_total = sum(d.amount for d in payload.disbursements)
    subtotal = round(line_total + disb_total, 2)
    gst_amount = round(subtotal * 0.18, 2) if payload.include_gst else 0.0
    total = round(subtotal + gst_amount, 2)
    doc = {
        "id": inv_id,
        "lawyer_id": user["id"],
        "client_id": payload.client_id,
        "matter_id": payload.matter_id,
        "invoice_number": invoice_number,
        "issue_date": payload.issue_date,
        "due_date": payload.due_date,
        "line_items": [li.dict() for li in payload.line_items],
        "disbursements": [d.dict() for d in payload.disbursements],
        "subtotal": subtotal,
        "include_gst": payload.include_gst,
        "gst_amount": gst_amount,
        "total_amount": total,
        "paid_amount": 0.0,
        "status": payload.status,
        "notes": payload.notes,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.invoices.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv["client"] = await db.clients.find_one({"id": inv.get("client_id")}, {"_id": 0})
    inv["matter"] = await db.matters.find_one({"id": inv.get("matter_id")}, {"_id": 0})
    return inv


@api_router.post("/invoices/{invoice_id}/payment")
async def record_payment(invoice_id: str, payload: InvoicePaymentIn, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    new_paid = (inv.get("paid_amount") or 0) + payload.paid_amount
    total = inv.get("total_amount") or 0
    status = "paid" if new_paid >= total else "partial"
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"paid_amount": new_paid, "status": status, "updated_at": now_iso()}}
    )
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user=Depends(get_current_user)):
    await db.invoices.delete_one({"id": invoice_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Notes ============
@api_router.get("/notes")
async def list_notes(user=Depends(get_current_user), matter_id: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if matter_id:
        query["matter_id"] = matter_id
    return await db.notes.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/notes")
async def create_note(payload: NoteIn, user=Depends(get_current_user)):
    note_id = str(uuid.uuid4())
    doc = payload.dict()
    doc.update({
        "id": note_id,
        "lawyer_id": user["id"],
        "created_at": now_iso(),
    })
    await db.notes.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.delete("/notes/{note_id}")
async def delete_note(note_id: str, user=Depends(get_current_user)):
    await db.notes.delete_one({"id": note_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Dashboard ============
@api_router.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    lawyer_id = user["id"]
    active_matters = await db.matters.count_documents({"lawyer_id": lawyer_id, "status": "active"})
    # unbilled amount
    unbilled = await db.time_entries.find(
        {"lawyer_id": lawyer_id, "invoice_id": None, "is_billable": True},
        {"_id": 0, "billed_amount": 1}
    ).to_list(10000)
    unbilled_amount = sum((e.get("billed_amount") or 0) for e in unbilled)
    # overdue invoices
    today = datetime.now(timezone.utc).date().isoformat()
    overdue_invoices = await db.invoices.find(
        {"lawyer_id": lawyer_id, "status": {"$in": ["sent", "partial", "overdue"]}, "due_date": {"$lt": today}},
        {"_id": 0}
    ).to_list(500)
    overdue_amount = sum((i.get("total_amount") or 0) - (i.get("paid_amount") or 0) for i in overdue_invoices)
    # hearings this week
    week_end = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    hearings_this_week = await db.events.count_documents({
        "lawyer_id": lawyer_id,
        "event_type": "hearing",
        "status": "scheduled",
        "date": {"$gte": today, "$lte": week_end}
    })

    # today's hearings
    today_str = today
    todays_hearings = await db.events.find({
        "lawyer_id": lawyer_id,
        "event_type": "hearing",
        "date": {"$gte": today_str, "$lt": (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()}
    }, {"_id": 0}).sort("time", 1).to_list(20)
    for e in todays_hearings:
        if e.get("matter_id"):
            m = await db.matters.find_one({"id": e["matter_id"]}, {"_id": 0, "title": 1, "client_id": 1})
            e["matter_title"] = (m or {}).get("title")
            if m and m.get("client_id"):
                c = await db.clients.find_one({"id": m["client_id"]}, {"_id": 0, "name": 1})
                e["client_name"] = (c or {}).get("name")

    # upcoming deadlines
    upcoming_deadlines = await db.events.find({
        "lawyer_id": lawyer_id,
        "event_type": "deadline",
        "status": "scheduled",
        "date": {"$gte": today_str}
    }, {"_id": 0}).sort("date", 1).limit(5).to_list(5)
    for e in upcoming_deadlines:
        if e.get("matter_id"):
            m = await db.matters.find_one({"id": e["matter_id"]}, {"_id": 0, "title": 1})
            e["matter_title"] = (m or {}).get("title")

    # outstanding invoices top 3
    outstanding = await db.invoices.find({
        "lawyer_id": lawyer_id,
        "status": {"$in": ["sent", "partial", "overdue", "draft"]}
    }, {"_id": 0}).sort("due_date", 1).limit(5).to_list(5)
    for inv in outstanding:
        c = await db.clients.find_one({"id": inv.get("client_id")}, {"_id": 0, "name": 1})
        inv["client_name"] = (c or {}).get("name")

    return {
        "active_matters": active_matters,
        "unbilled_amount": round(unbilled_amount, 2),
        "overdue_amount": round(overdue_amount, 2),
        "overdue_count": len(overdue_invoices),
        "hearings_this_week": hearings_this_week,
        "todays_hearings": todays_hearings,
        "upcoming_deadlines": upcoming_deadlines,
        "outstanding_invoices": outstanding,
    }


# ============ Seed (for demo) ============
@api_router.post("/seed-demo")
async def seed_demo(user=Depends(get_current_user)):
    """Seed Indian-context sample data for the logged-in user. Idempotent: only seeds if user has no clients."""
    lawyer_id = user["id"]
    existing = await db.clients.count_documents({"lawyer_id": lawyer_id})
    if existing > 0:
        return {"seeded": False, "message": "Data already exists"}

    now = datetime.now(timezone.utc)
    today = now.date()

    sample_clients = [
        {"name": "Rajesh Kumar Sharma", "phone": "9876543210", "email": "rajesh.s@example.com", "city": "New Delhi", "address": "B-42, Vasant Kunj, New Delhi", "client_type": "individual", "id_type": "aadhaar", "id_number": "1234-5678-9012", "status": "active"},
        {"name": "Priya Mehta", "phone": "9822334455", "email": "priya.m@example.com", "city": "Mumbai", "address": "Flat 704, Lokhandwala, Andheri West", "client_type": "individual", "status": "active"},
        {"name": "Agarwal Textiles Pvt Ltd", "phone": "1141234567", "email": "admin@agarwaltextiles.in", "city": "New Delhi", "address": "G-12, Karol Bagh, New Delhi", "client_type": "company", "status": "active"},
        {"name": "Vikram Singh Chauhan", "phone": "9845123789", "email": "vikram.sc@example.com", "city": "Bengaluru", "address": "No. 45, 5th Cross, Indiranagar", "client_type": "individual", "status": "active"},
        {"name": "Ananya Iyer", "phone": "9920011223", "email": "ananya.i@example.com", "city": "Chennai", "address": "23 Besant Avenue, Adyar", "client_type": "individual", "status": "prospective"},
    ]

    client_ids = []
    for cd in sample_clients:
        cid = str(uuid.uuid4())
        cd.update({
            "id": cid, "lawyer_id": lawyer_id,
            "created_at": now_iso(), "updated_at": now_iso(),
            "notes": None, "referral_source": None,
        })
        await db.clients.insert_one(dict(cd))
        client_ids.append(cid)

    sample_matters = [
        {"client_idx": 0, "title": "Sharma vs State - Property Dispute", "matter_type": "property", "court_name": "Saket District Court, Delhi", "court_room": "Court No. 12", "case_number": "CS/2024/4521", "opposing_party": "State of Delhi", "fee_type": "hourly", "hourly_rate": 3500.0, "stage": "arguments"},
        {"client_idx": 1, "title": "Mehta - Divorce Proceedings", "matter_type": "family", "court_name": "Bombay Family Court", "court_room": "Court No. 4", "case_number": "HMA/2024/892", "opposing_party": "Ashish Mehta", "fee_type": "fixed", "fixed_fee": 150000.0, "stage": "filing"},
        {"client_idx": 2, "title": "Agarwal Textiles - Contract Breach Suit", "matter_type": "civil", "court_name": "Delhi High Court", "court_room": "Court No. 8", "case_number": "CS(COMM)/2024/1201", "opposing_party": "Bharat Fabrics Ltd", "fee_type": "hourly", "hourly_rate": 5000.0, "stage": "arguments"},
        {"client_idx": 3, "title": "Chauhan - Consumer Complaint", "matter_type": "consumer", "court_name": "Bengaluru Urban Consumer Forum", "court_room": "Hall 2", "case_number": "CC/2024/567", "opposing_party": "Urban Furnitures Pvt Ltd", "fee_type": "fixed", "fixed_fee": 45000.0, "stage": "filing"},
        {"client_idx": 0, "title": "Sharma - Bail Application", "matter_type": "criminal", "court_name": "Tis Hazari Court, Delhi", "court_room": "Court No. 3", "case_number": "BA/2024/3311", "opposing_party": "State", "fee_type": "fixed", "fixed_fee": 75000.0, "stage": "filing"},
    ]

    matter_ids = []
    for md in sample_matters:
        mid = str(uuid.uuid4())
        doc = {
            "id": mid, "lawyer_id": lawyer_id,
            "client_id": client_ids[md["client_idx"]],
            "title": md["title"], "matter_type": md["matter_type"],
            "court_name": md["court_name"], "court_room": md["court_room"],
            "case_number": md["case_number"], "opposing_party": md["opposing_party"],
            "opposing_counsel": None,
            "fee_type": md["fee_type"], "hourly_rate": md.get("hourly_rate"),
            "fixed_fee": md.get("fixed_fee"), "retainer_amount": None,
            "stage": md["stage"], "status": "active", "description": None,
            "created_at": now_iso(), "updated_at": now_iso(),
        }
        await db.matters.insert_one(dict(doc))
        matter_ids.append(mid)

    # events
    sample_events = [
        {"matter_idx": 0, "title": "Hearing - Property Dispute", "event_type": "hearing", "offset_days": 0, "time": "10:30", "court_name": "Saket District Court, Delhi", "court_room": "Court No. 12"},
        {"matter_idx": 2, "title": "Hearing - Contract Breach", "event_type": "hearing", "offset_days": 2, "time": "11:00", "court_name": "Delhi High Court", "court_room": "Court No. 8"},
        {"matter_idx": 1, "title": "Mediation - Divorce", "event_type": "hearing", "offset_days": 4, "time": "14:00", "court_name": "Bombay Family Court", "court_room": "Court No. 4"},
        {"matter_idx": 3, "title": "Filing deadline - Consumer Complaint", "event_type": "deadline", "offset_days": 5, "time": None},
        {"matter_idx": 4, "title": "Bail Application Hearing", "event_type": "hearing", "offset_days": 7, "time": "10:00", "court_name": "Tis Hazari Court, Delhi", "court_room": "Court No. 3"},
        {"matter_idx": None, "title": "Client meeting - Ananya Iyer", "event_type": "appointment", "offset_days": 1, "time": "16:00"},
        {"matter_idx": 0, "title": "Submit written arguments", "event_type": "deadline", "offset_days": 3, "time": None},
    ]
    for ed in sample_events:
        eid = str(uuid.uuid4())
        ev_date = (today + timedelta(days=ed["offset_days"])).isoformat()
        doc = {
            "id": eid, "lawyer_id": lawyer_id,
            "matter_id": matter_ids[ed["matter_idx"]] if ed["matter_idx"] is not None else None,
            "title": ed["title"], "event_type": ed["event_type"],
            "date": ev_date, "time": ed.get("time"),
            "court_name": ed.get("court_name"), "court_room": ed.get("court_room"),
            "description": None, "status": "scheduled",
            "outcome": None, "created_at": now_iso(),
        }
        await db.events.insert_one(dict(doc))

    # time entries
    sample_time = [
        {"matter_idx": 0, "activity": "hearing", "duration_mins": 90, "offset_days": -3, "description": "Cross-examination of plaintiff witness"},
        {"matter_idx": 0, "activity": "drafting", "duration_mins": 120, "offset_days": -2, "description": "Drafting written arguments"},
        {"matter_idx": 2, "activity": "research", "duration_mins": 180, "offset_days": -5, "description": "Case law research on commercial contracts"},
        {"matter_idx": 2, "activity": "client_call", "duration_mins": 45, "offset_days": -1, "description": "Strategy call with client"},
        {"matter_idx": 1, "activity": "drafting", "duration_mins": 150, "offset_days": -4, "description": "Drafting petition"},
    ]
    for td in sample_time:
        tid = str(uuid.uuid4())
        matter = await db.matters.find_one({"id": matter_ids[td["matter_idx"]]}, {"_id": 0, "hourly_rate": 1})
        rate = (matter or {}).get("hourly_rate") or 2500.0
        amount = round((td["duration_mins"] / 60.0) * rate, 2)
        doc = {
            "id": tid, "lawyer_id": lawyer_id,
            "matter_id": matter_ids[td["matter_idx"]],
            "activity": td["activity"], "description": td["description"],
            "duration_mins": td["duration_mins"],
            "date": (today + timedelta(days=td["offset_days"])).isoformat(),
            "is_billable": True, "hourly_rate": rate,
            "billed_amount": amount, "invoice_id": None,
            "created_at": now_iso(),
        }
        await db.time_entries.insert_one(dict(doc))

    # invoices
    inv_id = str(uuid.uuid4())
    inv_number = await _generate_invoice_number(lawyer_id)
    line_items = [
        {"description": "Drafting of petition - 5 hours", "quantity": 5, "rate": 3500, "amount": 17500},
        {"description": "Court appearance", "quantity": 1, "rate": 5000, "amount": 5000},
    ]
    subtotal = 22500
    gst = round(subtotal * 0.18, 2)
    inv_doc = {
        "id": inv_id, "lawyer_id": lawyer_id,
        "client_id": client_ids[0], "matter_id": matter_ids[0],
        "invoice_number": inv_number,
        "issue_date": (today - timedelta(days=30)).isoformat(),
        "due_date": (today - timedelta(days=15)).isoformat(),
        "line_items": line_items, "disbursements": [],
        "subtotal": subtotal, "include_gst": True, "gst_amount": gst,
        "total_amount": subtotal + gst, "paid_amount": 0.0,
        "status": "overdue", "notes": None,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.invoices.insert_one(dict(inv_doc))

    inv_id2 = str(uuid.uuid4())
    inv_number2 = f"INV-{datetime.now(timezone.utc).year}-0002"
    line_items2 = [{"description": "Consultation and research", "quantity": 3, "rate": 5000, "amount": 15000}]
    inv_doc2 = {
        "id": inv_id2, "lawyer_id": lawyer_id,
        "client_id": client_ids[2], "matter_id": matter_ids[2],
        "invoice_number": inv_number2,
        "issue_date": (today - timedelta(days=5)).isoformat(),
        "due_date": (today + timedelta(days=10)).isoformat(),
        "line_items": line_items2, "disbursements": [],
        "subtotal": 15000, "include_gst": True, "gst_amount": 2700,
        "total_amount": 17700, "paid_amount": 0.0,
        "status": "sent", "notes": None,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    await db.invoices.insert_one(dict(inv_doc2))

    # notes
    sample_notes = [
        {"matter_idx": 0, "content": "Client informed about next date of hearing. Need to prepare cross-examination.", "note_type": "hearing"},
        {"matter_idx": 2, "content": "Opposite counsel filed reply. Need to draft rejoinder by next week.", "note_type": "general"},
        {"matter_idx": 1, "content": "Client insists on early settlement. Propose mediation.", "note_type": "instruction"},
    ]
    for nd in sample_notes:
        nid = str(uuid.uuid4())
        doc = {
            "id": nid, "lawyer_id": lawyer_id,
            "matter_id": matter_ids[nd["matter_idx"]],
            "content": nd["content"], "note_type": nd["note_type"],
            "created_at": now_iso(),
        }
        await db.notes.insert_one(dict(doc))

    return {"seeded": True, "message": "Demo data loaded"}


# ============ Health ============
@api_router.get("/")
async def root():
    return {"message": "LexManager API", "version": "1.0"}


# ============ Active Timer ============
class TimerStartIn(BaseModel):
    matter_id: str
    activity: str = "other"
    description: Optional[str] = None
    is_billable: bool = True


class TimerStopIn(BaseModel):
    description: Optional[str] = None  # allow updating note before saving


@api_router.get("/timer")
async def get_active_timer(user=Depends(get_current_user)):
    timer = await db.timers.find_one({"lawyer_id": user["id"]}, {"_id": 0})
    if not timer:
        return {"active": False}
    # enrich
    matter = await db.matters.find_one({"id": timer["matter_id"]}, {"_id": 0, "title": 1, "client_id": 1, "hourly_rate": 1})
    if matter:
        timer["matter_title"] = matter.get("title")
        timer["hourly_rate"] = matter.get("hourly_rate") or user.get("hourly_rate") or 2500.0
        client = await db.clients.find_one({"id": matter.get("client_id")}, {"_id": 0, "name": 1})
        timer["client_name"] = (client or {}).get("name")
    return {"active": True, "timer": timer}


@api_router.post("/timer/start")
async def start_timer(payload: TimerStartIn, user=Depends(get_current_user)):
    # Only one active timer per user
    existing = await db.timers.find_one({"lawyer_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="A timer is already running. Stop it first.")
    matter = await db.matters.find_one({"id": payload.matter_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")
    timer_id = str(uuid.uuid4())
    doc = {
        "id": timer_id,
        "lawyer_id": user["id"],
        "matter_id": payload.matter_id,
        "activity": payload.activity,
        "description": payload.description,
        "is_billable": payload.is_billable,
        "started_at": now_iso(),
    }
    await db.timers.insert_one(dict(doc))
    doc.pop("_id", None)
    doc["matter_title"] = matter.get("title")
    return {"active": True, "timer": doc}


@api_router.post("/timer/stop")
async def stop_timer(payload: TimerStopIn, user=Depends(get_current_user)):
    timer = await db.timers.find_one({"lawyer_id": user["id"]}, {"_id": 0})
    if not timer:
        raise HTTPException(status_code=404, detail="No active timer")

    # compute elapsed minutes
    started = datetime.fromisoformat(timer["started_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    elapsed_seconds = max(0, int((now - started).total_seconds()))
    duration_mins = max(1, round(elapsed_seconds / 60))  # at least 1 minute

    # rate
    matter = await db.matters.find_one({"id": timer["matter_id"]}, {"_id": 0, "hourly_rate": 1})
    rate = (matter or {}).get("hourly_rate") or user.get("hourly_rate") or 2500.0
    is_billable = timer.get("is_billable", True)
    billed_amount = round((duration_mins / 60.0) * rate, 2) if is_billable else 0.0

    # Create time entry
    te_id = str(uuid.uuid4())
    description = payload.description if payload.description is not None else timer.get("description")
    entry = {
        "id": te_id,
        "lawyer_id": user["id"],
        "matter_id": timer["matter_id"],
        "activity": timer.get("activity", "other"),
        "description": description,
        "duration_mins": duration_mins,
        "date": now.date().isoformat(),
        "is_billable": is_billable,
        "hourly_rate": rate,
        "billed_amount": billed_amount,
        "invoice_id": None,
        "from_timer": True,
        "created_at": now_iso(),
    }
    await db.time_entries.insert_one(dict(entry))
    await db.timers.delete_one({"id": timer["id"]})
    entry.pop("_id", None)
    return {"saved": True, "time_entry": entry, "duration_mins": duration_mins, "billed_amount": billed_amount}


@api_router.post("/timer/cancel")
async def cancel_timer(user=Depends(get_current_user)):
    res = await db.timers.delete_one({"lawyer_id": user["id"]})
    return {"cancelled": res.deleted_count > 0}


# ============ AI Drafting (DeepSeek via OpenClaw/OpenRouter) ============
from openai import AsyncOpenAI

OPENCLAW_API_KEY = os.environ.get("OPENCLAW_API_KEY")
OPENCLAW_BASE_URL = "https://openrouter.ai/api/v1"
DEEPSEEK_MODEL = "deepseek/deepseek-r1-distill-llama-70b"

LEGAL_SYSTEM_PROMPT = """You are an expert legal drafting assistant for Indian advocates practicing in district and high courts.

Rules:
- Use formal Indian legal English with appropriate terms (e.g., "Hon'ble Court", "the Plaintiff", "the Respondent", "pleased to").
- Reference Indian statutes, CPC, CrPC, IPC, Indian Evidence Act, etc. where relevant.
- Use ₹ (INR) for amounts.
- Structure documents with numbered paragraphs.
- Be concise, professional, and court-ready.
- Never fabricate case citations or judgments. If unsure, write "[citation to be verified]".
- When generating drafts, include ALL standard sections (cause title, prayer, verification, etc.) appropriate to the document type."""


class DraftFromFactsIn(BaseModel):
    document_type: str  # plaint | legal_notice | bail_application | written_statement | vakalatnama | affidavit | other
    facts: str
    matter_id: Optional[str] = None
    court_name: Optional[str] = None
    case_number: Optional[str] = None
    client_name: Optional[str] = None
    opposing_party: Optional[str] = None


class StrengthenIn(BaseModel):
    text: str
    mode: str = "strengthen"  # strengthen | simplify | formalize


DOC_TYPE_TEMPLATES = {
    "plaint": "Generate a complete PLAINT. Include: cause title, parties block, jurisdiction, facts (numbered), cause of action, relief/prayer, verification clause.",
    "legal_notice": "Generate a formal LEGAL NOTICE under Section 80 CPC (if applicable). Include: advocate's letterhead placeholder, date, addressee, subject, grounds (numbered), demand, time limit, consequences, advocate signature block.",
    "bail_application": "Generate a BAIL APPLICATION under appropriate section (Sec 437/438/439 CrPC). Include: cause title, grounds for bail (numbered), undertaking, prayer, verification.",
    "written_statement": "Generate a WRITTEN STATEMENT. Include: cause title, preliminary objections, para-wise reply to plaint allegations, counter-claim (if any), prayer, verification.",
    "vakalatnama": "Generate a standard VAKALATNAMA appointing advocate. Include cause title, appointment clause, powers, signature blocks.",
    "affidavit": "Generate a formal AFFIDAVIT. Include: deponent details, sworn statements (numbered), verification clause, signature and attestation block.",
    "other": "Generate an appropriate legal document.",
}


@api_router.post("/ai/draft-from-facts")
async def ai_draft_from_facts(payload: DraftFromFactsIn, user=Depends(get_current_user)):
    if not OPENCLAW_API_KEY:
        raise HTTPException(status_code=500, detail="AI not configured")
    template = DOC_TYPE_TEMPLATES.get(payload.document_type, DOC_TYPE_TEMPLATES["other"])
    context_parts = []
    if payload.court_name:
        context_parts.append(f"Court: {payload.court_name}")
    if payload.case_number:
        context_parts.append(f"Case No.: {payload.case_number}")
    if payload.client_name:
        context_parts.append(f"Client (on whose behalf): {payload.client_name}")
    if payload.opposing_party:
        context_parts.append(f"Opposing Party: {payload.opposing_party}")
    context_block = "\n".join(context_parts) if context_parts else "(No case details provided yet — use [PLACEHOLDER] where needed.)"

    user_text = f"""Draft a {payload.document_type.replace('_', ' ').upper()} for the following matter.

{template}

Case context:
{context_block}

Facts provided by the advocate:
{payload.facts}

Return ONLY the document content in plain text with clear paragraph structure. Use [PLACEHOLDER] for any missing specifics. Do not include any meta-commentary before or after the document."""

    try:
        client_ai = AsyncOpenAI(base_url=OPENCLAW_BASE_URL, api_key=OPENCLAW_API_KEY)
        response = await client_ai.chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=4096,
            messages=[
                {"role": "system", "content": LEGAL_SYSTEM_PROMPT},
                {"role": "user", "content": user_text},
            ],
        )
        return {"content": response.choices[0].message.content, "document_type": payload.document_type}
    except Exception as e:
        logger.exception("AI draft failed")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)[:200]}")


@api_router.post("/ai/strengthen")
async def ai_strengthen(payload: StrengthenIn, user=Depends(get_current_user)):
    if not OPENCLAW_API_KEY:
        raise HTTPException(status_code=500, detail="AI not configured")
    mode_instructions = {
        "strengthen": "Rewrite the following passage with stronger, more persuasive Indian legal English. Keep the same meaning but sharpen the language, improve precision of legal terms, and make it more court-ready. Return ONLY the rewritten text.",
        "simplify": "Rewrite the following legal passage in plain, clear English that a non-lawyer client could understand. Preserve the factual meaning but remove jargon. Return ONLY the rewritten text.",
        "formalize": "Rewrite the following passage in formal Indian legal English suitable for court filing. Return ONLY the rewritten text.",
    }
    instruction = mode_instructions.get(payload.mode, mode_instructions["strengthen"])
    try:
        client_ai = AsyncOpenAI(base_url=OPENCLAW_BASE_URL, api_key=OPENCLAW_API_KEY)
        response = await client_ai.chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=2048,
            messages=[
                {"role": "system", "content": LEGAL_SYSTEM_PROMPT},
                {"role": "user", "content": f"{instruction}\n\nPassage:\n{payload.text}"},
            ],
        )
        return {"content": response.choices[0].message.content}
    except Exception as e:
        logger.exception("AI strengthen failed")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)[:200]}")


# ============ Drafts (saved legal documents) ============
class DraftIn(BaseModel):
    matter_id: str
    title: str
    document_type: str = "other"
    content: str
    status: str = "draft"


@api_router.get("/drafts")
async def list_drafts(user=Depends(get_current_user), matter_id: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if matter_id:
        query["matter_id"] = matter_id
    drafts = await db.drafts.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    for d in drafts:
        m = await db.matters.find_one({"id": d["matter_id"]}, {"_id": 0, "title": 1})
        d["matter_title"] = (m or {}).get("title")
    return drafts


@api_router.post("/drafts")
async def create_draft(payload: DraftIn, user=Depends(get_current_user)):
    draft_id = str(uuid.uuid4())
    doc = payload.dict()
    doc.update({
        "id": draft_id,
        "lawyer_id": user["id"],
        "version": 1,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.drafts.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/drafts/{draft_id}")
async def get_draft(draft_id: str, user=Depends(get_current_user)):
    d = await db.drafts.find_one({"id": draft_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Draft not found")
    m = await db.matters.find_one({"id": d["matter_id"]}, {"_id": 0})
    d["matter"] = m
    return d


@api_router.put("/drafts/{draft_id}")
async def update_draft(draft_id: str, payload: DraftIn, user=Depends(get_current_user)):
    existing = await db.drafts.find_one({"id": draft_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Draft not found")
    updates = payload.dict()
    updates["updated_at"] = now_iso()
    updates["version"] = (existing.get("version") or 1) + 1
    await db.drafts.update_one({"id": draft_id}, {"$set": updates})
    return await db.drafts.find_one({"id": draft_id}, {"_id": 0})


@api_router.delete("/drafts/{draft_id}")
async def delete_draft(draft_id: str, user=Depends(get_current_user)):
    await db.drafts.delete_one({"id": draft_id, "lawyer_id": user["id"]})
    return {"ok": True}


# ============ Documents (file uploads, stored as base64) ============
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB base64


class DocumentIn(BaseModel):
    matter_id: str
    name: str
    file_type: str  # pdf | image | docx | other
    mime_type: Optional[str] = None
    file_size: int
    base64: str  # data URL or raw base64
    category: str = "other"  # pleadings | orders | evidence | correspondence | drafts | other


@api_router.get("/documents")
async def list_documents(user=Depends(get_current_user), matter_id: Optional[str] = None):
    query = {"lawyer_id": user["id"]}
    if matter_id:
        query["matter_id"] = matter_id
    # Exclude heavy base64 field from list view
    docs = await db.documents.find(query, {"_id": 0, "base64": 0}).sort("uploaded_at", -1).to_list(500)
    return docs


@api_router.post("/documents")
async def upload_document(payload: DocumentIn, user=Depends(get_current_user)):
    # rough size check on base64 string
    if len(payload.base64) > MAX_DOC_SIZE * 1.4:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")
    doc_id = str(uuid.uuid4())
    doc = payload.dict()
    doc.update({
        "id": doc_id,
        "lawyer_id": user["id"],
        "uploaded_at": now_iso(),
    })
    await db.documents.insert_one(dict(doc))
    # return without base64 payload
    out = {k: v for k, v in doc.items() if k not in ("_id", "base64")}
    return out


@api_router.get("/documents/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    d = await db.documents.find_one({"id": document_id, "lawyer_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Document not found")
    return d


@api_router.delete("/documents/{document_id}")
async def delete_document(document_id: str, user=Depends(get_current_user)):
    await db.documents.delete_one({"id": document_id, "lawyer_id": user["id"]})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
