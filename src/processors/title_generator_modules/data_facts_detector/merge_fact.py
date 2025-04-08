import itertools
from collections import defaultdict

class MergeFact:
    def __init__(self, merged_obj=None, content=None, score=None):
        self.merged_obj = merged_obj
        self.content = content
        self.score = score

    def compute_score(self, trend_scores: list[float], max_possible=None):
        if not trend_scores:
            self.score = 0
            return

        base = max(trend_scores)  # 趋势中最大强度为基础
        count = len(trend_scores)

        alpha = 0.7

        self.score = base * alpha + count / max_possible * (1 - alpha)

    def __repr__(self):
        return (f"MergeFact(merged_obj={self.merged_obj}, "
                f"content='{self.content}', score={self.score})")


class MergeFactCalculator:
    def __init__(self, trend_facts):
        self.trend_facts = trend_facts
        self.merge_facts = []

    def merge_trends(self, data):
        """
        合并具有相同趋势类型和相同 range 的多个 group。
        """
        self.merge_facts = []

        max_possible = len(data.get("columns", [])) - 1

        # 按 (range, trend_type) 聚合
        grouped = {}
        for fact in self.trend_facts:
            key = (tuple(fact.range), fact.trend_type)
            grouped.setdefault(key, []).append(fact)

        for (range_key, trend_type), facts in grouped.items():
            if len(facts) < 2:
                continue  # 至少两个对象才构成 merge fact

            # 枚举所有组合（2个及以上）
            for r in range(2, len(facts) + 1):
                for combo in itertools.combinations(facts, r):
                    merged_obj = [f.ref for f in combo]
                    trend_scores = [f.score for f in combo]
                    content = f"{trend_type} from {range_key[0]} to {range_key[-1]}"
                    merged_fact = MergeFact(merged_obj, content)
                    merged_fact.compute_score(trend_scores, max_possible=max_possible)
                    if merged_fact.score >= 0.5:
                        self.merge_facts.append(merged_fact)

    def get_merge_facts(self):
        return self.merge_facts