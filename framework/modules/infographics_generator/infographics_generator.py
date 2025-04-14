import json
import os
import sys
from typing import Dict, Optional, List, Tuple, Set, Union
from logging import getLogger
import logging
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
from modules.infographics_generator.mask_utils import calculate_mask, calculate_content_height, calculate_content_width, calculate_bbox
from modules.infographics_generator.svg_utils import extract_svg_content, remove_large_rects, get_svg_actual_bbox
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
outer_padding = 15
between_padding = 45
grid_size = 5

'''
def make_infographic(
    data: Dict,
    chart_svg_content: str,
    chart_info: Dict,
    padding: int,
    between_padding: int
) -> str:
    chart_width = chart_info["width"]
    chart_height = chart_info["height"]
    chart_left = chart_info["left"]
    chart_top = chart_info["top"]

    title_inner_content = extract_svg_content(title_svg_content)
    if title_inner_content is None:
        logger.error("Failed to extract title SVG content")
        return None, None, 0
        
    chart_inner_content = extract_svg_content(chart_svg_content)
    if chart_inner_content is None:
        logger.error("Failed to extract chart SVG content")
        return None, None, 0
    
    total_width = chart_width + padding * 2

    drawing_padding = 100
    title_mask = calculate_mask(title_svg_content, total_width, 500, drawing_padding)
    title_start, title_end, title_height = calculate_content_height(title_mask, drawing_padding)
    title_left, title_right, title_width = calculate_content_width(title_mask, drawing_padding)
    
    chart_mask = calculate_mask(chart_svg_content, total_width, chart_height + padding * 2, drawing_padding)
    new_chart_start, chart_end, new_chart_height = calculate_content_height(chart_mask, drawing_padding)
    new_chart_left, chart_right, new_chart_width = calculate_content_width(chart_mask, drawing_padding)
    
    chart_start = min(chart_top, new_chart_start)
    chart_left = max(-padding, min(chart_left, new_chart_left))
    chart_height = max(chart_height, new_chart_height)
    chart_width = max(chart_width, new_chart_width)

    total_width = max(title_width, chart_width) + padding * 2
    
    title_inner_content = f"<g transform='translate({-title_left}, {-title_start})'>{title_inner_content}</g>"
    chart_inner_content = f"<g transform='translate({-chart_left}, {-chart_start})'>{chart_inner_content}</g>"
    
    total_height = chart_height + title_height + between_padding + outer_padding * 2
    total_width = chart_width + padding * 2
    
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height + 100}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    <g class="text" transform="translate({outer_padding}, {outer_padding})">{title_inner_content}</g>
    <g class="chart" transform="translate({outer_padding}, {outer_padding + title_height + between_padding})">{chart_inner_content}</g>"""
    original_mask = calculate_mask(final_svg + "\n</svg>", total_width, total_height, 0)
    
    # 处理primary图片
    if primary_image:
        if "base64," not in primary_image:
            primary_image = f"data:image/png;base64,{primary_image}"
        
        image_size, best_x, best_y = find_best_size_and_position(original_mask, primary_image, padding)
        image_size -= between_padding * 2
        best_x += between_padding
        best_y += between_padding
        if image_size > 100:
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
    
    return final_svg
'''

