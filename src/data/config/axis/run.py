import json
import itertools
from pathlib import Path

# 定义所有可能的属性
properties = ['has_domain', 'has_tick', 'has_label', 'has_title', 'has_grid']

# 创建输出目录
output_dir = Path('src/data/config/axis')
output_dir.mkdir(parents=True, exist_ok=True)

# 生成所有可能的组合
for i, combination in enumerate(itertools.product([True, False], repeat=len(properties))):
    # 创建配置字典
    config = dict(zip(properties, combination))
    
    # 将配置保存为JSON文件
    output_file = output_dir / f'{i}.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=4)
    
    print(f'已生成文件 {i}.json: {config}')

print(f'总共生成了 {2**len(properties)} 个文件')