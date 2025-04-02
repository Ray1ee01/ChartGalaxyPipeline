import itertools
import re

class CombineFact:
    def __init__(self, ref=None, contents=None):
        """
        ref: 被组合的对象（例如 "Tesla"）
        contents: List[str]，两个 trend fact 的内容拼接，如 ["increase from 2010 to 2015", "decrease from 2015 to 2020"]
        """
        self.ref = ref
        self.contents = contents
        self.score = None

    def compute_score(self, trend_scores: list[float]):
        if not trend_scores:
            self.score = 0
            return

        alpha = 0.4

        max_score = max(trend_scores)
        self.score = round(max_score * alpha + (1 - alpha), 3)

    def __repr__(self):
        return (f"CombineFact(ref={self.ref}, contents={self.contents}, score={self.score})")

class CombineFactCalculator:
    def __init__(self, trend_facts):
        self.trend_facts = trend_facts
        self.combine_facts = []

    def _extract_start_end(self, range_):
        """
        提取 range 的起始与结束时间，尽量转换为整数年份或数值进行比较；失败则返回原始值。
        """
        def extract_year(val):
            if isinstance(val, int):
                return val
            if isinstance(val, float):
                return int(val)
            if isinstance(val, str):
                # 尝试匹配4位年份，如 "2015", "2020", "2015/2016", "FY 2017"
                match = re.search(r"(1|2)\d{3}", val)
                if match:
                    return int(match.group())
                # 匹配如 "2014-15", "2015/16"
                match = re.search(r"(1|2)\d{3}[\-/](\d{2,4})", val)
                if match:
                    return int(match.group(1))  # 返回前面那个年份部分
            return None

        start = extract_year(range_[0])
        end = extract_year(range_[-1])

        if start is not None and end is not None:
            return start, end
        else:
            return range_[0], range_[-1]  # fallback：原样返回

    def combine_trends(self):
        self.combine_facts = []

        # 1. 按 group（ref）分组
        grouped = {}
        for fact in self.trend_facts:
            grouped.setdefault(fact.ref, []).append(fact)

        for ref, facts in grouped.items():
            for f1, f2 in itertools.permutations(facts, 2):
                if f1.range == f2.range:
                    continue

                start1, end1 = self._extract_start_end(f1.range)
                start2, end2 = self._extract_start_end(f2.range)

                if not isinstance(end1, int) and not isinstance(end1, float):
                    continue
                if not isinstance(start2, int) and not isinstance(start2, float):
                    continue
                
                if end1 >= start2:
                    continue  # 必须 f1 完全在 f2 之前

                pair = (f1.trend_type, f2.trend_type)
                if pair in [("increase", "decrease"), ("decrease", "increase")]:
                    content1 = f"{f1.trend_type} from {f1.range[0]} to {f1.range[-1]}"
                    content2 = f"{f2.trend_type} from {f2.range[0]} to {f2.range[-1]}"
                    trend_scores = [f1.score, f2.score]
                    fact = CombineFact(ref=ref, contents=[content1, content2])
                    fact.compute_score(trend_scores)
                    if fact.score >= 0.5:
                        self.combine_facts.append(fact)

    def get_combine_facts(self):
        return self.combine_facts