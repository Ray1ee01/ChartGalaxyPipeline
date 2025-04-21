import json
import os
import sys
from typing import Dict, Optional, List, Tuple, Set, Union
from logging import getLogger
import logging
import time
import numpy as np
import subprocess
import re
from numpy.lib.stride_tricks import as_strided
from lxml import etree
from modules.infographics_generator.svg_utils import svg_to_png
from PIL import Image as PILImage

from config import api_key as API_KEY, base_url as API_PROVIDER

import base64
import requests
from io import BytesIO

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
from modules.infographics_generator.mask_utils import calculate_mask, calculate_content_height, calculate_content_width, calculate_bbox, calculate_mask_v2
from modules.infographics_generator.svg_utils import extract_svg_content, extract_large_rect, adjust_and_get_bbox, add_gradient_to_rect
from modules.infographics_generator.image_utils import find_best_size_and_position
from modules.infographics_generator.template_utils import (
    analyze_templates,
    check_template_compatibility,
    select_template,
    process_template_requirements,
    get_unique_fields_and_types
)
from modules.infographics_generator.data_utils import process_temporal_data, process_numerical_data, deduplicate_combinations
from modules.infographics_generator.color_utils import is_dark_color, lighten_color

padding = 50
outer_padding = 15
between_padding = 45
grid_size = 5


