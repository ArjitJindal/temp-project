from dataclasses import dataclass
from typing import Callable, Optional

from pyspark.sql import DataFrame
from pyspark.sql.types import StructType


@dataclass
class Entity:
    """Class representing an entity to persist to Databricks"""

    table: str
    schema: StructType
    partition_key: str
    id_column: str
    source: str
    timestamp_column: str
    enrichment_fn: Optional[
        Callable[[DataFrame, Callable[[str], DataFrame]], DataFrame]
    ] = None
