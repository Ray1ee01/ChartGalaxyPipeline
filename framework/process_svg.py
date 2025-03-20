#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import re
import sys
import random
import base64
from lxml import etree
from glob import glob

# 随机标题文本列表
TITLE_TEXTS = [
    "企业经营数据可视化分析报告",
    "年度销售业绩趋势图表展示",
    "重点业务板块数据概览分析",
    "系统性能指标实时监控面板",
    "季度营销效果统计数据分析",
    "产品质量监测性能评估图表",
    "区域市场销售业绩对比统计",
    "用户行为与市场份额分析报告",
    "新增用户与活跃度增长趋势图",
    "互联网行业发展趋势预测分析"
]

def process_svg_file(svg_file_path):
    """处理SVG文件，添加结构和元素"""
    
    print(f"处理文件: {svg_file_path}")
    
    # 读取SVG文件
    parser = etree.XMLParser(remove_blank_text=True)
    tree = etree.parse(svg_file_path, parser)
    root = tree.getroot()
    
    # 获取SVG的宽度和高度
    width = root.get("width")
    height = root.get("height")
    if width is None or height is None:
        width = "800"
        height = "600"
    
    # 转换为数值以便计算
    try:
        width_val = int(width.replace("px", ""))
        height_val = int(height.replace("px", ""))
    except (ValueError, AttributeError):
        width_val = 800
        height_val = 600
    
    # 步骤1: 创建一个新的g元素，将所有一级子元素移入其中
    chart_group = etree.Element("{http://www.w3.org/2000/svg}g", attrib={"class": "chart"})
    
    # 将所有一级子元素移到新的g元素中
    children = list(root)
    for child in children:
        root.remove(child)
        chart_group.append(child)
    
    # 将g元素添加到SVG根元素
    root.append(chart_group)
    
    # 步骤2: 随机生成一段文本作为标题
    title_text = random.choice(TITLE_TEXTS)
    title_element = etree.Element("{http://www.w3.org/2000/svg}text", 
                                  attrib={
                                      "class": "title",
                                      "x": str(width_val // 2),
                                      "y": "40",
                                      "text-anchor": "middle",
                                      "font-size": "28px",
                                      "font-family": "Arial, sans-serif",
                                      "font-weight": "bold",
                                      "fill": "#333"
                                  })
    title_element.text = title_text
    root.append(title_element)
    
    # 步骤3: 随机选择一个图标并添加到SVG中
    try:
        # 获取图标目录中的所有PNG文件
        icon_dir = os.path.expanduser("~/chartdata/scatter_data/icons")
        icon_files = glob(os.path.join(icon_dir, "*.png"))
        
        if icon_files:
            # 随机选择一个图标
            random_icon = random.choice(icon_files)
            
            # 读取图标文件
            with open(random_icon, "rb") as f:
                icon_data = f.read()
            
            # 转换为base64编码
            icon_base64 = base64.b64encode(icon_data).decode('utf-8')
            
            # 创建图像容器
            image_group = etree.Element("{http://www.w3.org/2000/svg}g", attrib={"class": "image"})
            
            # 创建图像元素
            image_element = etree.Element("{http://www.w3.org/2000/svg}image", 
                                         attrib={
                                             "x": "20",
                                             "y": "20",
                                             "width": "80",
                                             "height": "80",
                                             "preserveAspectRatio": "xMidYMid meet",
                                             "href": f"data:image/png;base64,{icon_base64}"
                                         })
            
            # 将图像添加到图像组，并将组添加到SVG
            image_group.append(image_element)
            root.append(image_group)
            
            # 输出使用的图标文件名
            icon_name = os.path.basename(random_icon)
            print(f"已添加图标: {icon_name}")
            
        else:
            print("未找到图标文件")
            
    except Exception as e:
        print(f"添加图标时出错: {str(e)}")
    
    # 保存修改后的SVG
    tree.write(svg_file_path, pretty_print=True, encoding="utf-8", xml_declaration=True)
    print(f"已成功处理并保存文件: {svg_file_path}")
    
    return True

def main():
    """主函数"""
    
    # 检查命令行参数
    if len(sys.argv) > 1:
        svg_file = sys.argv[1]
        if os.path.exists(svg_file) and svg_file.lower().endswith('.svg'):
            process_svg_file(svg_file)
        else:
            print(f"错误: 文件不存在或不是SVG文件: {svg_file}")
    else:
        # 查找tmp目录中的最新SVG文件
        tmp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmp")
        if os.path.exists(tmp_dir) and os.path.isdir(tmp_dir):
            svg_files = glob(os.path.join(tmp_dir, "*.svg"))
            if svg_files:
                # 按修改时间排序，获取最新的文件
                latest_svg = max(svg_files, key=os.path.getmtime)
                process_svg_file(latest_svg)
            else:
                print("未找到SVG文件")
        else:
            print("tmp目录不存在")

if __name__ == "__main__":
    main() 