def make_infographic(
    data: Dict,
    chart_svg_content: str,
    padding: int,
    between_padding: int,
    dark: bool,
    html_path: str,
    mask_path: str
) -> str:
    if not dark:
        background_color = data["colors"].get("background_color", "#FFFFFF")
        if is_dark_color(background_color):
            background_color = lighten_color(background_color, amount=0.3)
            data["colors"]["background_color"] = background_color
    else:
        background_color = data["colors_dark"].get("background_color", "#000000")

    chart_content, chart_width, chart_height, chart_offset_x, chart_offset_y = adjust_and_get_bbox(chart_svg_content, background_color)
    chart_svg_content = f"<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='{chart_width}' height='{chart_height}'>{chart_content}</svg>"
    mask = calculate_mask_v2(chart_svg_content, chart_width, chart_height, background_color)
    title_candidates = []
    min_title_width = max(250, chart_width / 2)
    max_title_width = chart_width - 150
    steps = np.ceil((max_title_width - min_title_width) / 100).astype(int)

    # Visualize the mask for debugging
    import matplotlib.pyplot as plt
    import io
    import base64
    from PIL import Image
    
    def visualize_mask(mask, title="Mask Visualization"):
        """
        Visualize the mask and return a base64 encoded image
        
        Args:
            mask: The mask array to visualize
            title: Title for the plot
            
        Returns:
            str: Base64 encoded PNG image
        """
        plt.figure(figsize=(10, 8))
        plt.imshow(mask, cmap='viridis')
        plt.colorbar(label='Mask Value')
        plt.title(title)
        plt.grid(True, alpha=0.3)
        
        # Add annotations for dimensions
        height, width = mask.shape
        plt.text(width/2, -10, f"Width: {width}px", ha='center')
        plt.text(-10, height/2, f"Height: {height}px", va='center', rotation=90)
        
        # Save to a bytes buffer
        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        plt.close()
        buf.seek(0)
        
        # Convert to base64
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        return img_str
    

    for i in range(steps + 1):
        width = min_title_width + i * (max_title_width - min_title_width) / steps
        title_content = title_styler_process(input_data=data, max_width=int(width), text_align="left", show_embellishment=False)
        title_svg_content = title_content  # Assuming title_content is the SVG content
        svg_tree = etree.fromstring(title_svg_content.encode())
        width = int(float(svg_tree.get("width", 0)))
        height = int(float(svg_tree.get("height", 0)))
        title_candidates.append({
            "width": width,
            "height": height,
        })
        
    mask_top = np.argmax(mask, axis=0)  # 每一列第一个1的位置
    mask_bottom = mask.shape[0] - 1 - np.argmax(np.flip(mask, axis=0), axis=0)  # 每一列最后一个1的位置
    mask_left = np.argmax(mask, axis=1)  # 每一行第一个1的位置
    mask_right = mask.shape[1] - 1 - np.argmax(np.flip(mask, axis=1), axis=1)  # 每一行最后一个1的位置

    default_title = {
        "title": (0, 0),
        "chart": (0, title_candidates[-1]["height"] + between_padding),
        "text-align": "left",
        "title-to-chart": "TL",
        "width": chart_width,
        "total_height": title_candidates[-1]["height"] + chart_height + between_padding,
        "total_width": chart_width,
        "is_first": True,
        "area": (title_candidates[-1]["height"] + between_padding + chart_height) * (chart_width)
    }
    area_threshold = 1.05
    default_area = default_title["area"] * area_threshold
    other_title = {
    }

    for title in title_candidates:
        title_width = title["width"] + between_padding
        title_height = title["height"] + between_padding
        offset_list = [0, 25, 50, 75, 100, 125, 150]

        # for Left-Top 
        for offset in offset_list:
            width = title_width - offset
            min_top = int(np.min(mask_top[:width]))
            area = (max(title_height - min_top, 0) + chart_height) * (chart_width + offset)
            best_area = other_title["left-top"]["area"] if "left-top" in other_title else default_area
            if area < best_area:
                other_title["left-top"] = {
                    "title": (0, 0),
                    "title-to-chart": "TL",
                    "chart": (offset, max(title_height - min_top, 0)),
                    "text-align": "left",
                    "width": title["width"],
                    "total_height": max(title_height - min_top, 0) + chart_height,
                    "total_width": chart_width + offset, 
                    "area": area
                }

        # for top
        range_start = chart_width // 2 - title_width // 2
        range_end = range_start + title_width
        min_top = int(np.min(mask_top[range_start:range_end]))
        area = (max(title_height - min_top, 0) + chart_height) * chart_width
        best_area = other_title["top"]["area"] if "top" in other_title else default_area
        if area < best_area:
            other_title["top"] = {
                "title": (range_start, 0),
                "chart": (0, max(title_height - min_top, 0)),
                "text-align": "center",
                "title-to-chart": "T",
                "width": title["width"],
                "total_height": max(title_height - min_top, 0) + chart_height,
                "total_width": chart_width,
                "area": area
            }

        # for bottom
        range_start = chart_width // 2 - title_width // 2
        range_end = range_start + title_width
        max_bottom = int(np.max(mask_bottom[range_start:range_end]))
        area = (max(title_height - (chart_height - max_bottom), 0) + chart_height) * chart_width
        best_area = other_title["bottom"]["area"] if "bottom" in other_title else default_area
        title_y = chart_height - title_height + max(title_height - (chart_height - max_bottom), 0) + between_padding
        if area < best_area:
            other_title["bottom"] = {
                "title": (range_start, title_y),
                "chart": (0, 0),
                "text-align": "center",
                "title-to-chart": "B",
                "width": title["width"],
                "total_height": max(title_y + title_height, chart_height),
                "total_width": chart_width,
                "area": area
            }
            
        # for Left-Bottom
        for offset in offset_list:
            width = title_width - offset
            max_bottom = int(np.max(mask_bottom[:width]))
            area = (max(title_height - (chart_height - max_bottom), 0) + chart_height) * (chart_width + offset)
            best_area = other_title["left-bottom"]["area"] if "left-bottom" in other_title else default_area
            if area < best_area:
                other_title["left-bottom"] = {
                    "title": (0, chart_height - title_height + max(title_height - (chart_height - max_bottom), 0) + between_padding),
                    "chart": (offset, 0),
                    "text-align": "left",
                    "title-to-chart": "BL",
                    "width": title["width"],
                    "total_height": max(title_height - (chart_height - max_bottom), 0) + chart_height,
                    "total_width": chart_width + offset, 
                    "area": area
                }

        # for Right-Top
        for offset in offset_list:
            width = title_width - offset
            min_top = int(np.min(mask_top[-width:]))
            area = (max(title_height - min_top, 0) + chart_height) * (chart_width + offset)
            best_area = other_title["right-top"]["area"] if "right-top" in other_title else default_area
            if area < best_area:
                other_title["right-top"] = {
                    "title": (chart_width - width, 0),
                    "chart": (0, max(title_height - min_top, 0)),
                    "text-align": "right",
                    "title-to-chart": "TR",
                    "width": title["width"],
                    "total_height": max(title_height - min_top, 0) + chart_height,
                    "total_width": chart_width + offset, 
                    "area": area
                }
        
        # for Right-Bottom
        for offset in offset_list:
            width = title_width - offset
            max_bottom = int(np.max(mask_bottom[-width:]))
            area = (max(title_height - (chart_height - max_bottom), 0) + chart_height) * (chart_width + offset)
            best_area = other_title["right-bottom"]["area"] if "right-bottom" in other_title else default_area
            if area < best_area:
                other_title["right-bottom"] = {
                    "title": (chart_width - width, chart_height - title_height + max(title_height - (chart_height - max_bottom), 0) + between_padding),
                    "chart": (0, 0),
                    "text-align": "right",
                    "title-to-chart": "BR",
                    "width": title["width"],
                    "total_height": max(title_height - (chart_height - max_bottom), 0) + chart_height,
                    "total_width": chart_width + offset, 
                    "area": area
                }
            
        if title_height > chart_height:
            continue

        offset_list = [50, 75, 100, 125, 150]
        # for left
        for offset in offset_list:
            range_start = offset
            range_end = range_start + title_height
            if range_end > chart_height - offset_list[0]:
                continue
            min_left = int(np.min(mask_left[range_start:range_end]))
            area = (max(title_width - min_left, 0) + chart_width) * (chart_height)
            best_area = other_title["left"]["area"] if "left" in other_title else default_area
            if area < best_area:
                other_title["left"] = {
                    "title": (0, range_start),
                    "chart": (offset, 0),
                    "text-align": "left",
                    "title-to-chart": "L",
                    "width": title["width"],
                    "total_height": chart_height,
                    "total_width": chart_width + offset,
                    "area": area
                }

        for offset in offset_list:
            range_start = chart_height - title_height - offset
            range_end = range_start + title_height
            if range_start < offset_list[0]:
                continue
            min_left = int(np.min(mask_left[range_start:range_end]))
            area = (max(title_width - min_left, 0) + chart_width) * (chart_height)
            best_area = other_title["left"]["area"] if "left" in other_title else default_area
            if area < best_area:
                other_title["left"] = {
                    "title": (0, range_start),
                    "chart": (offset, 0),
                    "text-align": "left",
                    "title-to-chart": "L",
                    "width": title["width"],
                    "total_height": chart_height,
                    "total_width": chart_width + offset,
                    "area": area
                }

        # for right
        for offset in offset_list:
            range_start = offset
            range_end = range_start + title_height
            if range_end > chart_height - offset_list[0]:
                continue
            max_right = int(np.max(mask_right[range_start:range_end]))
            area = (max(title_width - (chart_width - max_right), 0) + chart_width) * (chart_height)
            best_area = other_title["right"]["area"] if "right" in other_title else default_area
            title_x = max(chart_width - title_width, max_right + between_padding)
            if area < best_area:
                other_title["right"] = {
                    "title": (title_x, range_start + between_padding),
                    "chart": (0, 0),
                    "text-align": "right",
                    "title-to-chart": "R",
                    "width": title["width"],
                    "total_height": chart_height,
                    "total_width": max(title_x + title_width, chart_width),
                    "area": area
                }
        for offset in offset_list:
            range_start = chart_height - title_height - offset
            range_end = range_start + title_height
            if range_start < offset_list[0]:
                continue
            max_right = int(np.max(mask_right[range_start:range_end]))
            area = (max(title_width - (chart_width - max_right), 0) + chart_width) * (chart_height)
            best_area = other_title["right"]["area"] if "right" in other_title else default_area
            title_x = max(chart_width - title_width, max_right + between_padding)
            if area < best_area:
                other_title["right"] = {
                    "title": (title_x, range_start),
                    "chart": (0, 0),
                    "text-align": "right",
                    "title-to-chart": "R",
                    "width": title["width"],
                    "total_height": chart_height,
                    "total_width": max(title_x + title_width, chart_width),
                    "area": area
                }

    if len(other_title.values()) == 0:
        best_title = default_title
    else:
        import random
        title_options = [default_title] + list(other_title.values())
        min_area = min(title_options, key=lambda x: x["area"])["area"]
        title_options = [t for t in title_options if t["area"] <= min_area * area_threshold]
        option_weights = [2 if t["title-to-chart"] == "TL" else 1 for t in title_options]
        best_title = random.choices(title_options, weights=option_weights, k=1)[0]

    title_content = title_styler_process(input_data=data, \
                                         max_width=best_title["width"], \
                                         text_align=best_title["text-align"], \
                                         show_embellishment=best_title["text-align"] == "left" and best_title.get("is_first", False))
    title_inner_content = extract_svg_content(title_content)
    
    total_height = best_title["total_height"] + padding * 2
    total_width = best_title["total_width"] + padding * 2
    
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    <g class="chart" transform="translate({padding + best_title['chart'][0]}, {padding + best_title['chart'][1]})">{chart_content}</g>
    <g class="text" transform="translate({padding + best_title['title'][0]}, {padding + best_title['title'][1]})">{title_inner_content}</g>"""
    original_mask = calculate_mask_v2(final_svg + "\n</svg>", total_width, total_height, background_color)
    
    # Generate visualization
    mask_img = visualize_mask(original_mask, "Chart Mask")
    
    # Save the visualization to a file for inspection
    with open(mask_path, "wb") as f:
        f.write(base64.b64decode(mask_img))

    primary_image = data.get("images", {}).get("other", {}).get("primary")

    image_element = ""
    # 处理primary图片
    if primary_image:
        if "base64," not in primary_image:
            primary_image = f"data:image/png;base64,{primary_image}"
        
        image_size, best_x, best_y = find_best_size_and_position(original_mask, primary_image, padding)
        image_size -= between_padding
        best_x += between_padding / 2
        best_y += between_padding / 2
        if image_size > 90:
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
    
    text_color = data["colors"].get("text_color", "#000000")
    if dark:
        text_color = "#FFFFFF"

    if image_element == "":
        image_to_chart = "none"
    else:
        image_center_x = best_x + image_size / 2
        image_center_y = best_y + image_size / 2
        canvas_center_x = total_width / 2
        canvas_center_y = total_height / 2
        distance_x = abs(image_center_x - canvas_center_x)
        distance_y = abs(image_center_y - canvas_center_y)
        
        if distance_x > total_width * 0.25 and distance_y > total_height * 0.2:
            if image_center_x < canvas_center_x and image_center_y < canvas_center_y:
                image_to_chart = "TL"  # 左上
            elif image_center_x > canvas_center_x and image_center_y < canvas_center_y:
                image_to_chart = "TR"  # 右上
            elif image_center_x < canvas_center_x and image_center_y > canvas_center_y:
                image_to_chart = "BL"  # 左下
            else:
                image_to_chart = "BR"  # 右下
                
        elif distance_x > total_width * 0.25:
            if image_center_x < canvas_center_x:
                image_to_chart = "L"   # 左侧
            else:
                image_to_chart = "R"   # 右侧

        elif distance_y > total_height * 0.2:
            if image_center_y < canvas_center_y:
                image_to_chart = "T"   # 上方
            else:
                image_to_chart = "B"   # 下方
        else:
            chart_x = padding + best_title['chart'][0]
            chart_y = padding + best_title['chart'][1]
            center_padding = padding * 2
            chart_center_x = chart_x + center_padding
            chart_center_y = chart_y + center_padding
            chart_center_width = chart_width - center_padding * 2
            chart_center_height = chart_height - center_padding * 2
            
            # 检查图片是否完全在chart_center的bounding box中
            if (best_x >= chart_center_x and 
                best_y >= chart_center_y and 
                best_x + image_size <= chart_center_x + chart_center_width and 
                best_y + image_size <= chart_center_y + chart_center_height):
                image_to_chart = "C"  # 中心
            else:
                if abs(image_center_x - canvas_center_x) > abs(image_center_y - canvas_center_y):
                    image_to_chart = "L" if image_center_x < canvas_center_x else "R"
                else:
                    image_to_chart = "T" if image_center_y < canvas_center_y else "B"
            
            
    chart_content, background_element = extract_large_rect(chart_content)
    print("background_element", background_element)
    if background_element == "":
        background_element = add_gradient_to_rect(f'<rect x="0" y="0" width="{total_width}" height="{total_height}" fill="{background_color}" />')
    else:
        background_element = re.sub(r'width="[^"]+"', f'width="{total_width}"', background_element)
        background_element = re.sub(r'height="[^"]+"', f'height="{total_height}"', background_element)
        background_layer = add_gradient_to_rect(f'<rect x="0" y="0" width="{total_width}" height="{total_height}" fill="{background_color}" />')
        background_element = background_layer + background_element
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    {background_element}
    <g class="chart" transform="translate({padding + best_title['chart'][0]}, {padding + best_title['chart'][1]})">{chart_content}</g>
    <g class="text" fill="{text_color}" transform="translate({padding + best_title['title'][0]}, {padding + best_title['title'][1]})">{title_inner_content}</g>
    {image_element}\n</svg>"""

    layout_info = {
        "text_color": text_color,
        "background_color": background_color,
        "title_to_chart": best_title["title-to-chart"],
        "image_to_chart": image_to_chart,
        "text_align": best_title["text-align"],
        "title_width": best_title["width"]
    }
    
    html_chart_x = padding + best_title['chart'][0] + chart_offset_x
    html_chart_y = padding + best_title['chart'][1] + chart_offset_y
    html_text_x = padding + best_title['title'][0]
    html_text_y = padding + best_title['title'][1]

    with open(html_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Find the last script tag and inject the setTimeout code at the end
    src_end = html_content.rfind('</script>')
    if src_end != -1:
        inject_code = """
        // 500ms后检查SVG是否已生成
        setTimeout(function() {
            const svg = document.querySelector('#chart-container svg');
            if (svg) {
                const originalContent = svg.innerHTML;
                svg.setAttribute('width', '%d');
                svg.setAttribute('height', '%d');
                svg.innerHTML = `%s` +
                '<g class="chart" transform="translate(%d, %d)">' + originalContent + '</g>' +
                '<g class="text" fill="%s" transform="translate(%d, %d)">' + `%s` + '</g>' +
                `%s`;
            }
        }, 1000);
        """ % (total_width, total_height, background_element, html_chart_x, html_chart_y, text_color, html_text_x, html_text_y, title_inner_content, image_element)
        
        new_html_content = html_content[:src_end] + inject_code + html_content[src_end:]
        
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(new_html_content)

    return final_svg, layout_info


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
        deduplicate_combinations(data)
        process_data_time = time.time() - process_data_start
        logger.info(f"Processing data took: {process_data_time:.4f} seconds")
        
        # 获取图表模板
        get_template_start = time.time()
        engine_obj, template = get_template_for_chart_name(chart_name)
        if engine_obj is None or template is None:
            logger.error(f"Failed to load template: {engine}/{chart_type}/{chart_name}")
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
    try:
        if '-' in engine:
            framework, framework_type = engine.split('-')
        elif '_' in engine:
            framework, framework_type = engine.split('_')
        else:
            framework = engine
            framework_type = None

        # 渲染图表
        render_chart_start = time.time()
        timestamp = int(time.time())
        output_dir = os.path.dirname(output)
        output_filename = os.path.basename(output)        
        new_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.svg"
        output_path = os.path.join(output_dir, new_filename)           
        info_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.json" 
        info_path = os.path.join(output_dir, info_filename) 
        html_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.html"
        html_path = os.path.join(output_dir, html_filename)
        png_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.png" 
        png_path = os.path.join(output_dir, png_filename)
        mask_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.mask.png"
        mask_path = os.path.join(output_dir, mask_filename)
        #try:
        render_chart_to_svg(
            json_data=data,
            output_svg_path=chart_svg_path,
            js_file=template,
            framework=framework, # Extract framework name (echarts/d3)
            framework_type=framework_type,
            html_output_path=html_path
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

        assemble_start = time.time()
        final_svg, layout_info = make_infographic(
            data=data,
            chart_svg_content=chart_inner_content,
            padding=padding,
            between_padding=between_padding,
            dark=requirements.get("background", "light") == "dark",
            html_path=html_path,
            mask_path=mask_path
        )

        assemble_time = time.time() - assemble_start
        logger.info(f"Assembling infographic took: {assemble_time:.4f} seconds")
        # 读取生成的SVG内容
        read_svg_start = time.time()
        
        if final_svg is None:
            logger.error("Failed to assemble infographic: SVG content extraction failed")
            return False
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_svg)

        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(layout_info, f, ensure_ascii=False, indent=4)

        subprocess.run([
            'rsvg-convert',
            '-f', 'png',
            '-o', png_path,
            '--dpi-x', '300',
            '--dpi-y', '300',
            '--background-color', '#ffffff',
            output_path
        ], check=True)
    except Exception as e:
        logger.error(f"Error processing infographics: {e}")
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
    # except Exception as e:
    #     logger.error(f"Error processing infographics: {e}")
    #     return False
    # finally:
    #     try:
    #         os.remove(chart_svg_path)
    #     except Exception as e:
    #         pass
    
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