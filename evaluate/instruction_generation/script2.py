#!/usr/bin/env python3
import os
from pathlib import Path
import pandas as pd
import shutil
import random
import argparse

def scan_directory(input_dir):
    # 存储结果的列表
    results = []
    
    # 遍历目录
    for item in os.listdir(input_dir):
        item_path = os.path.join(input_dir, item)
        
        # 检查是否是目录
        if os.path.isdir(item_path):
            # 构建data.csv的完整路径
            csv_path = os.path.join(item_path, 'data.csv')
            chart_path = os.path.join(item_path, 'chart.png')
            
            # 如果data.csv存在
            if os.path.exists(csv_path):
                # 获取文件大小（以字节为单位）
                file_size = os.path.getsize(csv_path)
                results.append({
                    'directory': item,
                    'file_size': file_size,
                    'file_size_mb': round(file_size / (1024 * 1024), 2),  # 转换为MB
                    'csv_path': csv_path,
                    'chart_path': chart_path
                })
    
    # 转换为DataFrame并排序
    if results:
        df = pd.DataFrame(results)
        df = df.sort_values('file_size', ascending=False)
        return df
    return None

def sample_and_copy_files(df, size_min, size_max, sample_size, output_dir):
    # 筛选符合大小范围的文件
    filtered_df = df[df['file_size'].between(size_min, size_max)]
    
    if len(filtered_df) == 0:
        print(f"没有找到大小在 {size_min}-{size_max} 字节范围内的文件")
        return
    
    # 如果符合条件的文件少于要求的采样数量，使用所有文件
    actual_sample_size = min(sample_size, len(filtered_df))
    
    # 随机采样
    sampled_df = filtered_df.sample(n=actual_sample_size, random_state=42)
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    # 复制文件
    for idx, row in sampled_df.iterrows():
        # 创建新的子目录
        new_dir = os.path.join(output_dir, row['directory'])
        os.makedirs(new_dir, exist_ok=True)
        
        # 复制CSV文件
        if os.path.exists(row['csv_path']):
            shutil.copy2(row['csv_path'], os.path.join(new_dir, 'data.csv'))
        
        # 复制PNG文件
        if os.path.exists(row['chart_path']):
            shutil.copy2(row['chart_path'], os.path.join(new_dir, 'chart.png'))
    
    print(f"\n已完成采样和复制：")
    print(f"- 采样数量: {actual_sample_size}")
    print(f"- 输出目录: {output_dir}")
    return sampled_df

def main():
    # 设置命令行参数
    parser = argparse.ArgumentParser(description='扫描目录并按文件大小采样复制文件')
    parser.add_argument('--input_dir', required=True, help='输入目录路径')
    parser.add_argument('--output_dir', required=True, help='输出目录路径')
    args = parser.parse_args()
    
    if not os.path.exists(args.input_dir):
        print(f"错误：输入目录 '{args.input_dir}' 不存在")
        return
    
    results = scan_directory(args.input_dir)
    
    if results is not None:
        print("\n文件大小排序结果：")
        print("=" * 50)
        for _, row in results.iterrows():
            print(f"目录: {row['directory']}")
            print(f"文件大小: {row['file_size_mb']} MB")
            print("-" * 50)
        
        # 采样并复制文件
        sampled = sample_and_copy_files(
            results,
            size_min=200,      # 最小文件大小（字节）
            size_max=15000,    # 最大文件大小（字节）
            sample_size=5000,  # 采样数量
            output_dir=args.output_dir
        )
    else:
        print("未找到任何data.csv文件")

if __name__ == "__main__":
    main()
