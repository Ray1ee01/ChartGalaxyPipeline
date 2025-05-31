import os
import json
import shutil
import random
from collections import defaultdict

def process_folders(input_dir, output_dir):
    """
    扫描输入目录下的所有子文件夹，处理chart.png图片并重命名后复制到输出目录
    对于同一个chart_variation超过10个的情况，随机采样10个
    """
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 用于按chart_variation分组的字典
    variation_groups = defaultdict(list)
    
    # 扫描所有子文件夹
    for subdir, _, files in os.walk(input_dir):
        # 检查当前子文件夹是否包含需要的文件
        if 'info.json' in files and 'chart.svg' in files:
            try:
                # 读取info.json
                with open(os.path.join(subdir, 'info.json'), 'r') as f:
                    info = json.load(f)
                
                # 提取需要的信息
                chart_type = info.get('chart_type', '')
                chart_variation = info.get('chart_variation', '')
                
                if chart_type and chart_variation:
                    # 保存路径和相关信息
                    variation_groups[(chart_type, chart_variation)].append({
                        'source_path': os.path.join(subdir, 'chart.svg'),
                        'source_data': os.path.join(subdir, 'data.json'),
                        'chart_type': chart_type,
                        'chart_variation': chart_variation
                    })
            except (json.JSONDecodeError, FileNotFoundError) as e:
                print(f"处理文件夹 {subdir} 时出错: {str(e)}")
    
    # 处理每个variation组
    for (chart_type, chart_variation), items in variation_groups.items():
        # 如果超过5个，随机采样5个
        if len(items) > 8:
            selected_items = random.sample(items, 8)
        else:
            selected_items = items
            
        # 复制并重命名文件
        for i, item in enumerate(selected_items):
            source_path = item['source_path']
            source_data = item['source_data']
            
            # 读取SVG文件内容
            try:
                with open(source_path, 'r') as f:
                    svg_content = f.read()
                    
                # 计算<image标签数量
                image_count = svg_content.count('<image')
                if image_count < 10:
                    print(f"跳过 {source_path}: 图片数量({image_count})小于10")
                    continue
                    
                new_filename = f"{chart_type}_{chart_variation}_{i+1}.svg"
                dest_path = os.path.join(output_dir, new_filename)

                new_data_filename = f"{chart_type}_{chart_variation}_{i+1}.json"
                dest_data_path = os.path.join(output_dir, new_data_filename)
                
                shutil.copy2(source_path, dest_path)
                shutil.copy2(source_data, dest_data_path)
                print(f"已复制: {new_filename} 和 {new_data_filename}")
            except Exception as e:
                print(f"处理文件 {source_path} 时出错: {str(e)}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='处理图表图片并重命名复制到输出目录')
    parser.add_argument('input_dir', help='包含子文件夹的输入目录')
    parser.add_argument('--output_dir', default='all', help='输出目录，默认为"all"')
    
    args = parser.parse_args()
    
    process_folders(args.input_dir, args.output_dir)
    print("处理完成!")
    