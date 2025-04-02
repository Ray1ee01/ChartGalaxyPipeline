import numpy as np

class AggregateFact:
    def __init__(self, obj=None, aggregate_type=None, range_=None, value=None):
        self.obj = obj
        self.aggregate_type = aggregate_type
        self.range = range_
        self.value = value
        self.score = None

    def compute_score(self, full_series=None, range_length=None, total_length=None):
        """
        full_series: list or np.ndarray of all values in该组中
        range_length: 当前聚合作用的值个数（默认等于 full_series 长度）
        total_length: 所有数据点总数（用于 sum 评分）
        """
        if full_series is None or len(full_series) < 2:
            self.score = 0
            return

        y = np.array(full_series)
        mean_y = np.mean(y)
        std_y = np.std(y, ddof=1)
        val = self.value

        if self.aggregate_type == "max":
            if std_y < 1e-8:
                self.score = 0
                return
            z = (val - mean_y) / std_y
            self.score = z / (1 + z)

        elif self.aggregate_type == "min":
            if std_y < 1e-8:
                self.score = 0
                return
            z = (val - mean_y) / std_y
            self.score = -z / (1 - z)

        elif self.aggregate_type == "avg":
            if std_y < 1e-8:
                self.score = 0
                return
            z = (val - mean_y) / std_y
            self.score = abs(z) / (1 + abs(z))  # 双侧，偏离越大越显著

        elif self.aggregate_type == "sum":
            # sum 越大，越显著，且范围越广影响越大
            if total_length is None or total_length < 2:
                self.score = 0
                return
            ratio = (range_length or len(y)) / total_length
            # 使用 sum 的偏离倍数（vs 平均值 × 范围长度）
            expected_sum = mean_y * (range_length or len(y))
            delta = val - expected_sum
            rel_change = abs(delta) / (abs(expected_sum) + 1e-8)
            self.score = rel_change * ratio  # 变化比例 × 覆盖比例

        else:
            self.score = 0

    def __repr__(self):
        return (f"AggregateFact(obj={self.obj}, aggregate_type={self.aggregate_type}, "
                f"range={self.range}, value={self.value}, score={self.score})")

class AggregateFactCalculator:
    def __init__(self):
        self.input_data = None
        self.aggregate_facts = []

    def set_input_data(self, data):
        self.input_data = data

    @staticmethod
    def _convert_to_numeric(value):
        if not isinstance(value, str):
            return value
        try:
            value = value.replace(',', '')
            if '%' in value:
                value = value.replace('%', '')
            return float(value)
        except Exception:
            return None

    def calculate_global_aggregates(self):
        """
        对每个 group（y 轴列）在所有数据上进行全局聚合（max, min, avg, sum）
        """
        if not self.input_data:
            raise ValueError("请先使用 set_input_data 设置输入数据。")

        columns = self.input_data.get("columns", [])
        data_rows = self.input_data.get("data", [])

        if len(columns) < 2 or not data_rows:
            return

        x_axis_name = columns[0]["name"]
        group_names = [col["name"] for col in columns[1:]]

        self.aggregate_facts = []

        for group in group_names:
            group_values = []
            for row in data_rows:
                value = self._convert_to_numeric(row.get(group))
                if value is not None:
                    group_values.append(value)

            if not group_values:
                continue

            for agg_type, result in [
                ("max", max(group_values)),
                ("min", min(group_values)),
                ("avg", sum(group_values) / len(group_values)),
                ("sum", sum(group_values)),
            ]:
                fact = AggregateFact(
                    obj=group,
                    aggregate_type=agg_type,
                    range_="all",
                    value=result
                )
                fact.compute_score(
                    full_series=group_values,
                    range_length=len(group_values),
                    total_length=len(group_values)  # 对于全局聚合，这三者一致
                )
                self.aggregate_facts.append(fact)

    def get_aggregate_facts(self):
        return self.aggregate_facts