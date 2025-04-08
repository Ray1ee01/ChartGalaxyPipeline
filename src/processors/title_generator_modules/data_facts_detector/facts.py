from aggregate_fact import AggregateFact, AggregateFactCalculator
from compare_fact import CompareFact, CompareFactCalculator
from merge_fact import MergeFact, MergeFactCalculator
from trend_fact import TrendFact, TrendFactCalculator
from combine_fact import CombineFact, CombineFactCalculator

class DataFactToTextConverter:
    def fact_to_text(self, fact):
        if isinstance(fact, AggregateFact):
            return self.aggregate_to_text(fact)
        elif isinstance(fact, TrendFact):
            return self.trend_to_text(fact)
        elif isinstance(fact, CompareFact):
            return self.compare_to_text(fact)
        elif isinstance(fact, MergeFact):
            return self.merge_to_text(fact)
        elif isinstance(fact, CombineFact):
            return self.combine_to_text(fact)
        else:
            return f"[Unrecognized fact type] {fact}"

    def aggregate_to_text(self, fact: AggregateFact):
        if fact.aggregate_type == "max":
            return f"{fact.obj} reached a maximum value of {fact.value} over {fact.range}"
        elif fact.aggregate_type == "min":
            return f"{fact.obj} dropped to a minimum value of {fact.value} over {fact.range}"
        elif fact.aggregate_type == "avg":
            return f"The average of {fact.obj} over {fact.range} was {fact.value}"
        elif fact.aggregate_type == "sum":
            return f"The total of {fact.obj} over {fact.range} was {fact.value}"
        else:
            return str(fact)

    def trend_to_text(self, fact: TrendFact):
        return f"{fact.ref} showed a {fact.trend_type} trend from {fact.range[0]} to {fact.range[1]}"

    def compare_to_text(self, fact: CompareFact):
        return f"{fact.ref1} was {fact.sign} than {fact.ref2} ({fact.degree})"

    def merge_to_text(self, fact: MergeFact):
        if len(fact.merged_obj) == 1 and any(op in fact.merged_obj[0] for op in [">", "<", "="]):
            # 比较合并的情况
            return f"{fact.merged_obj[0]} was {fact.content}"
        else:
            # 趋势合并的情况
            obj_str = " and ".join(fact.merged_obj)
            return f"{obj_str} all {fact.content}"

    def combine_to_text(self, fact: CombineFact):
        return f"{fact.ref} first {fact.contents[0]}, then {fact.contents[1]}"
    
    def convert_facts_to_text(self, scored_facts):
        """
        输入为已排序的 (score, fact_type, fact) 三元组列表
        """
        output = []
        for score, fact_type, fact in scored_facts:
            text = self.fact_to_text(fact)
            output.append((score, fact_type, text))
        return output

class FactRepository:
    def __init__(self):
        self.aggregate_facts: list[AggregateFact] = []
        self.trend_facts: list[TrendFact] = []
        self.compare_facts: list[CompareFact] = []
        self.merge_facts: list[MergeFact] = []
        self.combine_facts: list[CombineFact] = []

    def add_aggregate_fact(self, fact: AggregateFact):
        self.aggregate_facts.append(fact)

    def add_trend_fact(self, fact: TrendFact):
        self.trend_facts.append(fact)

    def add_compare_fact(self, fact: CompareFact):
        self.compare_facts.append(fact)

    def add_merge_fact(self, fact: MergeFact):
        self.merge_facts.append(fact)

    def add_combine_fact(self, fact: MergeFact):
        self.combine_facts.append(fact)

    def get_aggregates_by_ref(self, ref):
        return [f for f in self.aggregate_facts if f.obj == ref]

    def get_aggregates_by_range(self, ref, range_):
        return [f for f in self.aggregate_facts if f.obj == ref and f.range == range_]

    def get_trends_by_range(self, range_):
        return [f for f in self.trend_facts if f.range == range_]
    
