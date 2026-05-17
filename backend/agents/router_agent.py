from __future__ import annotations

import re
from typing import Any, Dict, List


def _extract_quoted(text: str) -> str:
    m = re.search(r'["“”](.+?)["“”]', text or "")
    return m.group(1).strip() if m else ""


def _extract_date(text: str) -> str:
    m = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", text or "")
    return m.group(1) if m else ""


def _extract_priority(text: str) -> str:
    t = (text or "").lower()
    if any(k in t for k in ["high", "urgent", "tinggi"]):
        return "high"
    if any(k in t for k in ["medium", "sederhana"]):
        return "medium"
    if any(k in t for k in ["low", "rendah"]):
        return "low"
    return ""


def build_plan(request_text: str) -> Dict[str, Any]:
    text = (request_text or "").strip()
    lower = text.lower()
    quoted = _extract_quoted(text)
    date = _extract_date(text)
    priority = _extract_priority(text)
    steps: List[Dict[str, Any]] = []

    if re.search(r"((complete|finish|done)\s+task|(siap|selesai|tamatkan)\s+tugas)", lower):
        steps = [{"step_id": "task-1", "agent": "task", "action": "complete_by_title", "payload": {"title": quoted or text}}]
        return {
            "intent": "task_complete",
            "confidence": 0.92,
            "requires_clarification": not bool(quoted),
            "clarification_question": "" if quoted else "Which task title should I mark complete?",
            "plan_steps": steps if quoted else [],
        }

    if re.search(r"((add)\s+task|(tambah)\s+tugas)", lower):
        title = quoted or re.sub(r"^(add task|tambah tugas)\s*", "", text, flags=re.I).strip()
        steps = [{
            "step_id": "task-1",
            "agent": "task",
            "action": "create_task",
            "payload": {"title": title, "deadline": date or None, "priority": priority or "medium"},
        }]
        return {
            "intent": "task_create",
            "confidence": 0.9,
            "requires_clarification": not bool(title),
            "clarification_question": "" if title else "What task title should I create?",
            "plan_steps": steps if title else [],
        }

    if re.search(r"((reschedule|move)\s+task|(jadual semula|pindah)\s+tugas)", lower):
        steps = [{"step_id": "task-1", "agent": "task", "action": "reschedule_by_title", "payload": {"title": quoted or text, "deadline": date or None}}]
        return {
            "intent": "task_reschedule",
            "confidence": 0.88,
            "requires_clarification": not bool(quoted and date),
            "clarification_question": "" if (quoted and date) else "Which task and date (YYYY-MM-DD) should I reschedule?",
            "plan_steps": steps if (quoted and date) else [],
        }

    if re.search(r"((set|change)\s+priority|(tetapkan|tukar)\s+keutamaan)", lower):
        steps = [{"step_id": "task-1", "agent": "task", "action": "set_priority_by_title", "payload": {"title": quoted or text, "priority": priority or None}}]
        return {
            "intent": "task_priority_update",
            "confidence": 0.88,
            "requires_clarification": not bool(quoted and priority),
            "clarification_question": "" if (quoted and priority) else "Which task and priority (high/medium/low) should I set?",
            "plan_steps": steps if (quoted and priority) else [],
        }

    if re.search(r"((create|add)\s+(calendar\s+)?event|(cipta|tambah)\s+(acara\s+)?kalendar)", lower):
        return {
            "intent": "calendar_create_event",
            "confidence": 0.8,
            "requires_clarification": False,
            "clarification_question": "",
            "plan_steps": [{"step_id": "cal-1", "agent": "calendar", "action": "create_event", "payload": {"raw_text": text}}],
        }

    return {
        "intent": "fallback_chat",
        "confidence": 0.6,
        "requires_clarification": False,
        "clarification_question": "",
        "plan_steps": [],
    }

