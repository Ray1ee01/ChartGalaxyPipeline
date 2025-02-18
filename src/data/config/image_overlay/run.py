import json
import os
from itertools import product

def generate_json_files():
    # 定义所有可能的值
    directions = ['top', 'bottom', 'left', 'right']
    sides = ['outside', 'inside', 'half']
    
    # 确保目标目录存在
    output_dir = './'
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成所有可能的组合
    for i, (direction, side) in enumerate(product(directions, sides)):
        data = {
            "direction": direction,
            "side": side
        }
        
        # 创建 JSON 文件
        filename = f"{i}.json"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4)
        
        print(f"Created {filepath}")

if __name__ == "__main__":
    generate_json_files()