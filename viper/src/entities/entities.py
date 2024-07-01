from typing import List

from src.entities.entity import Entity
from src.entities.scores import (
    action_risk_value_entity,
    dynamic_risk_value_entity,
    kyc_risk_value_entity,
)
from src.entities.transactions import transaction_entity
from src.entities.users import user_entity

entities: List[Entity] = [
    transaction_entity,
    user_entity,
    kyc_risk_value_entity,
    action_risk_value_entity,
    dynamic_risk_value_entity,
]
