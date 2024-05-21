import os
from dataclasses import dataclass

import pandas as pd
from sklearn.model_selection import train_test_split  # type: ignore

print(os.getcwd())

from data_transformation import DataTransformation


@dataclass
class DataIngestionConfig:
    """DataIngestionConfig data class"""

    train_data_path: str = os.path.join("artifact", "train.csv")
    test_data_path: str = os.path.join("artifact", "test.csv")
    raw_data_path: str = os.path.join("artifact", "data.csv")


class DataIngestion:
    """DataIngestion class for ingesting data from any arbritrary source"""

    def __init__(self):
        self.ingestion_config = DataIngestionConfig()

    def initialize_ingestion(self):
        df = pd.read_csv("../../.experimentation_data/transactions.csv")
        print("Read complete")
        os.makedirs(
            os.path.dirname(self.ingestion_config.train_data_path), exist_ok=True
        )
        df.to_csv(self.ingestion_config.raw_data_path, index=False, header=True)
        print("Saved raw data")
        train_set, test_set = train_test_split(df, test_size=0.2, random_state=42)
        train_set.to_csv(
            self.ingestion_config.train_data_path, index=False, header=True
        )
        test_set.to_csv(self.ingestion_config.test_data_path, index=False, header=True)
        print("Ingestion complete")
        return (
            self.ingestion_config.train_data_path,
            self.ingestion_config.test_data_path,
        )


if __name__ == "__main__":
    di = DataIngestion()
    train_data, test_data = di.initialize_ingestion()

    data_transformation = DataTransformation()

    data_transformation.initiate_date_transaformation(train_data, test_data)