class FactController:
    def __init__(self):
        self.repo = FactRepository()

    def run_all(self, data):
        """
        执行完整的流程：aggregate -> trend -> compare -> merge
        """

        # 1. Aggregate
        agg_calc = AggregateFactCalculator()
        agg_calc.set_input_data(data)
        agg_calc.calculate_global_aggregates()
        for fact in agg_calc.get_aggregate_facts():
            self.repo.add_aggregate_fact(fact)

        # 2. Trend
        trend_calc = TrendFactCalculator()
        trend_calc.set_input_data(data)
        trend_calc.calculate_trends()
        for fact in trend_calc.get_trend_facts():
            self.repo.add_trend_fact(fact)

        # 3. Compare（根据已计算出的 fact）
        comp_calc = CompareFactCalculator()
        comp_calc.calculate_optimized_comparisons(self.repo, data)
        for fact in comp_calc.get_compare_facts():
            self.repo.add_compare_fact(fact)

        # 4. Merge trend
        merge_calc = MergeFactCalculator(self.repo.trend_facts)
        merge_calc.merge_trends(data)
        for fact in merge_calc.get_merge_facts():
            self.repo.add_merge_fact(fact)

        combine_calc = CombineFactCalculator(self.repo.trend_facts)
        combine_calc.combine_trends()
        for fact in combine_calc.get_combine_facts():
            self.repo.add_combine_fact(fact)

    def get_all_facts(self):
        return {
            "aggregate": self.repo.aggregate_facts,
            "trend": self.repo.trend_facts,
            "compare": self.repo.compare_facts,
            "merge": self.repo.merge_facts,
            "combine": self.repo.combine_facts
        }

    def get_results(self):
        all_facts = self.get_all_facts()
        scored_facts = []

        for fact_type, fact_list in all_facts.items():
            for fact in fact_list:
                if fact.score is not None:
                    scored_facts.append((fact.score, fact_type, fact))

        # 分数从高到低排序
        scored_facts.sort(reverse=True, key=lambda x: x[0])

        # 转换为文本
        converter = DataFactToTextConverter()
        texts = converter.convert_facts_to_text(scored_facts)

        return texts

def main():
    # 示例数据（Tesla vs Big 3）
    data = {
        "title": "The Composition Of Coronavirus Misinformation",
        "description": "Composition of Covid-19 rumors, stigma and conspiracy theories circulating on social media/online news platforms*",
        "main_insight": "The most common category of Coronavirus misinformation relates to illness, transmission, and mortality, followed closely by control measures, miscellaneous, and treatment/cure.",
        "columns": [
            {
                "name": "Category",
                "importance": "primary",
                "description": "Category of misinformation"
            },
            {
                "name": "Percentage",
                "importance": "primary",
                "description": "Percentage of total misinformation reports"
            }
        ],
        "data": [
            {
                "Category": "Illness, transmission and mortality",
                "Percentage": "24%"
            },
            {
                "Category": "Control measures",
                "Percentage": "21%"
            },
            {
                "Category": "Miscellaneous",
                "Percentage": "20%"
            },
            {
                "Category": "Treatment and cure",
                "Percentage": "19%"
            },
            {
                "Category": "Cause of disease including the origin",
                "Percentage": "15%"
            },
            {
                "Category": "Violence",
                "Percentage": "1%"
            }
        ],
        "chart_type": "bar",
        "data_facts": [
            "The category of misinformation related to illness, transmission, and mortality is the most common, constituting 24% of the total.",
            "Control measures account for 21% of the misinformation categories, making it the second most common.",
            "Misinformation categorized as miscellaneous represents 20% of the total categories of Coronavirus misinformation.",
            "The category related to treatment and cure comprises 19% of the misinformation.",
            "Cause of disease, including the origin, makes up 15% of the total misinformation categories, while violence is the least common at only 1%."
        ]
    }

    controller = FactController()
    controller.run_all(data)

    texts = controller.get_results()
    for i, (score, fact_type, sentence) in enumerate(texts[:10], 1):
        print(f"{i}. [{fact_type.upper()}] {sentence} (score={score:.3f})")


if __name__ == "__main__":
    main()