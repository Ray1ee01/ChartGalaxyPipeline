#!/usr/bin/env python3
import os
import sys
import argparse
import glob
import xml.etree.ElementTree as ET

def extract_image_elements(svg_file, output_svg):
    """提取SVG文件中的一级image元素并保存到新文件"""
    try:
        # 解析SVG文件
        tree = ET.parse(svg_file)
        root = tree.getroot()
        
        # 定义SVG命名空间
        ns = {'svg': 'http://www.w3.org/2000/svg'}
        
        # 查找所有一级image元素
        image_elements = root.findall('./svg:image', ns)
        
        if not image_elements:
            print(f"警告: 在 {svg_file} 中未找到一级image元素")
            return False
        
        print(f"在 {svg_file} 中找到 {len(image_elements)} 个一级image元素")
        
        # 创建一个新的SVG，包含所有找到的image元素
        new_root = ET.Element(root.tag, root.attrib)
        
        # 复制defs（如果有的话）
        defs_elements = root.findall('./svg:defs', ns)
        for defs in defs_elements:
            new_root.append(defs)
        
        # 添加所有找到的image元素到新SVG
        for element in image_elements:
            new_root.append(element)
        
        # 保存到新的SVG文件
        new_tree = ET.ElementTree(new_root)
        ET.register_namespace('', 'http://www.w3.org/2000/svg')
        new_tree.write(output_svg)
        
        print(f"成功提取image元素到: {output_svg}")
        return True
        
    except Exception as e:
        print(f"处理 {svg_file} 时出错: {str(e)}")
        return False

def process_svg_files(input_dir, output_dir):
    """处理输入目录中的所有SVG文件"""
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 获取所有SVG文件
    svg_files = glob.glob(os.path.join(input_dir, "*.svg"))
    total_files = len(svg_files)
    
    if total_files == 0:
        print(f"在 {input_dir} 中未找到SVG文件")
        return
    
    print(f"在 {input_dir} 中找到 {total_files} 个SVG文件")
    
    # 统计
    success_count = 0
    skip_count = 0
    error_count = 0
    
    # 处理每个SVG文件
    for svg_file in svg_files:
        base_name = os.path.basename(svg_file)
        output_svg = os.path.join(output_dir, f"images_{base_name}")
        
        try:
            if extract_image_elements(svg_file, output_svg):
                success_count += 1
            else:
                skip_count += 1
        except Exception as e:
            print(f"处理 {svg_file} 时出错: {str(e)}")
            error_count += 1
    
    print(f"\n处理完成:")
    print(f"- 成功提取: {success_count} 文件")
    print(f"- 跳过 (无image元素): {skip_count} 文件")
    print(f"- 错误: {error_count} 文件")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="从SVG文件中提取一级image元素")
    parser.add_argument("input_dir", help="包含SVG文件的输入目录")
    parser.add_argument("output_dir", help="保存输出文件的目录")
    
    args = parser.parse_args()
    process_svg_files(args.input_dir, args.output_dir) 