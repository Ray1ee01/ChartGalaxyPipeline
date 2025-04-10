import json
import os
import sys
from typing import Dict, Optional, List, Tuple, Set, Union
from logging import getLogger
import logging
import random
from lxml import etree
import subprocess
from PIL import Image
import time
import numpy as np
from numpy.lib.stride_tricks import as_strided

# 创建tmp目录（如果不存在）
os.makedirs("tmp", exist_ok=True)

# 配置日志
logger = getLogger(__name__)
logger.setLevel(logging.INFO)

# 移除所有现有的处理器
for handler in logger.handlers[:]:
    logger.removeHandler(handler)

# 创建文件处理器
file_handler = logging.FileHandler('tmp/log.txt')
file_handler.setLevel(logging.INFO)

# 创建格式化器
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)

# 添加处理器到logger
logger.addHandler(file_handler)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.chart_engine.chart_engine import load_data_from_json, get_template_for_chart_name, render_chart_to_svg
from modules.chart_engine.template.template_registry import scan_templates
from modules.title_styler.title_styler import process as title_styler_process
from modules.infographics_generator.mask_utils import calculate_mask, calculate_content_height
from modules.infographics_generator.svg_utils import extract_svg_content, remove_large_rects
from modules.infographics_generator.image_utils import find_best_size_and_position
from modules.infographics_generator.template_utils import (
    analyze_templates,
    check_template_compatibility,
    select_template,
    process_template_requirements,
    get_unique_fields_and_types
)
from modules.infographics_generator.data_utils import process_temporal_data, process_numerical_data

padding = 50
between_padding = 25
grid_size = 5

def assemble_infographic(
    title_svg_content: str,
    chart_svg_content: str,
    chart_width: int,
    chart_height: int,
    padding: int,
    between_padding: int,
    primary_image: Optional[str] = None
) -> Tuple[str, np.ndarray, int]:
    """
    组装信息图，计算mask和位置，生成最终SVG
    
    Args:
        title_svg_content: 标题SVG内容
        chart_svg_content: 图表SVG内容
        chart_width: 图表宽度
        chart_height: 图表高度
        padding: 边界padding
        between_padding: 元素之间的padding
        primary_image: 可选的主图片base64内容
        
    Returns:
        Tuple[str, np.ndarray, int]: (最终SVG内容, mask数组, 总高度)
    """
    # 计算标题mask和实际高度
    title_mask = calculate_mask(title_svg_content, chart_width + padding * 2, padding * 4)
    title_start, title_end, actual_title_height = calculate_content_height(title_mask)
    
    # 计算图表mask和实际高度
    chart_mask = calculate_mask(chart_svg_content, chart_width + padding * 2, chart_height + padding * 2)
    chart_start, chart_end, actual_chart_height = calculate_content_height(chart_mask)
    chart_y_start = actual_title_height + padding + between_padding

    # 使用实际计算出的高度
    total_height = actual_title_height + actual_chart_height + padding * 2 + between_padding
    
    # 生成完整的mask
    original_mask = np.zeros((total_height - padding, chart_width + padding * 2), dtype=np.uint8)
    
    # 添加标题区域到mask
    title_region_height = title_end - title_start + 1
    title_y_start = padding + title_start
    title_y_end = min(total_height, title_y_start + title_region_height)
    if title_y_end > title_y_start:
        original_mask[title_y_start:title_y_end, :] = title_mask[title_start:title_start + (title_y_end - title_y_start), :]
    
    # 添加图表区域到mask
    chart_region_height = chart_end - chart_start + 1
    chart_y_start = actual_title_height + padding + between_padding
    chart_y_end = min(total_height, chart_y_start + chart_region_height)
    if chart_y_end > chart_y_start:
        original_mask[chart_y_start:chart_y_end, :] = chart_mask[chart_start:chart_start + (chart_y_end - chart_y_start), :]
    
    # 提取SVG内部元素
    title_inner_content = extract_svg_content(title_svg_content)
    if title_inner_content is None:
        logger.error("Failed to extract title SVG content")
        return None, None, 0
        
    chart_inner_content = extract_svg_content(chart_svg_content)
    if chart_inner_content is None:
        logger.error("Failed to extract chart SVG content")
        return None, None, 0
    
    # 创建基础SVG
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{chart_width + padding * 2}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    <g class="text" transform="translate({padding}, {padding + title_start})">{title_inner_content}</g>
    <g class="chart" transform="translate({padding}, {chart_y_start - chart_start})">{chart_inner_content}</g>"""
    
    # 处理primary图片
    if primary_image:
        if "base64," not in primary_image:
            primary_image = f"data:image/png;base64,{primary_image}"
        
        # 找到最佳的图片尺寸和位置
        image_size, best_x, best_y = find_best_size_and_position(original_mask, primary_image, padding)
        image_size -= between_padding * 2
        best_x += between_padding + grid_size
        best_y += between_padding + grid_size
        
        # 生成最终的图片mask
        temp_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{image_size}" height="{image_size}">
            <image width="{image_size}" height="{image_size}" href="{primary_image}"/>
        </svg>"""
        image_mask = calculate_mask(temp_svg, image_size, image_size)
        
        # 更新原始mask
        y_slice = slice(best_y, best_y + image_size)
        x_slice = slice(best_x, best_x + image_size)
        if y_slice.stop <= original_mask.shape[0] and x_slice.stop <= original_mask.shape[1]:
            original_mask[y_slice, x_slice] = np.maximum(
                original_mask[y_slice, x_slice],
                image_mask
            )
        
        # 将图片元素添加到SVG中
        image_element = f"""
    <image
        class="image"
        x="{best_x}"
        y="{best_y}"
        width="{image_size}"
        height="{image_size}"
        preserveAspectRatio="none"
        href="{primary_image}"
    />"""
        final_svg += image_element
    
    # 关闭SVG标签
    final_svg += "\n</svg>"
    
    return final_svg, original_mask, total_height

