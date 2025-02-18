import pandas as pd
import numpy as np
import os
import re
from dateutil import parser
from .icon_selection import CLIPMatcher

# TODO 系数选择
# TODO icon 选择

raw_images_path = '/data1/liduan/generation/chart/iconset/colored_icons_final'

def choose_icons_by_data_fict(self, data_fact_dict: dict):
    """根据 data fact 选择 icon"""
    # TODO 首先构造一些 prompt 去构造 word embedding, 需要使用和构造 feature 相同的预训练模型
    # 而后利用向量搜索找一些最接近的 embedding

    data_fact = list(data_fact_dict.keys())[0]
    parameters = data_fact_dict[data_fact]["parameters"]

    prompts = []
    if data_fact == "trend":
        direction = parameters["direction"]
        if direction == "up":
            prompts.append("Describe an icon representing an upward trend.")
            prompts.append("What symbol indicates growth or increase?")
            prompts.append("An icon that signifies a rising trend.")
            prompts.append("Illustration of a positive movement or upward direction.")
            prompts.append("Icon depicting an increase or improvement.")
            prompts.append("Representing a trend in the upward direction.")
            prompts.append("An icon showing an upward trajectory.")
        elif direction == "down":
            # prompts.append("Describe an icon representing a downward trend.")
            # prompts.append("What symbol indicates decline or decrease?")
            # prompts.append("An icon that signifies a falling trend.")
            # prompts.append("Illustration of a negative movement or downward direction.")
            # prompts.append("Icon depicting a decrease or downturn.")
            # prompts.append("Representing a trend in the downward direction.")
            # prompts.append("Downstair")
            prompts.append("valey")
        else:
            raise KeyError(f"The direction parameter {direction} of trend data fact is unknown.")
    elif data_fact == "maximum":
        prompts.append("An icon that describe the largest value.")
        # prompts.append("What represents the maximum or greatest value?")
        # prompts.append("An icon indicating the top or maximum threshold.")
        # prompts.append("Illustration of the highest possible point.")
        # prompts.append("Representing the upper limit or maximum capacity.")
        # prompts.append("Icon for the peak or maximum level.")
        prompts.append("An icon that describe the winner.")
        prompts.append("An icon that describe the champion.")
        prompts.append("An icon that describe the best one.")
        prompts.append("An icon that describe the very good one.")
        # prompts.append("medal")
        # prompts.append("like")
    elif data_fact == "minimum":
        prompts.append("Icon symbolizing the lowest point or bottom.")
        # prompts.append("What represents the minimum or smallest value?")
        # prompts.append("An icon indicating the bottom or minimum threshold.")
        # prompts.append("Illustration of the lowest possible point.")
        # prompts.append("Representing the lower limit or minimum capacity.")
        # prompts.append("Icon for the bottom or minimum level.")
        prompts.append("Icon symbolizing the loser.")
        prompts.append("Icon symbolizing the worst.")
        prompts.append("Icon symbolizing the bottom.")
        prompts.append("Icon symbolizing the very bad one.")
        prompts.append("cry")
        prompts.append("sad")
    else:
        raise KeyError(f"Unknown data fact {data_fact}.")

    matcher = CLIPMatcher()
    idxes = matcher.find_icon_by_prompts(prompts, self.topk)
    indices = idxes[1].flatten()
    icons = matcher.get_icon(indices)

    return icons


