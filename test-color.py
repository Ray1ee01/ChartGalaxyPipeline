from src.template.color_framework import ColorFramework
from src.template.color_template_v2 import ColorDesign
from src.utils.global_state import test_c2t_root
import os, json

data_file = os.path.join(test_c2t_root, "127.json")
data_info = json.load(open(data_file, 'r'))
print(data_info)

# 1. from data to schemes
cf = ColorFramework(data_info)
schemes = cf.load_scheme_list()
print('get schemes:', schemes)

# 2. from schemes to retrieve palette
palette = cf.get_infographic_palette(0) # index of selected scheme
print('get palette:', palette)

# 3. from palette to color design
cde = ColorDesign(palette, lighter='high')
print(cde.get_color('marks', 5))
{'mode': 'colorful', 'color_list': ['#4ECBEE', '#FFB51F', '#DC776A', '#3465B1'], 'main_color': ['#4ECBEE', '#FFB51F', '#DC776A', '#3465B1'], 'bcg': '#F2EDEE', 'context_colors': ['#AFAFAF', '#86988B', '#EFDEBA', '#596873', '#2F4455'], 'similar_to_bcg': [], 'other_colors': []}
colors = ['#db776a', '#f98f4e', '#feb51f', '#57d68e', '#4ecbee']
# 建议调试时每一步都可以加cache
# 调用了 1+n 次大模型 所以多次实验可能会有不同结果

# 如果v2 palette 有一些结果不好，可以尝试切换为v3，修改global_state.py中的color_cache_path