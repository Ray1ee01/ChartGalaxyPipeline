import numpy as np
import pandas as pd

class TrendFact:
    def __init__(self, ref=None, range_=None, trend_type=None, degree=None):
        """
        初始化一个趋势事实对象。

        参数:
            ref: 被观察的对象（例如 "Tesla", "Clinton voters"）
            range_: 时间或顺序范围，如 ("2010", "2014", "2018")
            trend_type: "increase", "decrease", "stable"
            degree: 趋势程度的量化，如百分比、斜率、描述性文字等
        """
        self.ref = ref
        self.range = range_
        self.trend_type = trend_type
        self.degree = degree
        self.score = None  # 趋势的重要性评分

    def __repr__(self):
        return (f"TrendFact(ref={self.ref}, range={self.range}, "
                f"trend_type={self.trend_type}, degree={self.degree}, score={self.score})")
    


import re
from dateutil import parser

class TrendFactCalculator:
    def __init__(self):
        self.input_data = None
        self.trend_facts = []

        self.sequential_threshold = 0.6  # 至少 60% 的值具有时序性才判断为时间序列
        self.score_threshold = 0.5

    def set_input_data(self, data):
        self.input_data = data

    def is_sequential_value(self, val):
        if isinstance(val, (int, float)):
            try:
                num = float(val)
            except Exception:
                return False
            if 1000 <= num <= 3000 or 1 <= num < 13:
                return True

        elif isinstance(val, str):
            s = val.strip().strip('"').strip("'")
            if not s:
                return False
            s = s.replace("\n", " ").replace("\r", " ")
            patterns = [
                r"^(1|2)\d{3}(\.\d+)?$", # "2004", "2004.0", "1995.114578"
                r"^\d{4}(-|~|\s+)\d{2}$", # "2008-09"
                r"^[A-Za-z]{3,9}(-|~|\s+)\d{2,4}$", # "Apr-14", "Jan-2013"
                r"^\d{4}(-|\s+)Q[1-4]$", # "2010-Q1"
                r"^Q[1-4](-|\s+)\d{4}$", # "Q1 2019"
                r"^([1-9]|10|11|12)$",
                r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?$",
                r"^(january|febuary|march|april|may|june|july|august|september|octomber|november|december)$"
                r"^\d{1,2}(\s*)(AM|PM|A.M.|P.M.)$", # "10AM"
                r"^\d{1,2}/\d{1,2}([/-]\d{2,4})?$" # "7/26",  "7/26/2019"
            ]
            for pat in patterns:
                if re.match(pat, s, re.IGNORECASE):
                    return True
            if re.search(r"\d+\s*(-|~)\s*\d+", s):
                return True
            age_range_patterns = [
                r"^\d+\s*-\s*\d+\s*(年|years?)$", r"^(under|above)\s*\d+$",
                r"^\d{1,2}\s*(-|~)\s*\d{1,2}$"
            ]
            for pat in age_range_patterns:
                if re.match(pat, s, re.IGNORECASE):
                    return True
            tokens = re.split(r"\s+", s)
            valid_tokens = 0
            for token in tokens:
                for pat in patterns:
                    if re.match(pat, token, re.IGNORECASE):
                        valid_tokens += 1
                        break
                else:
                    try:
                        parser.parse(token, fuzzy=False)
                        valid_tokens += 1
                    except:
                        try:
                            num = float(token)
                            if (1000 <= num <= 3000) or (1 <= num <= 12):
                                valid_tokens += 1
                        except:
                            pass
            return valid_tokens >= len(tokens) / 2
        else:
            return False
        
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

    def check_sequential(self, df: pd.DataFrame, x_label):
        if isinstance(x_label, str):
            label_lower = x_label.lower()
            for kw in [
                "month", "day", "year", "festival", "age range", "week", "quarter", "generation",
                "季", "月", "日", "年", "节", "年龄", "季度"
                ]:
                if kw in label_lower:
                    return True

        x_data = df["x_data"]
        sequential_count = 0
        total_count = len(x_data)
        num_flag = all(isinstance(v, (int, float)) for v in x_data)

        if num_flag:
            try:
                if max(x_data) - min(x_data) <= 3:
                    return False
            except:
                pass

        for val in x_data:
            if self.is_sequential_value(val):
                sequential_count += 1

        return (sequential_count / total_count) >= self.sequential_threshold if total_count > 0 else False
    
    def _mann_kendall_test(self, x: np.ndarray, y: np.ndarray):
        n = len(y)
        if n < 2:
            return 0.0

        sort_idx = np.argsort(x)
        y = y[sort_idx]

        S = 0
        for i in range(n - 1):
            for j in range(i + 1, n):
                diff = y[j] - y[i]
                if diff > 0:
                    S += 1
                elif diff < 0:
                    S -= 1

        tau = S / (0.5 * n * (n - 1))
        return tau

    def _get_trend_fact(self, x_data, y_data, total_length=None):
        tau = self._mann_kendall_test(np.array(x_data), np.array(y_data))

        if tau > 0.05:
            trend_type = "increase"
        elif tau < -0.05:
            trend_type = "decrease"
        else:
            trend_type = "stable"

        trend_strength = abs(tau)

        if total_length is None:
            total_length = len(x_data)
        range_length = len(x_data)
        range_ratio = (range_length - 1) / (total_length - 1) if total_length > 1 else 1.0

        # 新评分公式：趋势显著性 + 范围长度的加权
        alpha = 0.4
        score = alpha * trend_strength + (1 - alpha) * range_ratio
        score = 0.85 * score

        degree = f"tau={tau:.2f}, len={range_length}/{total_length}"
        return trend_type, degree, score

    def calculate_trends(self):
        if not self.input_data:
            raise ValueError("请先使用 set_input_data 设置输入数据。")

        columns = self.input_data.get("columns", [])
        data_rows = self.input_data.get("data", [])

        if len(columns) < 2 or not data_rows:
            return

        x_name = columns[0]["name"]
        y_names = [col["name"] for col in columns[1:]]

        x_values = [row[x_name] for row in data_rows]
        df_x = pd.DataFrame({"x_data": x_values})
        if not self.check_sequential(df_x, x_name):
            return  # 非时间序列，不生成趋势

        self.trend_facts = []

        for y_col in y_names:
            xy_series = []
            for row in data_rows:
                x_val = row.get(x_name)
                y_val = self._convert_to_numeric(row.get(y_col))
                if y_val is not None:
                    xy_series.append((x_val, y_val))

            if len(xy_series) < 2:
                continue

            # 对 x 排序
            xy_series.sort(key=lambda pair: pair[0])
            x_series_all = [x for x, _ in xy_series]
            y_series_all = [y for _, y in xy_series]

            n = len(xy_series)

            # 枚举所有合法子区间 i < j，生成 trend
            for i in range(n - 1):
                for j in range(i + 1, n):
                    x_sub = x_series_all[i:j+1]
                    y_sub = y_series_all[i:j+1]

                    trend_type, degree, score = self._get_trend_fact(x_sub, y_sub, total_length=n)

                    if score >= self.score_threshold:
                        fact = TrendFact(
                            ref=y_col,
                            range_=(x_sub[0], x_sub[-1]),
                            trend_type=trend_type,
                            degree=degree
                        )
                        fact.score = score
                        self.trend_facts.append(fact)

    def get_trend_facts(self):
        return self.trend_facts