class DataFactDetector:
    """检测一个 chart 中包含哪些 data facts"""
    def __init__(self, significance_threshold=0.5, sequential_threshold=1, topk=20):
        self.significance_threshold = significance_threshold # 用于判定 data fact 是否足够重要
        self.sequential_threshold = sequential_threshold # 用于判定时序数据值占比至少多少时被认为是时序序列
        self.topk = topk

    def is_sequential_value(self, val):
        """
        判断单个值是否具备时序/日期特征
        """
        if isinstance(val, (int, float)):
            try:
                num = float(val)
            except Exception:
                return False
            # 年份范围
            if 1000 <= num <= 3000:
                return True
            # 月份范围
            if 1 <= num < 13:
                return True
            return False

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
                if re.match(pat, s, re.IGNORECASE): # 大小写忽略
                    return True
                
            # 针对含有范围形式的字符串，如 "1500-1600" 或 "1900-2014"
            if re.search(r"\d+\s*(-|~)\s*\d+", s):
                # 将字符串按空格拆分后逐个检查包含 '-' 的部分
                parts = re.split(r"\s+", s)
                valid_range = True
                for part in parts:
                    if '-' in part or '~' in part:
                        if '-' in part:
                            subparts = part.split('-')
                        elif '~' in part:
                            subparts = part.split('-')
                        if len(subparts) == 2:
                            try:
                                n1 = float(subparts[0])
                                n2 = float(subparts[1])
                                # 如果两个数字都看起来像年份或都在1-12内，则认为合理
                                if ((1000 <= n1 <= 3000) and (1000 <= n2 <= 3000)) or ((1 <= n1 <= 12) and (1 <= n2 <= 12)):
                                    continue
                                else:
                                    valid_range = False
                            except Exception:
                                valid_range = False
                        else:
                            valid_range = False
                if valid_range:
                    return True
                
            # 年龄特判
            age_range_patterns = [
                r"^\d+\s*-\s*\d+\s*(年|years?)$", # "5-20年"
                r"^(under|above)\s*\d+$", # "under 15"
                r"^\d{1,2}\s*(-|~)\s*\d{1,2}$", # 匹配年龄区间：如 "16-18"
            ]
            for pat in age_range_patterns:
                if re.match(pat, s, re.IGNORECASE):
                    return True

            # 如果字符串由多个 token 组成（例如 "JAN May" 或 "1 year 5-20 year"），逐个判断 token
            tokens = re.split(r"\s+", s)
            valid_tokens = 0
            for token in tokens:
                # 如果 token 与上面定义的正则表达式之一匹配，则认为有效
                for pat in patterns:
                    if re.match(pat, token, re.IGNORECASE):
                        valid_tokens += 1
                        break
                else:
                    # 尝试用 dateutil 解析
                    try:
                        parser.parse(token, fuzzy=False)
                        valid_tokens += 1
                    except Exception:
                        # 看是否为数字且在合理范围内
                        try:
                            num = float(token)
                            if (1000 <= num <= 3000) or (1 <= num <= 12):
                                valid_tokens += 1
                        except Exception:
                            pass
            # 如果超过一半 token 被认为有效，则认为该值符合时序特征
            if valid_tokens >= len(tokens) / 2:
                return True

            return False
        else:
            return False

    def check_sequential(self, df: pd.DataFrame, x_label):
        """判别数据是否满足时序特征"""
        if isinstance(x_label, str):
            label_lower = x_label.lower()
            sequential_keywords = [
                "month", "day", "year", "festival", "age range", "week", "quarter", "generation",
                "季", "月", "日", "年", "节", "年龄", "季度"
            ]
            for keyword in sequential_keywords:
                if keyword in label_lower:
                    return True
        
        x_data = df['x_data']
        sequential_count = 0
        total_count = 0

        num_flag = True

        for value in x_data:
            if not (isinstance(value, float) or isinstance(value, int)):
                num_flag = False
            total_count += 1
            if self.is_sequential_value(value):
                sequential_count += 1

        if num_flag: # 补充一条规则，如果数据彼此非常接近，那么很可能不是时间序列
            if max(x_data.tolist()) - min(x_data.tolist()) <= 3:
                return False 

        if total_count > 0 and sequential_count / total_count >= self.sequential_threshold:
            return True
        else:
            return False
        
    def choose_allowed_data_facts(self, chart_data: dict, chart_type: str) -> None:
        """根据图表类型、数据类型，选择合法的 data facts"""
        self.allowed_data_facts = []

        meta_data = chart_data["meta_data"]
        data = chart_data["data"]
        
        # x_type = meta_data["x_type"]
        # y_type = meta_data["y_type"]

        x_label = meta_data["x_label"]
        df = pd.DataFrame(data, columns=data[0])

        allow_sequential_chart_types = [
            "bar", "line", "scatter", "groupbar", "slope", "connectedscatter", "stackedbar",
        ]

        # if chart_type == "bar":
        #     if x_type == "temporal":
        #         self.allowed_data_facts.append("trend")
        #     self.allowed_data_facts.append("maximum")
        #     self.allowed_data_facts.append("minimum")

        # elif chart_type == "line":

        # elif chart_type == "scatter":
        #     if x_type == "temporal":
        #         pass
        #     else:
        #         pass

        # print(x_type)

        if chart_type in allow_sequential_chart_types and self.check_sequential(df, x_label):
            self.allowed_data_facts.append("trend")
        self.allowed_data_facts.append("maximum")
        self.allowed_data_facts.append("minimum")
    
    def set_data_facts_score(self, data) -> None:
        """对于每个 group, 为其中每个 data fact 计算重要性分数"""

        """
        TODO 定义一个类还是保持 list?
        应该形如
        {
            "group1": {
                "datafact1": {
                    score: 0.1,
                    parameters: {
                        例如：上升/下降，最大值/最小值，值是多少
                    }
                },
                "datafact2": {}
            }
            "group2": {
                "datafact1": {},
                "datafact2": {}
            }
        }
        """
        self.data_fact_scores = {}

        df = pd.DataFrame(data, columns=data[0])

        group_list = df["group"].unique().tolist() # 数据中所有 group 名称
        for group in group_list:
            sub_df = df[df["group"] == group]
            self.data_fact_scores[group] = {}

            for data_fact in self.allowed_data_facts:
                func_name = f"get_{data_fact}_fact"
                func = getattr(self, func_name, None)

                if callable(func):
                    data_fact_dict = {
                        data_fact: func(sub_df)
                    }
                    self.data_fact_scores[group].update(data_fact_dict)
                else:
                    raise NotImplementedError
    
    def get_trend_fact(self, df: pd.DataFrame) -> dict:
        """传进所有 data 中的一组，返回其对应的 trend fact 信息"""
        # TODO 如果要考虑先下降后上升/先上升后下降，可以考虑选择一个断点后两次 mk 检验

        # Mann-Kendall 检验
        def mann_kendall_test(x: np.ndarray, y: np.ndarray):
            n = len(y)
            if n < 2:
                return 0
            
            sort_idx = np.argsort(x)
            x = x[sort_idx]
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

        # 排序
        df_sorted = df.sort_values(by='x_data').reset_index(drop=True)

        x_data = df_sorted['x_data'].values
        y_data = df_sorted['y_data'].values

        tau = mann_kendall_test(x_data, y_data)

        if tau > 0:
            direction = "up"
        elif tau < 0:
            direction = "down"
        else:
            direction = "no"

        score = abs(tau)

        return_dict = {
            "score": score,
            "parameters": {
                "direction": direction
            }
        }
        return return_dict

    def get_maximum_fact(self, df: pd.DataFrame) -> dict:
        """传进所有 data 中的一组，返回其对应的 maximumm fact 信息"""
        # 利用正态分布 Z 分数的单侧检验
        y = df["y_data"].values
        n = len(y)
        if n < 2:
            return {
                "score": 0,
                "parameters": {
                    "value": df["y_data"][0] if n == 1 else None,
                    "idx": 0 if n == 1 else None
                }
            }
        mean_y = np.mean(y)
        std_y = np.std(y, ddof=1)

        if abs(std_y) < 1e-15:
            # 差异过小
            return {
                "score": 0,
                "parameters": {
                    "value": float(np.max(y)),
                    "idx": np.argmax(y)
                }
            }
        
        max_val = np.max(y)
        z_max = (max_val - mean_y) / std_y
        
        score_max = z_max / (1 + z_max)

        return {
            "score": score_max,
            "parameters": {
                "value": float(max_val),
                "idx": np.argmax(y)
            }
        }
    
    def get_minimum_fact(self, df: pd.DataFrame) -> dict:
        y = df["y_data"].values
        n = len(y)
        if n < 2:
            return {
                "score": 0,
                "parameters": {
                    "value": df["y_data"][0] if n == 1 else None,
                    "idx": 0 if n == 1 else None
                }
            }
        mean_y = np.mean(y)
        std_y = np.std(y, ddof=1)

        if abs(std_y) < 1e-15:
            # 差异过小
            return {
                "score": 0,
                "parameters": {
                    "value": float(np.max(y)),
                    "idx": np.argmin(y)
                }
            }
        
        min_val = np.min(y)
        z_min = (min_val - mean_y) / std_y

        score_min = - z_min / (1 - z_min)

        return {
            "score": score_min,
            "parameters": {
                "value": float(min_val),
                "idx": np.argmin(y)
            }
        }
    
    def select_icon(self, data_fact_dict: dict):
        """将已经存储好的 icons 取出来"""
        icons_base_path = "/data1/lizhen/data_fact_icon"
        data_fact = list(data_fact_dict.keys())[0]
        parameters = data_fact_dict[data_fact]["parameters"]

        if data_fact == "trend":
            direction = parameters["direction"]
            if direction == "up":
                directory = "trend_up"
            elif direction == "down":
                directory = "trend_down"
            else:
                raise KeyError(f"The direction parameter {direction} of trend data fact is unknown.")
        elif data_fact == "maximum":
            directory = "maximum"
        elif data_fact == "minimum":
            directory = "minimum"
        else:
            raise KeyError(f"Unknown data fact {data_fact}.")
        
        icons_path = os.path.join(icons_base_path, directory, "final")

        icons = [os.path.abspath(os.path.join(icons_path, f)) 
             for f in os.listdir(icons_path) if f.endswith('.png')]
        
        return icons
    
    def detect_data_facts(self, chart_data: dict, chart_type: str) -> dict:
        data = chart_data["data"]

        self.choose_allowed_data_facts(chart_data, chart_type) # set self.allowed_data_facts

        # print(self.allowed_data_facts)

        self.set_data_facts_score(data)

        # print(self.data_fact_scores)

        max_score = 0
        group_icons = {}

        for group in self.data_fact_scores.keys():
            max_score = float('-inf')
            
            for key in self.data_fact_scores[group].keys():
                max_score = max(max_score, self.data_fact_scores[group][key]["score"])

            max_score_keys = [
                key for key in self.data_fact_scores[group].keys()
                if self.data_fact_scores[group][key]["score"] == max_score
            ]

            # 只保留一个最大分数的 key
            if len(max_score_keys) > 1:
                max_score_keys = max_score_keys[:1]

            # 删除其他分数小于阈值的 key
            keys_to_delete = [
                key for key in self.data_fact_scores[group].keys()
                if self.data_fact_scores[group][key]["score"] < max(max_score, self.significance_threshold)
            ]
            
            for key in keys_to_delete:
                del self.data_fact_scores[group][key]

            remaining_keys = list(self.data_fact_scores[group].keys())

            selected_icon = self.select_icon(self.data_fact_scores[group]) if remaining_keys else ""
            group_icons[group] = selected_icon

        return self.data_fact_scores, group_icons

# if __name__ == "__main__":
#     dfd = DataFactDetector()
    
#     base_path = "/data1/liduan/generation/chart/chart_pipeline/src/data/chart_to_table/stackedbar"
    
#     for file_name in os.listdir(base_path):
#         if file_name.endswith(".csv"):
#             file_path = os.path.join(base_path, file_name)
#             with open(file_path, "r", encoding="utf-8") as f:
#                 header_line = f.readline().strip().split(',')
#             original_x_label = header_line[0]
            
#             df = pd.read_csv(file_path)

#             columns = df.columns.tolist()
#             if len(columns) >= 2:
#                 columns[0] = "x_data"
#                 columns[1] = "y_data"
#             else:
#                 columns[0] = "x_data"
#             df.columns = columns

#             # print(original_x_label)
#             # print(df)
#             # exit()
            
#             is_sequential = dfd.check_sequential(df, original_x_label)
            
#             print(f"File: {file_name}")
#             print(original_x_label)
#             print(df["x_data"][1])
#             print(f"  Is sequential? {is_sequential}\n")