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
from .svg_utils import svg_to_png, remove_image_element
from PIL import Image as PILImage

import base64
import requests
from io import BytesIO
import tempfile
import random
import uuid
import fcntl  # 添加fcntl模块用于文件锁

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

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.chart_engine.chart_engine import load_data_from_json, get_template_for_chart_name, render_chart_to_svg
from modules.chart_engine.template.template_registry import scan_templates
from modules.title_styler.title_styler import process as title_styler_process
from .mask_utils import fill_columns_between_bounds, calculate_mask_v2, expand_mask, calculate_mask_v3
from .svg_utils import extract_svg_content, extract_large_rect, adjust_and_get_bbox, add_gradient_to_rect, extract_background_element
from .image_utils import find_best_size_and_position, find_best_position
from .template_utils import (
    analyze_templates,
    check_template_compatibility,
    select_template,
    select_template_by_clip,
    process_template_requirements,
    get_unique_fields_and_types
)
from .data_utils import process_temporal_data, process_numerical_data, deduplicate_combinations
from .color_utils import is_dark_color, lighten_color

padding = 0
outer_padding = 15
between_padding = 35
grid_size = 5


def make_infographic(
    data: Dict,
    chart_svg_content: str,
    padding: int,
    between_padding: int,
    dark: bool,
    html_path: str,
    mask_path: str,
    new_layout_file: Dict
) -> str:
    if not dark:
        background_color = data["colors"].get("background_color", "#FFFFFF")
        if is_dark_color(background_color):
            background_color = lighten_color(background_color, amount=0.3)
            data["colors"]["background_color"] = background_color
    else:
        background_color = data["colors_dark"].get("background_color", "#000000")

    chart_content, chart_width, chart_height, chart_offset_x, chart_offset_y = adjust_and_get_bbox(chart_svg_content, background_color)
    
    ## start: add for new template
    chart_aspect_ratio = chart_width / chart_height
    thin_chart_flag = False
    if chart_aspect_ratio < 0.9:
        thin_chart_flag = True
    # print(f"chart_aspect_ratio: {chart_aspect_ratio}")
    # print(f"thin_chart_flag: {thin_chart_flag}")
    ## end

    new_layout = new_layout_file["new_layout"]
    
    chart_svg_content = f"<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='{chart_width}' height='{chart_height}'>{chart_content}</svg>"
    print('between mask v2')
    mask = calculate_mask_v2(chart_svg_content, chart_width, chart_height, background_color)
    print('after mask v2')
    mask = expand_mask(mask, 15)
    title_candidates = []
    min_title_width = max(250, chart_width / 2)
    if thin_chart_flag:
        max_title_width = max(chart_width, 600)
    else:
        max_title_width = chart_width
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
    
    
    # 把mask保存为png
    mask_img = visualize_mask(mask, "Mask")
    # with open("tmp/mask.png", "wb") as f:
    #     f.write(base64.b64decode(mask_img))

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
    
    # 从中间列开始,计算每行向左和向右第一个1的位置
    mid_col = mask.shape[1] // 2
    mask_left_from_mid = np.zeros(mask.shape[0], dtype=np.int32)
    mask_right_from_mid = np.zeros(mask.shape[0], dtype=np.int32)
    
    for row in range(mask.shape[0]):
        # 向左搜索第一个1
        left_pos = mid_col
        while left_pos >= 0 and mask[row][left_pos] == 0:
            left_pos -= 1
        mask_left_from_mid[row] = left_pos if left_pos >= 0 else -1
        
        # 向右搜索第一个1
        right_pos = mid_col
        while right_pos < mask.shape[1] and mask[row][right_pos] == 0:
            right_pos += 1
        mask_right_from_mid[row] = right_pos if right_pos < mask.shape[1] else -1

    smooth_threshold = 50
    # 从中间开始对mask_right_from_mid进行平滑
    mid_row = len(mask_right_from_mid) // 2
    # 向下平滑
    for i in range(mid_row + 2, len(mask_right_from_mid)):
        if abs(mask_right_from_mid[i] - mask_right_from_mid[i-1]) > smooth_threshold:
            mask_right_from_mid[i] = mask_right_from_mid[i-1] + (mask_right_from_mid[i-1] - mask_right_from_mid[i-2])
    # 向上平滑
    for i in range(mid_row - 2, -1, -1):
        if abs(mask_right_from_mid[i] - mask_right_from_mid[i+1]) > smooth_threshold:
            mask_right_from_mid[i] = mask_right_from_mid[i+1] + (mask_right_from_mid[i+1] - mask_right_from_mid[i+2])
            
    # 从中间开始对mask_left_from_mid进行平滑
    # 向下平滑
    for i in range(mid_row + 2, len(mask_left_from_mid)):
        if abs(mask_left_from_mid[i] - mask_left_from_mid[i-1]) > smooth_threshold:
            mask_left_from_mid[i] = mask_left_from_mid[i-1] + (mask_left_from_mid[i-1] - mask_left_from_mid[i-2])
    # 向上平滑
    for i in range(mid_row - 2, -1, -1):
        if abs(mask_left_from_mid[i] - mask_left_from_mid[i+1]) > smooth_threshold:
            mask_left_from_mid[i] = mask_left_from_mid[i+1] + (mask_left_from_mid[i+1] - mask_left_from_mid[i+2])

    # 统计距离
    distance_list = []
    for i in range(len(mask_left_from_mid)):
        distance_list.append(mask_right_from_mid[i] - mask_left_from_mid[i])
    # 统计平均距离
    average_distance = np.mean(distance_list)
    
    mask = np.zeros(mask.shape)
    for i in range(len(mask)):
        mask[i][mask_left_from_mid[i]:mask_right_from_mid[i]] = 1
    mask_img = visualize_mask(mask, "Mask after smoothing")
    
    # 使用临时文件替代固定路径
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
        temp_file_path = temp_file.name
        temp_file.write(base64.b64decode(mask_img))
    
    mask_1_count = np.sum(mask)
    mask_0_count = np.sum(1 - mask)
    mask_1_ratio = mask_1_count / (mask_1_count + mask_0_count)

    # 从new_layout中获取best_title
    # find category_id = 3
    new_layout_title_info = [layout for layout in new_layout if layout["category_id"] == 3]
    bbox = new_layout_title_info[0]["bbox"]
    title_x = int(bbox[0])
    title_y = int(bbox[1])
    title_width = int(bbox[2])
    title_height = int(bbox[3])
    print(f'title_x: {title_x}')
    print(f'title_y: {title_y}')
    print(f'title_width: {title_width}')
    print(f'title_height: {title_height}')

    new_layout_chart_info = [layout for layout in new_layout if layout["category_id"] == 2]
    chart_x = int(new_layout_chart_info[0]["bbox"][0])
    chart_y = int(new_layout_chart_info[0]["bbox"][1])
    chart_width = int(new_layout_chart_info[0]["bbox"][2])
    chart_height = int(new_layout_chart_info[0]["bbox"][3])

    new_layout_image_info = [layout for layout in new_layout if layout["category_id"] == 1]
    image_x = new_layout_image_info[0]["bbox"][0]
    image_y = new_layout_image_info[0]["bbox"][1]
    image_width = new_layout_image_info[0]["bbox"][2]
    image_height = new_layout_image_info[0]["bbox"][3]
    image_size = min(image_width, image_height)
    image_mode = "side"

    # total_width = max(title_x + title_width, chart_x + chart_width, image_x + image_width)
    # total_height = max(title_y + title_height, chart_y + chart_height, image_y + image_height)
    total_width = new_layout_file['width']
    total_height = new_layout_file['height']

    best_title = {
        "title": (title_x, title_y),
        "chart": (chart_x, chart_y),
        "text-align": "left",
        "title-to-chart": "TL",
        "width": title_width,
        "height": title_height,
        "total_height": total_height,
        "total_width": total_width,
        "is_first": True,
        "area": (title_height + between_padding + chart_height) * (chart_width)
    }


    title_content = title_styler_process(input_data=data, \
                                         max_width=best_title["width"], \
                                         text_align=best_title["text-align"], \
                                         show_embellishment=False, \
                                         show_sub_title=False)
    
    title_inner_content = extract_svg_content(title_content)
    
    image_mode = "side"
    
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    <g class="chart" transform="translate({padding + best_title['chart'][0]}, {padding + best_title['chart'][1]})">{chart_content}</g>
    <g class="text" transform="translate({padding + best_title['title'][0]}, {padding + best_title['title'][1]})">{title_inner_content}</g>"""
    chart_bbox = {
        "x": padding + best_title['chart'][0],
        "y": padding + best_title['chart'][1],
        "width": chart_width,
        "height": chart_height
    }
    if image_mode == "overlay":
        pass
        # print("remove_image_element")
        # final_svg = remove_image_element(final_svg)
    print('before mask v21')
    original_mask = calculate_mask_v2(final_svg + "\n</svg>", total_width, total_height, background_color)
    print('after mask v21')
    try:
        original_mask = fill_columns_between_bounds(original_mask, padding + best_title['title'][0], padding + best_title['title'][0] + best_title['width'], \
                                padding + best_title['title'][1], padding + best_title['title'][1] + best_title['height'])
    except Exception as e:
        print(f'fill_columns_between_bounds error: {e}')

    mask_img = visualize_mask(original_mask, "Chart Mask")
    with open(mask_path, "wb") as f:
        f.write(base64.b64decode(mask_img))

    primary_image = data.get("images", {}).get("other", {}).get("primary")

    image_element = ""
    overlay_image_size = 0
    side_image_size = 0
    background_image_size = 0
    best_x = 0
    best_y = 0
    if primary_image:
        if "base64," not in primary_image:
            primary_image = f"data:image/png;base64,{primary_image}"

        # side_mask = expand_mask(original_mask, 15)
        # side_image_size, side_best_x, side_best_y = find_best_size_and_position(side_mask, primary_image, padding, mode="side")
        # measure_side_size = min(side_image_size, 256)

        # overlay_mask, overlay_mask_only_text = calculate_mask_v3(final_svg + "\n</svg>", total_width, total_height, background_color)
        # overlay_mask = expand_mask(overlay_mask, 5)
        # overlay_image_size, overlay_best_x, overlay_best_y = find_best_size_and_position(overlay_mask, primary_image, padding, mode="overlay", avoid_mask=overlay_mask_only_text)
        # measure_overlay_size = min(overlay_image_size, 256)

        best_x = image_x
        best_y = image_y

        # overlay_mask_img = PILImage.fromarray((overlay_mask * 255).astype(np.uint8))
        # overlay_mask_img.save('./tmp/overlay_mask.png')
        # overlay_mask_only_text_img = PILImage.fromarray((overlay_mask_only_text * 255).astype(np.uint8))
        # overlay_mask_only_text_img.save('./tmp/overlay_mask_only_text.png')

        # image_size = overlay_image_size
        # best_x = overlay_best_x
        # best_y = overlay_best_y
        # image_mode = "overlay"
        # print("overlay_image_size", overlay_image_size)
        # print("overlay_best_x", overlay_best_x)
        # print("overlay_best_y", overlay_best_y)
        
        # min_acceptable_size = 96
        # if measure_side_size > min_acceptable_size or measure_overlay_size > min_acceptable_size:
        #     if side_image_size >= overlay_image_size * 0.45:
        #         image_size = side_image_size
        #         best_x = side_best_x
        #         best_y = side_best_y
        #         image_mode = "side"
        #     else:
        #         image_size = overlay_image_size
        #         best_x = overlay_best_x
        #         best_y = overlay_best_y
        #         image_mode = "overlay"
        # else:
        #     background_mask = original_mask
        #     background_image_size, background_best_x, background_best_y = find_best_size_and_position(background_mask, primary_image, padding, mode="background", chart_bbox=chart_bbox)
        #     measure_background_size = min(background_image_size, 512)

        #     if measure_background_size > 128:
        #         image_size = background_image_size
        #         best_x = background_best_x
        #         best_y = background_best_y
        #         image_mode = "background"
        #     else:
        #         image_size = 0

    text_color = data["colors"].get("text_color", "#000000")
    if dark:
        text_color = "#FFFFFF"

    if image_size <= 64:
        image_to_chart = "none"
    else:
        # 计算图片区域
        image_rect = {
            'x': best_x,
            'y': best_y,
            'width': image_size,
            'height': image_size
        }
        
        # 定义九宫格区域
        grid_areas = {
            'TL': {'x': 0, 'y': 0, 'width': total_width/3, 'height': total_height/3},
            'T': {'x': total_width/3, 'y': 0, 'width': total_width/3, 'height': total_height/3},
            'TR': {'x': 2*total_width/3, 'y': 0, 'width': total_width/3, 'height': total_height/3},
            'L': {'x': 0, 'y': total_height/3, 'width': total_width/3, 'height': total_height/3},
            'C': {'x': total_width/3, 'y': total_height/3, 'width': total_width/3, 'height': total_height/3},
            'R': {'x': 2*total_width/3, 'y': total_height/3, 'width': total_width/3, 'height': total_height/3},
            'BL': {'x': 0, 'y': 2*total_height/3, 'width': total_width/3, 'height': total_height/3},
            'B': {'x': total_width/3, 'y': 2*total_height/3, 'width': total_width/3, 'height': total_height/3},
            'BR': {'x': 2*total_width/3, 'y': 2*total_height/3, 'width': total_width/3, 'height': total_height/3}
        }
        
        # 计算与每个区域的重叠面积
        max_overlap = 0
        image_to_chart = 'none'
        
        if image_mode == "side" or image_mode == "background":
            for position, area in grid_areas.items():
                # 计算重叠区域
                overlap_x = max(0, min(image_rect['x'] + image_rect['width'], area['x'] + area['width']) - 
                            max(image_rect['x'], area['x']))
                overlap_y = max(0, min(image_rect['y'] + image_rect['height'], area['y'] + area['height']) - 
                            max(image_rect['y'], area['y']))
                overlap_area = overlap_x * overlap_y
                
                if overlap_area > max_overlap:
                    max_overlap = overlap_area
                    image_to_chart = position
        elif image_mode == "overlay":
            image_to_chart = "C"

        if image_size > 64:
            # if (image_mode == "side" or image_mode == "overlay") and image_size > 192:
            #     delta = between_padding / 2
            #     image_size -= delta * 2
            #     if image_to_chart == "C":
            #         best_x += delta
            #         best_y += delta
            #     if "B" in image_to_chart:
            #         best_y += delta * 2
            #     if "R" in image_to_chart:
            #         best_x += delta * 2



            best_x, best_y, overlap = find_best_position(original_mask, int(image_size), int(best_x), int(best_y), 10)

            image_opacity = 1
            # if overlap:
            #     image_opacity = 0.3

            image_element = f"""
                <image
                    class="image"
                    x="{best_x}"
                    y="{best_y}"
                    width="{image_size}"
                    height="{image_size}"
                    preserveAspectRatio="none"
                    href="{primary_image}"
                    opacity="{image_opacity}"
                />"""
            final_svg += image_element
    
    # title image
    title_image = data.get("images", {}).get("title")
    if 'base64,' not in title_image:
        title_image = f"data:image/png;base64,{title_image}"
    # 加载标题图片并获取尺寸
    title_image_data = base64.b64decode(title_image.split(',')[1])
    title_img = Image.open(BytesIO(title_image_data))
    orig_width, orig_height = title_img.size
    
    # 保持宽高比,将宽度调整为title_width
    aspect_ratio = orig_height / orig_width
    title_width = title_width 
    title_height = title_width * aspect_ratio
    title_image_element = f"""
        <image
            class="image"
            x="{title_x}"
            y="{title_y}"
            width="{title_width}"
            height="{title_height}"
            preserveAspectRatio="none"
            href="{title_image}"
        />"""

        
    # total_width += padding * 2
    # total_height += padding
    chart_content, background_element = extract_large_rect(chart_content)
    if background_element == "":
        background_element = add_gradient_to_rect(f'<rect x="0" y="0" width="{total_width}" height="{total_height}" fill="{background_color}" />')
    else:
        background_element = re.sub(r'width="[^"]+"', f'width="{total_width}"', background_element)
        background_element = re.sub(r'height="[^"]+"', f'height="{total_height}"', background_element)
        background_layer = add_gradient_to_rect(f'<rect x="0" y="0" width="{total_width}" height="{total_height}" fill="{background_color}" />')
        background_element = background_layer + background_element

    # if image_mode == "side" or image_mode == "overlay":
    final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    {background_element}
    <g class="chart" transform="translate({padding * 2 + best_title['chart'][0]}, {padding * 2 + best_title['chart'][1]})">{chart_content}</g>
    {image_element}\n{title_image_element}</svg>"""

    # final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    # {background_element}
    # <g class="chart" transform="translate({padding * 2 + best_title['chart'][0]}, {padding * 2 + best_title['chart'][1]})">{chart_content}</g>
    # <g class="text" fill="{text_color}" transform="translate({padding * 2 + best_title['title'][0]}, {padding * 2 + best_title['title'][1]})">{title_inner_content}</g>
    # {image_element}\n</svg>"""

    # elif image_mode == "background":
    #     final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
    #     {background_element}
    #     {image_element}\n
    #     <g class="chart" transform="translate({padding * 2 + best_title['chart'][0]}, {padding * 2 + best_title['chart'][1]})">{chart_content}</g>
    #     <g class="text" fill="{text_color}" transform="translate({padding * 2 + best_title['title'][0]}, {padding * 2 + best_title['title'][1]})">{title_inner_content}</g>
    #     </svg>"""
    #     final_svg = extract_background_element(final_svg)
        

    layout_info = {
        "text_color": text_color,
        "background_color": background_color,
        "title_to_chart": best_title["title-to-chart"],
        "image_to_chart": image_to_chart,
        "text_align": best_title["text-align"],
        "title_width": best_title["width"],
        "image_mode": image_mode,
        "side_image_size": side_image_size,
        "overlay_image_size": overlay_image_size,
        "background_image_size": background_image_size
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



def process(input: str, new_layout_path: str, output: str, base_url: str, api_key: str, chart_name: str = None, color_theme: str = 'light') -> bool:
    """
    Pipeline入口函数，处理单个文件的信息图生成
    
    Args:
        input: 输入JSON文件路径
        output: 输出SVG文件路径
        base_url: API基础URL
        api_key: API密钥
        chart_name: 指定图表名称，如果提供则使用该图表，否则自动选择
        color_theme: 颜色主题，可选值为'light'或'dark'
    Returns:
        bool: 处理是否成功
    """
    start_time = time.time()

    with open(new_layout_path, "r", encoding="utf-8") as f:
        new_layout_file = json.load(f)
        new_layout = new_layout_file["new_layout"]
    new_layout_chart_info = [layout for layout in new_layout if layout["category_id"] == 2]
    
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
    compatible_templates = check_template_compatibility(data, templates, chart_name, color_theme)
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
    
    print(f'all compatible templates: {compatible_templates}')
    
    # 选择模板
    select_template_start = time.time()
    # engine, chart_type, chart_name, ordered_fields = select_template(compatible_templates)
    engine, chart_type, chart_name, ordered_fields = select_template_by_clip(compatible_templates, new_layout_chart_info[0]['chart_description'])
    select_template_time = time.time() - select_template_start
    logger.info(f"Selecting template took: {select_template_time:.4f} seconds")
    
    # 打印选择的模板信息
    logger.info(f"\nSelected template: {engine}/{chart_type}/{chart_name}")
    logger.info(f"Engine: {engine}")
    logger.info(f"Chart type: {chart_type}")
    logger.info(f"Chart name: {chart_name}\n")


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
        
        # 创建子文件夹
        subfolder_name = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}"
        subfolder_path = os.path.join(output_dir, subfolder_name)
        os.makedirs(subfolder_path, exist_ok=True)
        
        # 在子文件夹中创建文件路径
        new_filename = "chart.svg"
        output_path = os.path.join(subfolder_path, new_filename)
        info_filename = "info.json"
        info_path = os.path.join(subfolder_path, info_filename)
        html_filename = "chart.html" 
        html_path = os.path.join(subfolder_path, html_filename)
        png_filename = "chart.png"
        png_path = os.path.join(subfolder_path, png_filename)
        mask_filename = "chart.mask.png"
        mask_path = os.path.join(subfolder_path, mask_filename)
        datatable_name = "data.json"
        datatable_path = os.path.join(subfolder_path, datatable_name)
        #try:
        chart_width = int(new_layout_chart_info[0]["bbox"][2])
        chart_height = int(new_layout_chart_info[0]["bbox"][3])

        data["variables"]["width"] = chart_width
        data["variables"]["height"] = chart_height


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
        print(f'chart_svg_path: {chart_svg_path}')
        with open(chart_svg_path, "r", encoding="utf-8") as f:
            chart_svg_content = f.read()
            if "This is a fallback SVG using a PNG screenshot" in chart_svg_content:
                return False
            chart_inner_content = extract_svg_content(chart_svg_content)
        
        print(f'chart_inner_content')
        
        with open(new_layout_path, "r", encoding="utf-8") as f:
            new_layout_file = json.load(f)
            new_layout = new_layout_file["new_layout"]
        
        print(f'new_layout')

        assemble_start = time.time()

        try:
            final_svg, layout_info = make_infographic(
                data=data,
                chart_svg_content=chart_inner_content,
                padding=padding,
                between_padding=between_padding,
                dark=requirements.get("background", "light") == "dark",
                html_path=html_path,
                mask_path=mask_path,
                new_layout_file=new_layout_file
            )
        except Exception as e:
            print(f'make_infographic error: {e}')
            return False
        
        print(f'final_svg generated')
        layout_info["chart_variation"] = chart_name
        layout_info["chart_type"] = chart_type
        layout_info["data_source"] = input

        assemble_time = time.time() - assemble_start
        logger.info(f"Assembling infographic took: {assemble_time:.4f} seconds")
        # 读取生成的SVG内容
        read_svg_start = time.time()
        
        if final_svg is None:
            logger.error("Failed to assemble infographic: SVG content extraction failed")
            print(f'final_svg is None')
            return False
        # 使用文件锁保护写入操作,最多重试3次
        max_retries = 3
        retry_count = 0
        
        print(f'output_path: {output_path}')
        
        while retry_count < max_retries:
            try:
                # 写入SVG文件
                with open(output_path, "w", encoding="utf-8") as f:
                    try:
                        fcntl.flock(f, fcntl.LOCK_EX)  # 获取独占锁
                        f.write(final_svg)
                    finally:
                        fcntl.flock(f, fcntl.LOCK_UN)  # 释放锁

                # 写入info文件
                with open(info_path, "w", encoding="utf-8") as f:
                    try:
                        fcntl.flock(f, fcntl.LOCK_EX)  # 获取独占锁
                        layout_info_str = json.dumps(layout_info, indent=4)
                        f.write(layout_info_str)
                    finally:
                        fcntl.flock(f, fcntl.LOCK_UN)  # 释放锁

                # 写入datatable文件
                with open(datatable_path, "w", encoding="utf-8") as f:
                    try:
                        fcntl.flock(f, fcntl.LOCK_EX)  # 获取独占锁
                        datatable_str = json.dumps(data["data"], indent=4)
                        f.write(datatable_str)
                    finally:
                        fcntl.flock(f, fcntl.LOCK_UN)  # 释放锁

                # 转换为PNG
                subprocess.run([
                    'rsvg-convert',
                    '-f', 'png',
                    '-o', png_path,
                    '--dpi-x', '300',
                    '--dpi-y', '300',
                    '--background-color', '#ffffff',
                    output_path
                ], check=True)
                
                # 如果所有操作都成功,跳出循环
                break
                
            except Exception as e:
                retry_count += 1
                if retry_count >= max_retries:
                    raise Exception(f"重试{max_retries}次后仍然失败")
                time.sleep(1)  # 等待1秒后重试

        # except Exception as e:
        #     logger.error(f"Error processing infographics: {e}")
        #     return False
        
        # 获取当前时间戳
        timestamp = int(time.time())
        output_dir = os.path.dirname(output)
        output_filename = os.path.basename(output)        
        new_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.svg"        
        output_path = os.path.join(output_dir, new_filename)

        print(f'final output_path: {output_path}')
        
        # 保存最终的SVG
        save_start = time.time()
        with open(output_path, "w", encoding="utf-8") as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX)  # 获取独占锁
                f.write(final_svg)
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)  # 释放锁
        save_time = time.time() - save_start
    except Exception as e:
        logger.error(f"Error processing infographics: {e}")
        return False
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
