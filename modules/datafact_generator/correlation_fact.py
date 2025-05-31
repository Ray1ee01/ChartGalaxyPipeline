from modules.datafact_generator.util import DataFact, DataFactGenerator
import numpy as np
from scipy.stats import pearsonr
from itertools import combinations

class CorrelationFact(DataFact):
    def __init__(self):
        super().__init__()
        self.type = "correlation"
        self.types = ["positive", "negative"]

class CorrelationFactGenerator(DataFactGenerator):
    def __init__(self, data):
        super().__init__(data)

    def extract_correlation_facts(self) -> list[CorrelationFact]:
        correlation_facts: list[CorrelationFact] = []
        
        group_keys = list(self.grouped_data.keys())
        for group_value1, group_value2 in combinations(group_keys, 2):
            group1 = self.grouped_data[group_value1]
            group2 = self.grouped_data[group_value2]

            indices1 = group1["indices"]
            y_list1 = group1["y_list"]
            indices2 = group2["indices"]
            y_list2 = group2["y_list"]

            if len(y_list1) != len(y_list2) or len(y_list1) <= 1:
                continue

            correlation_fact = self._extract_single_correlation(
                group_value1, indices1, y_list1,
                group_value2, indices2, y_list2
            )

            correlation_facts.append(correlation_fact)

        return correlation_facts

    def _extract_single_correlation(
            self,
            group_value1: str, indices1: list[int], y_list1: list,
            group_value2: str, indices2: list[int], y_list2: list
            ) -> CorrelationFact:
        correlation_fact = CorrelationFact()

        assert(len(y_list1) == len(y_list2))

        y_array1 = np.array(y_list1)
        y_array2 = np.array(y_list2)

        r, _ = pearsonr(y_array1, y_array2)
        score = abs(r)
        subtype = "positive" if r >= 0 else "negative"

        data_points = [
            self.tabular_data[indices1[-1]],
            self.tabular_data[indices2[-1]]
        ] # 用最后一个元素表征

        def generate_annotation_and_reason():
            annotation, reason = "", ""

            if subtype == "positive":
                annotation = (
                    f"The {self.y_column} of {group_value1} and {group_value2} show a positive correlation."
                )
                reason = (
                    f"The Pearson correlation coefficient of the {self.y_column} between {group_value1} and {group_value2} "
                    f"is {r:.2f}, indicating a strong positive relationship."
                )
            elif subtype == "negative":
                annotation = (
                    f"The {self.y_column} of {group_value1} and {group_value2} show a negative correlation."
                )
                reason = (
                    f"The Pearson correlation coefficient of the {self.y_column} between {group_value1} and {group_value2} "
                    f"is {r:.2f}, indicating a strong negative relationship."
                )

            return annotation, reason
        
        annotation, reason = generate_annotation_and_reason()

        correlation_fact.set_value(
            subtype, data_points, score, annotation, reason
        )

        return correlation_fact