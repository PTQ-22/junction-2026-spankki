"""FastAPI entry — uv run uvicorn backend.main:app --port 8000 --reload"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date

import duckdb
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .benchmarks import peer_benchmarks
from .chat import chat, list_transactions
from .db import DB_PATH, build, connect, customer_exists
from .garden import garden_state
from .simulate import simulate


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not DB_PATH.exists():
        build()
    yield


app = FastAPI(title="Taimi — money garden coach", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PERSONAS = [
    {"id": "CUST04957", "label": "CUST04957 · 18 · wilting flowers"},
    {"id": "CUST00359", "label": "CUST00359 · 18 · storm"},
    {"id": "CUST00095", "label": "CUST00095 · 21 · regrown garden"},
    {"id": "CUST03539", "label": "CUST03539 · 25 · growing tree"},
]


def get_con():
    con = connect(read_only=True)
    try:
        yield con
    finally:
        con.close()


def _customer_or_404(con, customer_id: str) -> None:
    if not customer_exists(con, customer_id):
        raise HTTPException(status_code=404, detail=f"unknown customer {customer_id}")


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/personas")
def personas():
    return PERSONAS


@app.get("/api/customers/{customer_id}/garden")
def garden(
    customer_id: str,
    today: date = date(2026, 9, 15),
    save_first_pct: float = 0.0,
    con: duckdb.DuckDBPyConnection = Depends(get_con),
):
    _customer_or_404(con, customer_id)
    return garden_state(con, customer_id, today, save_first_pct)


@app.get("/api/customers/{customer_id}/transactions")
def transactions(
    customer_id: str,
    flower: str,
    days: int = 30,
    today: date = date(2026, 9, 15),
    limit: int = 12,
    con: duckdb.DuckDBPyConnection = Depends(get_con),
):
    _customer_or_404(con, customer_id)
    return list_transactions(con, customer_id, today, flower=flower, period=f"last_{days}d", limit=limit)


@app.get("/api/customers/{customer_id}/benchmarks")
def benchmarks(
    customer_id: str,
    today: date = date(2026, 9, 15),
    con: duckdb.DuckDBPyConnection = Depends(get_con),
):
    _customer_or_404(con, customer_id)
    return peer_benchmarks(con, customer_id, today)


class SimulateBody(BaseModel):
    today: date = date(2026, 9, 15)
    category: str
    cut_pct: float = Field(default=0.2, ge=0, le=0.5)
    save_first_pct: float = Field(default=0.0, ge=0, le=0.3)
    months: int = Field(default=6, ge=1, le=12)


@app.post("/api/customers/{customer_id}/simulate")
def sim(customer_id: str, body: SimulateBody, con: duckdb.DuckDBPyConnection = Depends(get_con)):
    _customer_or_404(con, customer_id)
    state = garden_state(con, customer_id, body.today, body.save_first_pct)
    return simulate(state, body.category, body.cut_pct, body.months)


class ChatTurn(BaseModel):
    role: str  # "me" | "taimi"
    text: str


class ChatBody(BaseModel):
    today: date = date(2026, 9, 15)
    message: str
    save_first_pct: float = Field(default=0.0, ge=0, le=0.3)
    history: list[ChatTurn] = []


@app.post("/api/customers/{customer_id}/chat")
def chat_ep(customer_id: str, body: ChatBody, con: duckdb.DuckDBPyConnection = Depends(get_con)):
    _customer_or_404(con, customer_id)
    return chat(
        con, customer_id, body.today, body.message, body.save_first_pct,
        history=[h.model_dump() for h in body.history[-6:]],
    )
