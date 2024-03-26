from pathlib import Path

CUR_DIR = Path(__file__).parent.absolute()


def read_file(path: str) -> str:
    with open(f"{CUR_DIR}/../../{path}", "r", encoding="UTF-8") as file:
        return file.read()
