import os
import json
from collections import Counter

# 读取所有子目录下的info.json文件
base_dir = "output/0422debug"
combinations = []
variations = []

# 遍历所有子目录
for sub_dir in os.listdir(base_dir):
    info_path = os.path.join(base_dir, sub_dir, "info.json")
    if os.path.exists(info_path):
        try:
            with open(info_path, 'r') as f:
                info = json.load(f)
                # 获取三个字段的组合
                combo = (
                    info.get('chart_variation', ''),
                    info.get('title_to_chart', ''),
                    info.get('image_to_chart', '')
                )
                combinations.append(combo)
                # 收集variation
                variations.append(info.get('chart_variation', ''))
        except Exception as e:
            pass

# 使用Counter统计组合出现次数
combo_counts = Counter(combinations)
variation_counts = Counter(variations)

print("组合统计结果:")

print(f"总共有 {len(combo_counts)} 种不同组合")

print(f"总共有 {len(variation_counts)} 种不同variation")

