from typing import Dict

from pyspark.sql import DataFrame

streams: Dict[str, DataFrame] = {}


class StreamCache:
    """StreamCache is an in-memory cache for any streams created"""

    def get_stream(self, name: str):
        if name in streams:
            return streams[name]
        return None

    def add_stream(self, name: str, stream: DataFrame):
        if name not in streams:
            streams[name] = stream
