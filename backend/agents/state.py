from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal

Intent = Literal[
    "task_create",
    "task_complete",
    "task_reschedule",
    "task_priority_update",
    "calendar_create_event",
    "fallback_chat",
]


@dataclass
class PlanStep:
    step_id: str
    agent: str
    action: str
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentRunState:
    run_id: str
    user_id: str
    request_text: str
    intent: Intent = "fallback_chat"
    plan_steps: List[PlanStep] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

