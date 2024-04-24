from typing import Dict

from pyspark.sql import DataFrame

batches: Dict[str, DataFrame] = {}


class BatchCache:
    """BatchCache is an in-memory cache for any batches created"""

    def get_batch(self, name: str):
        if name in batches:
            return batches[name]
        return None

    def add_batch(self, name: str, batch: DataFrame):
        if name not in batches:
            batches[name] = batch
