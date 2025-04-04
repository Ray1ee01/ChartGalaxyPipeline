from typing import Any, Optional, Union

class DataFact:
    def __init__(self):
        # 用 dict 描述我们的 fact, 包含的 keys
        self.type: str = ""
        self.subtype: str = ""
        self.data_points: dict = {}
        self.score: float = 0.0
        self.annotation: str = ""
        self.reason: str = ""
        self.types = []

    def set_value(self,
                  subtype: Optional[str] = None,
                  data_points: Optional[dict] = None,
                  score: Optional[float] = None,
                  annotation: Optional[str] = None,
                  reason: Optional[str] = None
                  ):
        """ 设置各变量值 """
        if subtype is not None:
            if subtype in self.types:
                self.subtype = subtype
            else:
                print(f"Invalid type: {subtype}.")

        if data_points is not None:
            self.data_points = data_points

        if score is not None:
            self.score = score

        if annotation is not None:
            self.annotation = annotation

        if reason is not None:
            self.reason = reason

    def get_json(self):
        """ 返回 json 格式 """
        formated_json = {
            "type": self.type,
            "subtype": self.subtype,
            "data_points": self.data_points,
            "score": round(self.score, 2),
            "annotation": self.annotation,
            "reason": self.reason
        }
        return formated_json


class DataFactGenerator:
    def __init__(self, data: dict):
        self.data = data

        self.data_columns: dict[str, Any] = self.data["data"]["columns"]
        self.tabular_data: list[dict[str, Any]] = self.data["data"]["data"] # 原始数据

        self.grouped_data = divide_data_by_group(self.data_columns, self.tabular_data)

        # metadata
        role_map = {col["role"]: col["name"] for col in self.data_columns}
        self.x_column = role_map.get("x")
        self.y_column = role_map.get("y")
        self.group_column = role_map.get("group") # 可能为 None

        is_temporal = False
        for col in self.data_columns:
            if col["role"] == "x":
                if col["data_type"] == "temporal":
                    is_temporal = True
                else:
                    is_temporal = False
                break
        self.is_temporal = is_temporal

def divide_data_by_group(data_columns: list[dict[str, Any]], data: list[dict[str, Any]]) -> dict[str, dict[str, list[Any]]]:
    role_map = {col["role"]: col["name"] for col in data_columns}

    x_column = role_map.get("x")
    y_column = role_map.get("y")
    group_column = role_map.get("group") # 可能为 None

    grouped_data = {}

    for idx, row in enumerate(data):
        group_value = row.get(group_column, "")

        if group_value not in grouped_data.keys():
            grouped_data[group_value] = {
                "indices": [],
                "x_list": [],
                "y_list": []
            }
        grouped_data[group_value]["indices"].append(idx)
        grouped_data[group_value]["x_list"].append(row[x_column])
        grouped_data[group_value]["y_list"].append(row[y_column])

    return grouped_data
