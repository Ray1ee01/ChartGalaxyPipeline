import os
import shutil
from pathlib import Path
import argparse

def organize_files(input_dir, output_dir):
    """
    将input_dir目录下的csv和chart文件重新组织到output_dir中
    input_dir结构: dir/csv/{name}.csv 和 dir/chart/{name}.png
    output_dir结构: output_dir/{name}/chart.png 和 data.csv
    """
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    
    # 确保输入目录存在
    if not input_dir.exists():
        raise ValueError(f"输入目录 {input_dir} 不存在")
    
    # 获取所有CSV文件
    csv_dir = input_dir / "csv"
    chart_dir = input_dir / "chart"
    
    if not csv_dir.exists() or not chart_dir.exists():
        raise ValueError("输入目录结构不正确，需要包含csv和chart子目录")
    
    # 处理每个CSV文件
    for csv_file in csv_dir.glob("*.csv"):
        name = csv_file.stem  # 获取文件名（不含扩展名）
        chart_file = chart_dir / f"{name}.png"
        
        if not chart_file.exists():
            print(f"警告: {name}.png 不存在，跳过处理 {name}")
            continue
        
        # 创建输出目录
        name_dir = output_dir / name
        name_dir.mkdir(parents=True, exist_ok=True)
        
        # 复制文件
        shutil.copy2(csv_file, name_dir / "data.csv")
        shutil.copy2(chart_file, name_dir / "chart.png")
        print(f"已处理: {name}")

def main():
    parser = argparse.ArgumentParser(description="文件组织脚本")
    parser.add_argument("input_dir", help="输入目录路径")
    parser.add_argument("output_dir", help="输出目录路径")
    
    args = parser.parse_args()
    
    try:
        organize_files(args.input_dir, args.output_dir)
        print("处理完成！")
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    main()