def assemble_infographic(
    title_svg_content: str,
    chart_svg_content: str,
    chart_info: Dict,
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
    chart_width = chart_info["width"]
    chart_height = chart_info["height"]
    chart_left = chart_info["left"]
    chart_top = chart_info["top"]

    title_inner_content = extract_svg_content(title_svg_content)
    if title_inner_content is None:
        logger.error("Failed to extract title SVG content")
        return None, None, 0
        
    chart_inner_content = extract_svg_content(chart_svg_content)
    if chart_inner_content is None:
        logger.error("Failed to extract chart SVG content")
        return None, None, 0
    
    total_width = chart_width + padding * 2

    drawing_padding = 100
    title_mask = calculate_mask(title_svg_content, total_width, 500, drawing_padding)
    title_start, title_end, title_height = calculate_content_height(title_mask, drawing_padding)
    title_left, title_right, title_width = calculate_content_width(title_mask, drawing_padding)
    
    chart_mask = calculate_mask(chart_svg_content, total_width, chart_height + padding * 2, drawing_padding)
    new_chart_start, chart_end, new_chart_height = calculate_content_height(chart_mask, drawing_padding)
    new_chart_left, chart_right, new_chart_width = calculate_content_width(chart_mask, drawing_padding)
    
    chart_start = min(chart_top, new_chart_start)
    chart_left = max(-padding, min(chart_left, new_chart_left))
    chart_height = max(chart_height, new_chart_height)
    chart_width = max(chart_width, new_chart_width)

    total_width = max(title_width, chart_width) + padding * 2
    
    title_inner_content = f"<g transform='translate({-title_left}, {-title_start})'>{title_inner_content}</g>"
    chart_inner_content = f"<g transform='translate({-chart_left}, {-chart_start})'>{chart_inner_content}</g>"
    
    total_height = chart_height + title_height + between_padding + outer_padding * 2
    total_width = chart_width + padding * 2
    
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height + 100}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    <g class="text" transform="translate({outer_padding}, {outer_padding})">{title_inner_content}</g>
    <g class="chart" transform="translate({outer_padding}, {outer_padding + title_height + between_padding})">{chart_inner_content}</g>"""
    original_mask = calculate_mask(final_svg + "\n</svg>", total_width, total_height, 0)
    
    # 处理primary图片
    if primary_image:
        if "base64," not in primary_image:
            primary_image = f"data:image/png;base64,{primary_image}"
        
        image_size, best_x, best_y = find_best_size_and_position(original_mask, primary_image, padding)
        image_size -= between_padding * 2
        best_x += between_padding
        best_y += between_padding
        if image_size > 100:
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
    start_time = time.time()
    
    # 读取输入文件
    file_read_start = time.time()
    with open(input, "r", encoding="utf-8") as f:
        data = json.load(f)
    data["name"] = input
    file_read_time = time.time() - file_read_start
    # logger.info(f"Reading input file took: {file_read_time:.4f} seconds")
    
    # 扫描并获取所有可用的模板
    scan_templates_start = time.time()
    templates = scan_templates()
    scan_templates_time = time.time() - scan_templates_start
    # logger.info(f"Scanning templates took: {scan_templates_time:.4f} seconds")
    
    # 分析模板并获取要求
    analyze_templates_start = time.time()
    template_count, template_requirements = analyze_templates(templates)
    compatible_templates = check_template_compatibility(data, templates, chart_name)
    analyze_templates_time = time.time() - analyze_templates_start
    # logger.info(f"Analyzing templates took: {analyze_templates_time:.4f} seconds")
        
    # 如果指定了chart_name，尝试使用它
    if chart_name:
        # 在兼容的模板中查找指定的chart_name
        compatible_templates = [t for t in compatible_templates if chart_name == t[0].split('/')[-1]]
        if len(compatible_templates) > 0:
            pass
        else:
            # logger.error(f"Specified chart_name '{chart_name}' not compatible with data")
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
    
    # 选择模板
    select_template_start = time.time()
    engine, chart_type, chart_name, ordered_fields = select_template(compatible_templates)
    select_template_time = time.time() - select_template_start
    # logger.info(f"Selecting template took: {select_template_time:.4f} seconds")
    
    # 打印选择的模板信息
    logger.info(f"\nSelected template: {engine}/{chart_type}/{chart_name}")
    logger.info(f"Engine: {engine}")
    logger.info(f"Chart type: {chart_type}")
    logger.info(f"Chart name: {chart_name}\n")

    # print("requirements", template_requirements)

    # 处理模板要求
    process_req_start = time.time()
    requirements = template_requirements[f"{engine}/{chart_type}/{chart_name}"]
    process_template_requirements(requirements, data, engine, chart_name)
    process_req_time = time.time() - process_req_start
    logger.info(f"Processing template requirements took: {process_req_time:.4f} seconds")
    
    # 处理数据
    process_data_start = time.time()
    for i, field in enumerate(ordered_fields):
        data["data"]["columns"][i]["role"] = field
    process_temporal_data(data)
    process_numerical_data(data)
    process_data_time = time.time() - process_data_start
    logger.info(f"Processing data took: {process_data_time:.4f} seconds")
    
    # 获取图表模板
    get_template_start = time.time()
    engine_obj, template = get_template_for_chart_name(chart_name)
    if engine_obj is None or template is None:
        logger.error(f"Failed to load template: {engine}/{chart_type}/{chart_name}")
        return False
    get_template_time = time.time() - get_template_start
    logger.info(f"Getting template took: {get_template_time:.4f} seconds")
    
    # 创建临时目录
    tmp_dir = "./tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    
    # 处理输出文件名，将路径分隔符替换为下划线
    safe_output_name = os.path.basename(output).replace('/', '_').replace('\\', '_')
    
    # 生成图表SVG，使用安全的文件名
    chart_svg_path = os.path.join(tmp_dir, f"{os.path.splitext(safe_output_name)[0]}.chart.tmp")

    if '-' in engine:
        framework, framework_type = engine.split('-')
    elif '_' in engine:
        framework, framework_type = engine.split('_')
    else:
        framework = engine
        framework_type = None

    # 渲染图表
    render_chart_start = time.time()

    #try:
    render_chart_to_svg(
        json_data=data,
        output_svg_path=chart_svg_path,
        js_file=template,
        framework=framework, # Extract framework name (echarts/d3)
        framework_type=framework_type
    )
    render_chart_time = time.time() - render_chart_start
    logger.info(f"Rendering chart took: {render_chart_time:.4f} seconds")
        
    # 读取生成的SVG内容
    read_svg_start = time.time()
    
    with open(chart_svg_path, "r", encoding="utf-8") as f:
        chart_svg_content = f.read()
        if "This is a fallback SVG using a PNG screenshot" in chart_svg_content:
            return False
        chart_inner_content = extract_svg_content(chart_svg_content)
        chart_outer_content = f"<svg \
            width='{data['variables']['width']}' \
            height='{data['variables']['height']}' \
            xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'> \
            {chart_inner_content}</svg>"
        with open(chart_svg_path, "w", encoding="utf-8") as f:
            f.write(chart_outer_content)
            f.close()
    
    bbox = get_svg_actual_bbox(chart_svg_path)
    print("bbox", bbox)
    read_svg_time = time.time() - read_svg_start
    # logger.info(f"Reading and processing SVG took: {read_svg_time:.4f} seconds")
        
    # print(bbox)
    chart_left = bbox["min_x"]
    chart_top = bbox["min_y"]
    chart_width = bbox["max_x"] - bbox["min_x"]
    chart_height = bbox["max_y"] - bbox["min_y"]
    
    # 生成标题SVG
    title_svg_start = time.time()

    # TODO add more style for title
    title_width = min(600, chart_width - padding * 2)
    title_svg_content = title_styler_process(input_data=data, max_width=title_width, text_align="center")
    if not title_svg_content:
        logger.error("Failed to generate title SVG")
        return False
    title_svg_time = time.time() - title_svg_start
    logger.info(f"Generating title SVG took: {title_svg_time:.4f} seconds")
    
    # 获取primary图片
    primary_image = data.get("images", {}).get("other", {}).get("primary")
    
    print("try to assemble infographic")
    assemble_start = time.time()
    final_svg, original_mask, total_height = assemble_infographic(
        title_svg_content=title_svg_content,
        chart_svg_content=chart_svg_content,
        chart_info={
            "left": chart_left,
            "top": chart_top,
            "width": chart_width,
            "height": chart_height
        },
        padding=padding,
        between_padding=between_padding,
        primary_image=primary_image
    )
    assemble_time = time.time() - assemble_start
    logger.info(f"Assembling infographic took: {assemble_time:.4f} seconds")
    
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
    save_start = time.time()
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_svg)
    save_time = time.time() - save_start
    # logger.info(f"Saving final SVG took: {save_time:.4f} seconds")
    # except Exception as e:
    #     logger.error(f"Error processing infographics: {e}")
    #     return False
    
    try:
        os.remove(chart_svg_path)
    except Exception as e:
        pass
    
    '''
    total_time = time.time() - start_time
    logger.info(f"\n--- PERFORMANCE SUMMARY ---")
    logger.info(f"Total processing time: {total_time:.4f} seconds")
    logger.info(f"Reading input file: {file_read_time:.4f}s ({(file_read_time/total_time)*100:.1f}%)")
    logger.info(f"Scanning templates: {scan_templates_time:.4f}s ({(scan_templates_time/total_time)*100:.1f}%)")
    logger.info(f"Analyzing templates: {analyze_templates_time:.4f}s ({(analyze_templates_time/total_time)*100:.1f}%)")
    logger.info(f"Selecting template: {select_template_time:.4f}s ({(select_template_time/total_time)*100:.1f}%)")
    logger.info(f"Processing template requirements: {process_req_time:.4f}s ({(process_req_time/total_time)*100:.1f}%)")
    logger.info(f"Processing data: {process_data_time:.4f}s ({(process_data_time/total_time)*100:.1f}%)")
    logger.info(f"Getting template: {get_template_time:.4f}s ({(get_template_time/total_time)*100:.1f}%)")
    logger.info(f"Rendering chart: {render_chart_time:.4f}s ({(render_chart_time/total_time)*100:.1f}%)")
    logger.info(f"Reading and processing SVG: {read_svg_time:.4f}s ({(read_svg_time/total_time)*100:.1f}%)")
    logger.info(f"Generating title SVG: {title_svg_time:.4f}s ({(title_svg_time/total_time)*100:.1f}%)")
    logger.info(f"Assembling infographic: {assemble_time:.4f}s ({(assemble_time/total_time)*100:.1f}%)")
    logger.info(f"Saving final SVG: {save_time:.4f}s ({(save_time/total_time)*100:.1f}%)")
    logger.info(f"--- END SUMMARY ---\n")
    '''
    
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