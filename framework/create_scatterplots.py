import os
import json
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path
import shutil

def has_negative_or_zero_values(data, field):
    """检查数据是否包含负值或0值"""
    return any(d[field] <= 0 for d in data)

def is_distribution_uneven(data, field):
    """判断数据分布是否不均匀"""
    values = [d[field] for d in data]
    values.sort()
    
    extent = [min(values), max(values)]
    range_val = extent[1] - extent[0]
    
    median = np.median(values)
    q1 = np.percentile(values, 25)
    q3 = np.percentile(values, 75)
    iqr = q3 - q1
    
    # 不均匀分布的判断标准
    return range_val > iqr * 3 or abs(median - (extent[0] + extent[1])/2) > range_val * 0.2

def create_scatterplot(data_json, output_dir, dir_name):
    """创建散点图并保存"""
    # 获取数据
    chart_data = data_json['data']
    columns = data_json['columns']
    
    # 获取三个列的名称
    label_field = columns[0]['name']  # 散点名称
    x_field = columns[1]['name']      # x轴
    y_field = columns[2]['name']      # y轴
    
    # 创建数据框
    df = pd.DataFrame(chart_data)
    
    # 确定坐标轴类型
    x_has_negative_or_zero = has_negative_or_zero_values(chart_data, x_field)
    x_is_uneven = is_distribution_uneven(chart_data, x_field)
    
    y_has_negative_or_zero = has_negative_or_zero_values(chart_data, y_field)
    y_is_uneven = is_distribution_uneven(chart_data, y_field)
    
    # 创建图表
    fig, ax = plt.figure(figsize=(10, 8)), plt.gca()
    
    # 设置坐标轴类型
    if not x_has_negative_or_zero and x_is_uneven:
        ax.set_xscale('log')
    
    if not y_has_negative_or_zero and y_is_uneven:
        ax.set_yscale('log')
    
    # 绘制散点图
    scatter = ax.scatter(df[x_field], df[y_field], s=100, alpha=0.7)
    
    # 添加标签
    for i, txt in enumerate(df[label_field]):
        ax.annotate(txt, (df[x_field].iloc[i], df[y_field].iloc[i]), 
                   xytext=(5, 5), textcoords='offset points')
    
    # 添加坐标轴标签和标题
    ax.set_xlabel(x_field)
    ax.set_ylabel(y_field)
    ax.set_title(f'散点图 - {dir_name}')
    
    # 添加网格线
    ax.grid(True, alpha=0.3)
    
    # 保存图表
    output_path = os.path.join(output_dir, f'{dir_name}_scatterplot.png')
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    
    print(f"已创建散点图: {output_path}")
    
    # 返回坐标轴类型信息和输出路径
    return {
        'x_axis': 'log' if not x_has_negative_or_zero and x_is_uneven else 'linear',
        'y_axis': 'log' if not y_has_negative_or_zero and y_is_uneven else 'linear',
        'output_path': output_path
    }

def copy_files_with_prefix(index, dir_path, scatterplot_path, target_dir):
    """复制文件到目标目录并添加索引前缀"""
    # 确保目标目录存在
    os.makedirs(target_dir, exist_ok=True)
    
    # 获取要复制的文件路径
    chart_png_path = os.path.join(dir_path, 'chart.png')
    data_json_path = os.path.join(dir_path, 'data.json')
    svg_path = os.path.join(dir_path, 'chart.svg')
    
    # 创建带索引前缀的目标文件名
    prefix = f"{index:03d}_"
    target_chart_png = os.path.join(target_dir, f"{prefix}chart.png")
    target_data_json = os.path.join(target_dir, f"{prefix}data.json")
    target_scatterplot = os.path.join(target_dir, f"{prefix}scatterplot.png")
    target_svg = os.path.join(target_dir, f"{prefix}chart.svg")
    # 复制文件
    if os.path.exists(chart_png_path):
        shutil.copy2(chart_png_path, target_chart_png)
        print(f"已复制: {target_chart_png}")
    else:
        print(f"文件不存在: {chart_png_path}")
    
    if os.path.exists(data_json_path):
        shutil.copy2(data_json_path, target_data_json)
        print(f"已复制: {target_data_json}")
    else:
        print(f"文件不存在: {data_json_path}")
    
    if os.path.exists(scatterplot_path):
        shutil.copy2(scatterplot_path, target_scatterplot)
        print(f"已复制: {target_scatterplot}")
    else:
        print(f"文件不存在: {scatterplot_path}")

    if os.path.exists(svg_path):
        shutil.copy2(svg_path, target_svg)
        print(f"已复制: {target_svg}")
    else:
        print(f"文件不存在: {svg_path}")

def main():
    base_dir = 'output/scatter'
    output_dir = 'output/scatter_plots'
    current_scatter_dir = 'scatter'  # 当前目录下的scatter文件夹
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(current_scatter_dir, exist_ok=True)
    
    # 记录处理结果
    results = []
    
    # 获取所有有效目录
    valid_dirs = []
    for dir_name in os.listdir(base_dir):
        dir_path = os.path.join(base_dir, dir_name)
        
        # 检查是否是目录
        if not os.path.isdir(dir_path):
            continue
        
        # 检查是否包含data.json
        data_json_path = os.path.join(dir_path, 'data.json')
        if not os.path.exists(data_json_path):
            continue
            
        valid_dirs.append((dir_name, dir_path))
    
    # 处理每个目录
    for index, (dir_name, dir_path) in enumerate(valid_dirs):
        # 读取data.json
        data_json_path = os.path.join(dir_path, 'data.json')
        with open(data_json_path, 'r', encoding='utf-8') as f:
            try:
                data_json = json.load(f)
            except json.JSONDecodeError:
                print(f"无法解析JSON文件: {data_json_path}")
                continue
        
        # 创建散点图
        axis_info = create_scatterplot(data_json, output_dir, dir_name)
        
        # 复制文件到当前目录下的scatter文件夹
        copy_files_with_prefix(index + 1, dir_path, axis_info['output_path'], current_scatter_dir)
        
        # 记录结果
        results.append({
            'directory': dir_name,
            'x_axis_type': axis_info['x_axis'],
            'y_axis_type': axis_info['y_axis']
        })
    
    # 保存处理结果
    results_df = pd.DataFrame(results)
    results_df.to_csv(os.path.join(output_dir, 'scatterplot_results.csv'), index=False)
    print(f"已处理 {len(results)} 个目录，结果保存在 {os.path.join(output_dir, 'scatterplot_results.csv')}")

if __name__ == "__main__":
    main() 