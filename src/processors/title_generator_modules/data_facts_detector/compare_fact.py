import math

class CompareFact:
    def __init__(self, ref1=None, ref2=None, sign=None, degree=None):
        """
        参数:
            ref1, ref2: 对比的两个对象（可以是 y_column @ x_value）
            sign: "larger", "smaller", or "similar"
            degree: 对比程度，如“2.1x larger”, “+50%”, “100 vehicles more”
        """
        self.ref1 = ref1
        self.ref2 = ref2
        self.sign = sign
        self.degree = degree
        self.score = None

    def compute_score(self, v1, v2, is_max_min=False):
        if v1 is None or v2 is None:
            self.score = 0
            return

        diff = abs(v1 - v2)
        base = min(abs(v1), abs(v2)) + 1e-6
        raw = math.log1p(diff / base) # log(1 + ratio)
        score = raw / (1 + raw)

        if is_max_min:
            score *= 0.7 # max/min 降权

        self.score = round(score, 3)

    def __repr__(self):
        return (f"CompareFact(ref1={self.ref1}, ref2={self.ref2}, "
                f"sign={self.sign}, degree={self.degree}, score={self.score})")
    
class CompareFactCalculator:
    def __init__(self):
        self.compare_facts = []

    def _get_comparison(self, v1, v2):
        if v1 is None or v2 is None:
            return None, None
        delta = v1 - v2
        abs_diff = abs(delta)
        ratio = v1 / v2 if v2 != 0 else float('inf')
        if abs_diff < 1e-6:
            return "similar", "difference < 1e-6"
        sign = "larger" if v1 > v2 else "smaller"
        if ratio >= 1.5 or ratio <= 2 / 3:
            degree = f"{ratio:.2f}x"
        else:
            percent = (delta / v2) * 100 if v2 != 0 else float('inf')
            degree = f"{percent:+.1f}%"
        return sign, degree

    def calculate_optimized_comparisons(self, repo, data):
        self.compare_facts = []
        columns = data.get("columns", [])
        rows = data.get("data", [])
        if len(columns) < 2 or not rows:
            return

        x_col = columns[0]["name"]
        y_cols = [col["name"] for col in columns[1:]]

        # 同 group：不同 x 
        for y_col in y_cols:
            value_pairs = []
            for row in rows:
                x = row.get(x_col)
                y = row.get(y_col)
                try:
                    y_num = float(str(y).replace(",", "").replace("%", ""))
                    value_pairs.append((x, y_num))
                except:
                    continue

            if len(value_pairs) < 2:
                continue

            # max vs min
            sorted_all = sorted(value_pairs, key=lambda x: x[1])
            min_x, min_v = sorted_all[0]
            max_x, max_v = sorted_all[-1]
            sign, degree = self._get_comparison(max_v, min_v)
            ref1 = f"{y_col} @ {max_x}"
            ref2 = f"{y_col} @ {min_x}"
            fact = CompareFact(ref1, ref2, sign, degree)
            fact.compute_score(max_v, min_v, is_max_min=True)
            if fact.score >= 0.5:
                self.compare_facts.append(fact)

            # 相邻排序比较
            for i in range(len(sorted_all) - 1):
                (x1, v1), (x2, v2) = sorted_all[i], sorted_all[i + 1]
                sign, degree = self._get_comparison(v2, v1)
                ref1 = f"{y_col} @ {x2}"
                ref2 = f"{y_col} @ {x1}"
                fact = CompareFact(ref1, ref2, sign, degree)
                fact.compute_score(v1, v2, is_max_min=False)
                if fact.score >= 0.5:
                    self.compare_facts.append(fact)

        # 同 x：不同 group
        for row in rows:
            x_val = row.get(x_col)
            group_vals = []
            for y_col in y_cols:
                try:
                    y_num = float(str(row.get(y_col)).replace(",", "").replace("%", ""))
                    group_vals.append((y_col, y_num))
                except:
                    continue
            if len(group_vals) < 2:
                continue

            # 2a: max vs min
            sorted_groups = sorted(group_vals, key=lambda x: x[1])
            min_group, min_val = sorted_groups[0]
            max_group, max_val = sorted_groups[-1]
            sign, degree = self._get_comparison(max_val, min_val)
            ref1 = f"{max_group} @ {x_val}"
            ref2 = f"{min_group} @ {x_val}"
            fact = CompareFact(ref1, ref2, sign, degree)
            fact.compute_score(max_val, min_val, is_max_min=True)
            if fact.score >= 0.5:
                self.compare_facts.append(fact)

            # 2b: 相邻 group 比较
            for i in range(len(sorted_groups) - 1):
                (g1, v1), (g2, v2) = sorted_groups[i], sorted_groups[i + 1]
                sign, degree = self._get_comparison(v2, v1)
                ref1 = f"{g2} @ {x_val}"
                ref2 = f"{g1} @ {x_val}"
                fact = CompareFact(ref1, ref2, sign, degree)
                fact.compute_score(v1, v2, is_max_min=False)
                if fact.score >= 0.5:
                    self.compare_facts.append(fact)

        # === 3. 趋势对比：相同 range，方向相反 ===
        checked = set()
        for i, t1 in enumerate(repo.trend_facts):
            for j, t2 in enumerate(repo.trend_facts):
                if i >= j or t1.range != t2.range:
                    continue
                key = tuple(sorted([t1.ref, t2.ref]))
                if key in checked:
                    continue
                checked.add(key)
                dir1 = t1.trend_type
                dir2 = t2.trend_type
                if {dir1, dir2} == {"increase", "decrease"}:
                    ref1 = f"{t1.ref} (trend)"
                    ref2 = f"{t2.ref} (trend)"
                    sign = "opposite"
                    degree = f"{dir1} vs {dir2}"
                    self.compare_facts.append(CompareFact(ref1, ref2, sign, degree))

    def get_compare_facts(self):
        return self.compare_facts