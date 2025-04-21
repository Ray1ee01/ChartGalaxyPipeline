#!/usr/bin/env python3
import os
import shutil
import glob
import argparse

def move_layout_files(layout_dir):
    """
    将layout文件夹下面的{dir}/filename.svg移动到layout下，命名为{dir}.svg
    """
    # 确保layout_dir存在
    if not os.path.isdir(layout_dir):
        print(f"错误: 目录 {layout_dir} 不存在")
        return False
    
    # 获取layout目录下的所有子目录
    subdirs = [d for d in os.listdir(layout_dir) 
               if os.path.isdir(os.path.join(layout_dir, d))]
    
    if not subdirs:
        print(f"警告: {layout_dir} 下没有找到子目录")
        return False
    
    print(f"在 {layout_dir} 下找到 {len(subdirs)} 个子目录")
    
    # 遍历每个子目录
    moved_count = 0
    for subdir in subdirs:
        subdir_path = os.path.join(layout_dir, subdir)
        # 查找子目录中的svg文件
        svg_files = glob.glob(os.path.join(subdir_path, "*.svg"))
        
        if not svg_files:
            print(f"跳过 {subdir}: 未找到SVG文件")
            continue
        
        # 只处理第一个找到的SVG文件
        source_file = svg_files[0]
        # 新文件名为{dir}.svg
        target_file = os.path.join(layout_dir, f"{subdir}.svg")
        
        try:
            shutil.copy2(source_file, target_file)
            print(f"已复制: {source_file} -> {target_file}")
            moved_count += 1
        except Exception as e:
            print(f"移动 {source_file} 到 {target_file} 时出错: {str(e)}")
    
    print(f"完成! 成功移动了 {moved_count} 个文件")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="将layout文件夹下面的子目录中的SVG文件移动到layout并重命名")
    parser.add_argument("layout_dir", help="layout目录的路径")
    
    args = parser.parse_args()
    move_layout_files(args.layout_dir) 