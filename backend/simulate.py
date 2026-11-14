"""Deterministic 'You decide' simulation — the same rules as the prototype.

simulate(state, category, cut_pct, months) -> dict
state = output of garden_state; cut_pct in [0, 0.5].
"""

from __future__ import annotations

MONTH_LABELS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]
STATE_WORD = {"blooming": "blooming", "ok": "steady", "wilting": "needs some water", "dormant": "resting"}


def _fut_state(today_state: str, cut: float) -> str:
    if today_state != "wilting":
        return today_state
    if cut >= 0.15:
        return "blooming"
    if cut >= 0.05:
        return "ok"
    return "wilting"


def simulate(state: dict, category: str, cut_pct: float, months: int = 6) -> dict:
    cut = max(0.0, min(0.5, cut_pct))
    flower = next((f for f in state["flowers"] if f["flower"] == category), None)
    norm = flower["norm"] if flower else 0
    disabled = flower is None or norm == 0

    total = norm * cut * months
    cumulative = [round(norm * cut * m, 1) for m in range(1, months + 1)]
    hourly = state["hourly"] or 0
    hours = total / hourly if hourly else 0.0

    today_state = flower["state"] if flower else "dormant"
    future_state = today_state if disabled or total <= 0 else _fut_state(today_state, cut)

    pond_fill, pond_target = state["pond_fill"], state["pond_target"]
    already_full = pond_target > 0 and pond_fill >= pond_target
    monthly_pond = [
        round(min(pond_target, pond_fill + c)) if pond_target > 0 else round(pond_fill + c)
        for c in cumulative
    ]
    monthly_pocket = [
        round(max(0.0, pond_fill + c - pond_target)) if pond_target > 0 else round(c)
        for c in cumulative
    ]
    fut_fill = monthly_pond[-1]
    to_pocket = monthly_pocket[-1]

    stage = state["stage"]
    fut_stage = min(4, stage + (1 if total >= pond_target or total >= 300 else 0))

    month_free = state["month_free"]
    eur_day_now = max(month_free, 0) / 30
    eur_day_fut = max(month_free + norm * cut, 0) / 30

    chips = []
    if disabled:
        chips.append({"kind": "flower", "text": f"{category} — no usual spending to trim", "changed": False})
    elif future_state == today_state:
        chips.append({"kind": "flower", "text": f"{category} — no change", "changed": False})
    else:
        chips.append(
            {"kind": "flower", "text": f"{category}: {STATE_WORD[today_state]} → {STATE_WORD[future_state]}", "changed": True}
        )
    if pond_target <= 0:
        pass
    elif already_full:
        chips.append(
            {
                "kind": "pond",
                "text": f"Pond already full{f' — +{round(total)} € stays in your pocket' if total > 0 else ''}",
                "changed": total > 0,
            }
        )
    elif total > 0:
        chips.append(
            {
                "kind": "pond",
                "text": "Pond full" if fut_fill >= pond_target else f"Pond +{round(total)} €",
                "changed": True,
            }
        )
    else:
        chips.append({"kind": "pond", "text": "Pond unchanged", "changed": False})
    if fut_stage > stage:
        chips.append({"kind": "stage", "text": f"Stage {stage} → {fut_stage} · {_stage_name(fut_stage)}", "changed": True})

    return dict(
        category=category,
        cut_pct=cut,
        months=months,
        disabled=disabled,
        monthly_cumulative=cumulative,
        monthly_pond=monthly_pond,
        monthly_pocket=monthly_pocket,
        month_labels=MONTH_LABELS[:months],
        total=round(total),
        hours=round(hours, 1),
        today={"flower_state": today_state, "pond_fill": round(pond_fill), "stage": stage, "stage_name": _stage_name(stage)},
        future={
            "flower_state": future_state,
            "pond_fill": round(fut_fill),
            "pond_to_pocket": round(to_pocket),
            "stage": fut_stage,
            "stage_name": _stage_name(fut_stage),
        },
        eur_per_day_now=round(eur_day_now, 1),
        eur_per_day_future=round(eur_day_fut, 1),
        chips=chips,
        norm=norm,
    )


def _stage_name(stage: int) -> str:
    return ["Seed", "Sprout", "Sapling", "Young tree"][stage - 1]
