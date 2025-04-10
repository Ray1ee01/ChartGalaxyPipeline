from modules.datafact_generator.util import DataFact, DataFactGenerator
from modules.datafact_generator.value_fact import ValueFact
from typing import Any

class ProportionFact(DataFact):
    """ 单个 proportion fact """
    def __init__(self):
        super().__init__()
        self.type = "proportion"
        self.types = [
            "value_majority",
            "value_minority",
            "total_majority",
            "total_minority"
        ]

class ProportionFactGenerator(DataFactGenerator):
    """ 处理从数据提取 proportion facts 的问题 """
    def __init__(self, data: dict, value_facts: list[ValueFact]):
        super().__init__(data)

        # 使用计算好的 value facts 进行组合
        self.value_facts = value_facts

        self.total_facts: list[ValueFact] = []

        for fact in self.value_facts:
            if fact.subtype == "total":
                self.total_facts.append(fact)

    def extract_proportion_facts(self) -> list[ProportionFact]:
        proportion_facts: list[ProportionFact] = []

        # 如果数据的 y 中包含负数，那么 majoroty / minority 就失去意义了
        for single_data in self.tabular_data:
            if single_data[self.y_column] < 0:
                return []
        
        # 如果就一个 group 也不需要算了
        if self.group_column is None:
            return []
        
        # 对 value based 的操作
        # 随便找一个 x_list, 用来遍历
        any_group = next(iter(self.grouped_data.values()))
        x_list = any_group["x_list"]
        num_items = len(x_list)
        try:
            for i in range(num_items):
                # 对于某一个 x 值，把对应的 index, group_value, y 聚合起来
                info = {}
                for group_value, group_info in self.grouped_data.items():
                    y_list = group_info["y_list"]
                    indices = group_info["indices"]

                    info[group_value] = { # 构建一个 y 值和 index 的 dict 作传参
                        "y": y_list[i],
                        "index": indices[i]
                    }

                x_value = x_list[i]

                value_max_fact, value_min_fact = self._extract_value_based_facts(x_value, info)
                proportion_facts.append(value_max_fact)
                proportion_facts.append(value_min_fact)
        except Exception as e:
            print(e)

        # 直接依赖 value facts
        total_majority_fact, total_minority_fact = self._extract_total_based_facts(self.total_facts)

        proportion_facts.append(total_majority_fact)
        proportion_facts.append(total_minority_fact)
        
        return proportion_facts

    def _extract_value_based_facts(self, x_value: str, info: dict[str, dict[str, Any]]):
        """ 处理 value majority fact 和 value minority fact """
        max_proportion_fact, min_proportion_fact = ProportionFact(), ProportionFact()
        max_subtype, min_subtype = "value_majority", "value_minority"

        # 先把 y 值和 index 取出来，用 y 作索引取最大、最小值
        y_and_index = [(group_value, value["y"], value["index"]) for group_value, value in info.items()]
        y_values = [y for _, y, _ in y_and_index]
        sum_y = sum(y_values) or 1e-8

        max_y = max(y_values)
        min_y = min(y_values)

        max_proportion, min_proportion = max_y / sum_y, min_y / sum_y

        # 多个最大值/最小值情况
        max_group_values, max_indices = [], []
        min_group_values, min_indices = [], []

        for group_value, y, index in y_and_index:
            if y == max_y:
                max_group_values.append(group_value)
                max_indices.append(index)
            if y == min_y:
                min_group_values.append(group_value)
                min_indices.append(index)

        max_data_points = [self.tabular_data[index] for index in max_indices]
        min_data_points = [self.tabular_data[index] for index in min_indices]

        def generate_score():
            # 对于majority, 类别越多，分值肯定应该相对较高
            if 1 - max_proportion <= 1e-8:
                return 0.0, 0.0
            k_max = 1.0
            max_score = 1 / (1 + k_max * max_proportion / len(info))
            
            if min_proportion <= 1e-8:
                return max_score, 0.0
            k_min = 5.0
            min_score = 1 / (1 + k_min * min_proportion)
                        
            # 最小值用比例评分
            if min_proportion <= 1e-8:
                return max_score, 0.0 # 感觉一般来说有问题
            k_min = 5.0
            min_score = 1 / (1 + k_min * min_proportion)

            return max_score, min_score

        def generate_annotation_and_reason():
            max_annotation, max_reason = "", ""
            min_annotation, min_reason = "", ""

            max_group_value_str = ", ".join(max_group_values)
            min_group_value_str = ", ".join(min_group_values)

            if len(max_group_values) == 1:
                if max_proportion > 0.5:
                    max_annotation = f"The {max_group_value_str} accounts for the majority in {x_value}."
                    max_reason = (
                        f"The {self.y_column} of {max_group_value_str} in {x_value} accounts for {max_proportion} (more than 50%) "
                        f"of the total of {self.y_column} of all {self.group_column}."
                    )
                else:
                    max_annotation = f"The {max_group_value_str} has the largest proportion in {x_value}."
                    max_reason = (
                        f"The {self.y_column} of {max_group_value_str} in {x_value} accounts for {max_proportion}, larger than all "
                        f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                    )
            else:
                max_annotation = f"The {max_group_value_str} all have the largest proportion in {x_value}."
                max_reason = (
                    f"The {self.y_column} of {max_group_value_str} in {x_value} all account for {max_proportion}, larger than all "
                    f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                )

            # 正常来说除非就两类，不然占"少数"应该是正常情况
            if len(min_group_values) == 1:
                min_annotation = f"The {min_group_value_str} has the smallest proportion in {x_value}."
                min_reason = (
                    f"The {self.y_column} of {min_group_value_str} in {x_value} accounts for {min_proportion}, smaller than all "
                    f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                )
            else:
                min_annotation = f"The {min_group_value_str} all have the smallest proportion in {x_value}."
                min_reason = (
                    f"The {self.y_column} of {min_group_value_str} in {x_value} all account for {min_proportion}, smaller than all "
                    f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                )

            return max_annotation, max_reason, min_annotation, min_reason

        max_score, min_score = generate_score()
        max_annotation, max_reason, min_annotation, min_reason = generate_annotation_and_reason()

        max_proportion_fact.set_value(
            max_subtype, max_data_points, max_score, max_annotation, max_reason
        )

        min_proportion_fact.set_value(
            min_subtype, min_data_points, min_score, min_annotation, min_reason
        )

        return max_proportion_fact, min_proportion_fact

    def _extract_total_based_facts(self, total_facts: list[ValueFact]):
        """ 处理 total majority fact 和 total minority fact """
        max_proportion_fact, min_proportion_fact = ProportionFact(), ProportionFact()
        max_subtype, min_subtype = "value_majority", "value_minority"

        max_total = max(total_facts, key=lambda x: x.data_points[0][self.y_column]).data_points[0][self.y_column]
        min_total = min(total_facts, key=lambda x: x.data_points[0][self.y_column]).data_points[0][self.y_column]

        sum_total = sum([total_fact.data_points[0][self.y_column] for total_fact in total_facts]) or 1e-8

        max_proportion = max_total / sum_total
        min_proportion = min_total / sum_total

        max_total_facts: list[ValueFact] = []
        min_total_facts: list[ValueFact] = []

        for total_fact in total_facts:
            if total_fact.data_points[0][self.y_column] == max_total:
                max_total_facts.append(total_fact)
            if total_fact.data_points[0][self.y_column] == min_total:
                min_total_facts.append(total_fact)

        # total fact 的 data pooints 必定只有一项
        max_data_points = [total_fact.data_points[0] for total_fact in max_total_facts]
        min_data_points = [total_fact.data_points[0] for total_fact in max_total_facts]

        def generate_score():
            if 1 - max_proportion <= 1e-8:
                return 0.0, 0.0
            k_max = 1.0
            max_score = 1 / (1 + k_max * max_proportion / len(total_facts))
            
            if min_proportion <= 1e-8:
                return max_score, 0.0
            k_min = 5.0
            min_score = 1 / (1 + k_min * min_proportion)
            
            return max_score, min_score
        
        def generate_annotation_and_reason():
            max_annotation, max_reason = "", ""
            min_annotation, min_reason = "", ""

            max_group_value_str = ", ".join([max_data_point[self.group_column] for max_data_point in max_data_points])
            min_group_value_str = ", ".join([min_data_point[self.group_column] for min_data_point in min_data_points])
            
            if len(max_data_points) == 1:
                if max_proportion > 0.5:
                    max_annotation = f"The total value of {max_group_value_str} accounts for the majority in all {self.group_column}."
                    max_reason = (
                        f"The total value of {self.y_column} of {max_group_value_str} accounts for {max_proportion} (more than 50%) "
                        f"of the total of {self.y_column} of all {self.group_column}."
                    )
                else:
                    max_annotation = f"The total value of {max_group_value_str} has the largest proportion."
                    max_reason = (
                        f"The total value of {self.y_column} of {max_group_value_str} accounts for {max_proportion}, larger than all "
                        f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                    )
            else:
                max_annotation = f"The total value of {max_group_value_str} all have the largest proportion."
                max_reason = (
                    f"The total value of {self.y_column} of {max_group_value_str} all account for {max_proportion}, larger than all "
                    f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                )

            if len(min_data_points) == 1:
                min_annotation = f"The total value of {min_group_value_str} has the smallest proportion."
                min_reason = (
                    f"The total value of {self.y_column} of {min_group_value_str} accounts for {min_proportion}, smaller than all "
                    f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                )
            else:
                min_annotation = f"The total value of {min_group_value_str} all have the smallest proportion."
                min_reason = (
                    f"The total value of {self.y_column} of {min_group_value_str} all account for {min_proportion}, smaller than all "
                    f"other {self.group_column}, of the total of {self.y_column} of all {self.group_column}."
                )

            return max_annotation, max_reason, min_annotation, min_reason

        max_score, min_score = generate_score()
        max_annotation, max_reason, min_annotation, min_reason = generate_annotation_and_reason()

        max_proportion_fact.set_value(
            max_subtype, max_data_points, max_score, max_annotation, max_reason
        )

        min_proportion_fact.set_value(
            min_subtype, min_data_points, min_score, min_annotation, min_reason
        )

        return max_proportion_fact, min_proportion_fact