def process(input: str, output: str, base_url: str, api_key: str, chart_name: str = None) -> bool:
    """
    Pipeline入口函数，处理单个文件的信息图生成
    
    Args:
        input: 输入JSON文件路径
        output: 输出SVG文件路径
        base_url: API基础URL
        api_key: API密钥
        chart_name: 指定图表名称，如果提供则使用该图表，否则自动选择
        
    Returns:
        bool: 处理是否成功
    """
    # 读取输入文件
    with open(input, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["name"] = input
    
    # 扫描并获取所有可用的模板
    templates = scan_templates()
    
    # 分析模板并获取要求
    template_count, template_requirements = analyze_templates(templates)
    compatible_templates = check_template_compatibility(data, templates, chart_name)
        
    # 如果指定了chart_name，尝试使用它
    if chart_name:
        # 在兼容的模板中查找指定的chart_name
        if len(compatible_templates) > 0:
            pass
        else:
            return False
        logger.info("input file: %s", input)
        logger.info("output file: %s", output)
    else:
        logger.info("input file: %s", input)
        logger.info("output file: %s", output)
        # 检查与当前数据的兼容性
        logger.info(f"\nNumber of compatible templates: {len(compatible_templates)}")
        if not compatible_templates:
            logger.error("No compatible templates found for the given data")
            return False
        # 随机选择一个兼容的模板
    engine, chart_type, chart_name = select_template(compatible_templates)
    
    # 打印选择的模板信息
    logger.info(f"\nSelected template: {engine}/{chart_type}/{chart_name}")
    logger.info(f"Engine: {engine}")
    logger.info(f"Chart type: {chart_type}")
    logger.info(f"Chart name: {chart_name}\n")

    # 处理模板要求
    requirements = template_requirements[f"{engine}/{chart_type}/{chart_name}"]
    process_template_requirements(requirements, data)
    
    # 处理数据
    process_temporal_data(data)
    process_numerical_data(data)
    
    # 获取图表模板
    engine_obj, template = get_template_for_chart_name(chart_name)
    if engine_obj is None or template is None:
        logger.error(f"Failed to load template: {engine}/{chart_type}/{chart_name}")
        return False
    
    # 创建临时目录
    tmp_dir = "./tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    
    # 处理输出文件名，将路径分隔符替换为下划线
    safe_output_name = os.path.basename(output).replace('/', '_').replace('\\', '_')
    
    # 生成图表SVG，使用安全的文件名
    chart_svg_path = os.path.join(tmp_dir, f"{os.path.splitext(safe_output_name)[0]}.chart.tmp")
    render_chart_to_svg(
        json_data=data,
        output_svg_path=chart_svg_path,
        js_file=template,
        framework=engine.split('-')[0]  # Extract framework name (echarts/d3)
    )
        
    # 读取生成的SVG内容
    with open(chart_svg_path, "r", encoding="utf-8") as f:
        chart_svg_content = f.read()
        if "This is a fallback SVG using a PNG screenshot" in chart_svg_content:
            return False
        
        # 检查并删除大型rect
        chart_svg_content = remove_large_rects(chart_svg_content)
        
    chart_width = max(1, int(data["variables"]["width"]))
    chart_height = max(1, int(data["variables"]["height"]))
    
    # 生成标题SVG
    title_svg_content = title_styler_process(input_data=data, max_width=chart_width)
    if not title_svg_content:
        logger.error("Failed to generate title SVG")
        return False
    
    # 获取primary图片
    primary_image = data.get("images", {}).get("other", {}).get("primary")
    
    # 使用新函数组装信息图
    final_svg, original_mask, total_height = assemble_infographic(
        title_svg_content=title_svg_content,
        chart_svg_content=chart_svg_content,
        chart_width=chart_width,
        chart_height=chart_height,
        padding=padding,
        between_padding=between_padding,
        primary_image=primary_image
    )
    
    if final_svg is None:
        logger.error("Failed to assemble infographic: SVG content extraction failed")
        return False
    
    # 获取当前时间戳
    timestamp = int(time.time())
    output_dir = os.path.dirname(output)
    output_filename = os.path.basename(output)        
    new_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.svg"        
    output_path = os.path.join(output_dir, new_filename)
    
    # 保存最终的SVG
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_svg)
    
    os.remove(chart_svg_path)
    return True

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Infographics Generator")
    parser.add_argument("--input", type=str, required=True, help="Input JSON file path")
    parser.add_argument("--output", type=str, required=True, help="Output SVG file path")
    args = parser.parse_args()

    success = process(input=args.input, output=args.output)
    if success:
        print("Processing json successed.")
    else:
        print("Processing json failed.")

if __name__ == "__main__":
    main() 