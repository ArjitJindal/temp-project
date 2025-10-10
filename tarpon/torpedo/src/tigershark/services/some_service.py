from typing import Any, Dict

from tigershark.common.math import add
from tigershark.database.models import SomeModel


class SomeService:
    """
    Sample service class that demonstrates how to organize business logic.
    This layer should contain the core business rules and orchestration logic.
    """

    def __init__(self):
        self.model = SomeModel()

    def process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process the input data according to business rules.
        """
        return add(data.get("a", 0), data.get("b", 0))
