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
from lxml import etree
from PIL import Image
import base64
import io
import tempfile
import random
import fcntl

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

from modules.chart_engine.chart_engine import get_template_for_chart_name, render_chart_to_svg
from modules.chart_engine.template.template_registry import scan_templates
from modules.title_styler.title_styler import process as title_styler_process
from modules.infographics_generator.mask_utils import fill_columns_between_bounds, calculate_mask_v2, expand_mask, calculate_mask_v3
from modules.infographics_generator.svg_utils import extract_svg_content, extract_large_rect, adjust_and_get_bbox, add_gradient_to_rect, extract_background_element
from modules.infographics_generator.image_utils import find_best_size_and_position
from modules.infographics_generator.template_utils import (
    analyze_templates,
    check_template_compatibility,
    select_template,
    process_template_requirements
)
from modules.infographics_generator.data_utils import process_temporal_data, process_numerical_data, deduplicate_combinations
from modules.infographics_generator.color_utils import is_dark_color, lighten_color

padding = 50
between_padding = 35


def make_infographic(
    data: Dict,
    chart_svg_content: str,
    padding: int,
    between_padding: int,
    dark: bool,
    has_title: bool,
    html_path: str,
    mask_path: str,
    title_font_family: str
) -> str:
    if not dark:
        background_color = data["colors"].get("background_color", "#FFFFFF")
        if is_dark_color(background_color):
            background_color = lighten_color(background_color, amount=0.3)
            data["colors"]["background_color"] = background_color
    else:
        background_color = data["colors_dark"].get("background_color", "#000000")
    chart_content, chart_width, chart_height, chart_offset_x, chart_offset_y = adjust_and_get_bbox(chart_svg_content, background_color)
    chart_aspect_ratio = chart_width / chart_height
    thin_chart_flag = False
    if chart_aspect_ratio < 0.9:
        thin_chart_flag = True
    
    chart_svg_content = f"<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='{chart_width}' height='{chart_height}'>{chart_content}</svg>"
    mask = calculate_mask_v2(chart_svg_content, chart_width, chart_height, background_color)
    mask = expand_mask(mask, 10)
    title_candidates = []
    min_title_width = max(250, chart_width / 2)
    if thin_chart_flag:
        max_title_width = max(chart_width, 600)
    else:
        max_title_width = chart_width
    steps = np.ceil((max_title_width - min_title_width) / 100).astype(int)
    
    # Visualize the mask for debugging
    import matplotlib.pyplot as plt
    
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

    for i in range(steps + 1):
        width = min_title_width + i * (max_title_width - min_title_width) / steps
        title_content = title_styler_process(
            input_data=data, 
            max_width=int(width), 
            text_align="left", 
            show_embellishment=False,
            font_family=title_font_family
        )
        title_svg_content = title_content
        svg_tree = etree.fromstring(title_svg_content.encode())
        width = int(float(svg_tree.get("width", 0)))
        height = int(float(svg_tree.get("height", 0)))
        title_candidates.append({
            "width": width,
            "height": height,
        })
        
    mask_top = np.argmax(mask, axis=0)
    mask_bottom = mask.shape[0] - 1 - np.argmax(np.flip(mask, axis=0), axis=0)
    mask_left = np.argmax(mask, axis=1)
    mask_right = mask.shape[1] - 1 - np.argmax(np.flip(mask, axis=1), axis=1)
    
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
        temp_file.write(base64.b64decode(mask_img))
    
    mask_1_count = np.sum(mask)
    mask_0_count = np.sum(1 - mask)
    mask_1_ratio = mask_1_count / (mask_1_count + mask_0_count)
    
    # 初始化best_title默认值为None，用于后续检查
    best_title = None
    lower_chart_type = data["chart_type"].lower()
    if mask_1_ratio > 0.20 and mask_1_ratio < 0.5 and ("donut" in lower_chart_type and "multiple" not in lower_chart_type):
        width = average_distance*2
        title_content = title_styler_process(
            input_data=data, max_width=int(width), text_align="center", show_embellishment=False, show_sub_title=False,
            font_family=title_font_family
        )
        title_svg_content = title_content
        svg_tree = etree.fromstring(title_svg_content.encode())
        width = int(float(svg_tree.get("width", 0)))
        height = int(float(svg_tree.get("height", 0)))
        title_candidates = [{"width": width, "height": height}]
        for i in range(len(distance_list)):
            if distance_list[i] > width:
                best_title = {
                    "width": width,
                    "height": height,
                    "text-align": "center",
                    "is_first": False,
                    "title-to-chart": "C",
                    "total_height": chart_height,
                    "total_width": max(chart_width, width),
                    "chart": (0, 0),
                    "title": (chart_width // 2 - width // 2, i),
                    "show_sub_title": False
                }
                break
    
    # 如果没有找到合适的best_title（width太大或其他原因），使用默认处理逻辑
    if best_title is None:
        default_title = {
            "title": (0, 0),
            "chart": (0, title_candidates[-1]["height"] + between_padding),
            "text-align": "left",
            "title-to-chart": "TL",
            "width": title_candidates[-1]["width"],
            "height": title_candidates[-1]["height"],
            "total_height": title_candidates[-1]["height"] + chart_height + between_padding,
            "total_width": max(title_candidates[-1]["width"], chart_width),
            "is_first": True,
            "area": (title_candidates[-1]["height"] + between_padding + chart_height) * (chart_width)
        }
        area_threshold = 1.05
        default_area = default_title["area"] * area_threshold
        other_title = {}

        for title in title_candidates:
            title_width = title["width"] + between_padding
            title_height = title["height"] + between_padding
            offset_list = [0, 25, 50, 75, 100, 125, 150]

            # for top
            range_start = max(0, chart_width // 2 - title_width // 2)
            range_end = min(chart_width, range_start + title_width)
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
                    "height": title["height"],
                    "total_height": max(title_height - min_top, 0) + chart_height,
                    "total_width": max(range_start + title_width, chart_width),
                    "area": area
                }

            # for bottom
            range_start = max(0,chart_width // 2 - title_width // 2)
            range_end = min(chart_width, range_start + title_width)
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
                    "height": title["height"],
                    "total_height": max(title_y + title_height, chart_height),
                    "total_width": max(range_start + title_width, chart_width),
                    "area": area
                }
            if thin_chart_flag:
                continue
            
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
                        "height": title["height"],
                        "total_height": max(title_height - min_top, 0) + chart_height,
                        "total_width": max(chart_width + offset, title_width),
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
                        "height": title["height"],
                        "total_height": max(title_height - (chart_height - max_bottom), 0) + chart_height,
                        "total_width": max(chart_width + offset, title_width),
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
                        "height": title["height"],
                        "total_height": max(title_height - min_top, 0) + chart_height,
                        "total_width": max(chart_width + offset, title_width),
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
                        "height": title["height"],
                        "total_height": max(title_height - (chart_height - max_bottom), 0) + chart_height,
                        "total_width": max(chart_width + offset, title_width),
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
                        "chart": (max(title_width - min_left, 0), 0),
                        "text-align": "left",
                        "title-to-chart": "L",
                        "width": title["width"],
                        "height": title["height"],
                        "total_height": chart_height,
                        "total_width": max(title_width - min_left, 0) + chart_width,
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
                        "chart": (max(title_width - min_left, 0), 0),
                        "text-align": "left",
                        "title-to-chart": "L",
                        "width": title["width"],
                        "height": title["height"],
                        "total_height": chart_height,
                        "total_width": max(title_width - min_left, 0) + chart_width,
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
                        "height": title["height"],
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
                        "height": title["height"],
                        "total_height": chart_height,
                        "total_width": max(title_x + title_width, chart_width),
                        "area": area
                    }

        if len(other_title.values()) == 0:
            best_title = default_title
        else:
            title_options = [default_title] + list(other_title.values())
            min_area = min(title_options, key=lambda x: x["area"])["area"]
            title_options = [t for t in title_options if t["area"] <= min_area * area_threshold]
            option_weights = [2 if t["title-to-chart"] == "TL" else 1 for t in title_options]
            best_title = random.choices(title_options, weights=option_weights, k=1)[0]
    
    title_content = title_styler_process(input_data=data, \
                                         max_width=best_title["width"], \
                                         text_align=best_title["text-align"], \
                                         show_embellishment=best_title["text-align"] == "left" and best_title.get("is_first", False), \
                                         show_sub_title=best_title.get("show_sub_title", True), \
                                         font_family=title_font_family)
    title_inner_content = extract_svg_content(title_content)
    
    total_height = best_title["total_height"] + padding * 2
    total_width = best_title["total_width"] + padding * 2
    
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

    original_mask = calculate_mask_v2(final_svg + "\n</svg>", total_width, total_height, background_color)
    original_mask = fill_columns_between_bounds(original_mask, padding + best_title['title'][0], padding + best_title['title'][0] + best_title['width'], \
                                padding + best_title['title'][1], padding + best_title['title'][1] + best_title['height'])

    mask_img = visualize_mask(original_mask, "Chart Mask")
    with open(mask_path, "wb") as f:
        f.write(base64.b64decode(mask_img))

    primary_image = data.get("images", {}).get("other", {}).get("primary")

    image_element = ""
    overlay_image_size = 0
    side_image_size = 0
    background_image_size = 0
    if primary_image:
        if "base64," not in primary_image:
            primary_image = f"data:image/png;base64,{primary_image}"

        side_mask = expand_mask(original_mask, 8)
        side_image_size, side_best_x, side_best_y = find_best_size_and_position(side_mask, primary_image, padding, mode="side")
        measure_side_size = min(side_image_size, 256)

        overlay_mask, overlay_mask_only_text = calculate_mask_v3(final_svg + "\n</svg>", total_width, total_height, background_color)
        overlay_mask = expand_mask(overlay_mask, 5)
        overlay_mask_only_text = expand_mask(overlay_mask_only_text, 5)
        # 将overlay_mask保存为PNG文件
        plt.figure(figsize=(10, 8))
        plt.imshow(overlay_mask, cmap='viridis')
        plt.savefig('./tmp/overlay.png')
        plt.close()

        plt.figure(figsize=(10, 8))
        plt.imshow(overlay_mask_only_text, cmap='viridis')
        plt.savefig('./tmp/overlay_mask_only_text.png')
        plt.close()


        overlay_image_size, overlay_best_x, overlay_best_y = find_best_size_and_position(overlay_mask, primary_image, padding, mode="overlay", avoid_mask=overlay_mask_only_text)
        if overlay_image_size > 256:
            delta = overlay_image_size - 256
            overlay_best_x += delta / 2
            overlay_best_y += delta / 2
            overlay_image_size = min(overlay_image_size, 256)
        elif overlay_image_size > 64:
            delta = 32
            overlay_best_x += delta / 2
            overlay_best_y += delta / 2
            overlay_image_size -= delta
        measure_overlay_size = overlay_image_size

        if side_image_size > 320:
            delta = side_image_size - 320
            side_best_x += delta / 2
            side_best_y += delta / 2
            side_image_size -= delta
        elif side_image_size > 256:
            delta = 32
            side_best_x += delta / 2
            side_best_y += delta / 2
            side_image_size -= delta

        min_acceptable_size = 48
        if measure_side_size > min_acceptable_size or measure_overlay_size > min_acceptable_size:
            if side_image_size >= overlay_image_size * 0.45:
                image_size = side_image_size
                best_x = side_best_x
                best_y = side_best_y
                image_mode = "side"
            else:
                image_size = overlay_image_size
                best_x = overlay_best_x
                best_y = overlay_best_y
                image_mode = "overlay"
        else:
            background_mask = original_mask
            background_image_size, background_best_x, background_best_y = find_best_size_and_position(background_mask, primary_image, padding, mode="background", chart_bbox=chart_bbox)
            measure_background_size = min(background_image_size, 512)

            if measure_background_size > 128:
                image_size = background_image_size
                best_x = background_best_x
                best_y = background_best_y
                image_mode = "background"
            else:
                image_size = 0

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
            if (image_mode == "side" or image_mode == "overlay") and image_size > 192:
                delta = between_padding / 2
                image_size -= delta * 2
                if image_to_chart == "C":
                    best_x += delta
                    best_y += delta
                if "B" in image_to_chart:
                    best_y += delta * 2
                if "R" in image_to_chart:
                    best_x += delta * 2

            image_opacity = 1
            if image_mode == "background":
                image_opacity = 0.3
            elif image_mode == "overlay":
                image_opacity = 0.5

            image_element = f"""
                <image
                    class="image"
                    x="{best_x + padding}"
                    y="{best_y + padding}"
                    width="{image_size}"
                    height="{image_size}"
                    preserveAspectRatio="none"
                    href="{primary_image}"
                    opacity="{image_opacity}"
                />"""
            final_svg += image_element
            
    total_width += padding * 2
    total_height += padding
    chart_content, background_element = extract_large_rect(chart_content)
    if background_element == "":
        background_element = add_gradient_to_rect(f'<rect x="0" y="0" width="{total_width}" height="{total_height}" fill="{background_color}" />')
    else:
        background_element = re.sub(r'width="[^"]+"', f'width="{total_width}"', background_element)
        background_element = re.sub(r'height="[^"]+"', f'height="{total_height}"', background_element)
        background_layer = add_gradient_to_rect(f'<rect x="0" y="0" width="{total_width}" height="{total_height}" fill="{background_color}" />')
        background_element = background_layer + background_element
    if has_title:
        title_inner_content = ""

    if image_mode == "side" or image_mode == "overlay":
        final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
        {background_element}
        <g class="chart" transform="translate({padding * 2 + best_title['chart'][0]}, {padding * 2 + best_title['chart'][1]})">{chart_content}</g>
        <g class="text" fill="{text_color}" transform="translate({padding * 2 + best_title['title'][0]}, {padding * 2 + best_title['title'][1]})">{title_inner_content}</g>
        {image_element}\n</svg>"""
    elif image_mode == "background":
        final_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{total_width}" height="{total_height}" style="font-family: Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif;">
        {background_element}
        {image_element}\n
        <g class="chart" transform="translate({padding * 2 + best_title['chart'][0]}, {padding * 2 + best_title['chart'][1]})">{chart_content}</g>
        <g class="text" fill="{text_color}" transform="translate({padding * 2 + best_title['title'][0]}, {padding * 2 + best_title['title'][1]})">{title_inner_content}</g>
        </svg>"""
        final_svg = extract_background_element(final_svg)
        

    layout_info = {
        "text_color": text_color,
        "background_color": background_color,
        "title_to_chart": best_title["title-to-chart"] if not has_title else "R",
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
    try:
        start_time = time.time()
        
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
            engine, chart_type, chart_name, ordered_fields = select_template(compatible_templates)
            
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
        engine, chart_type, chart_name, ordered_fields = select_template(compatible_templates)
        
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
        title_font_family = "Arial"
        if "hand" in chart_name:
            title_font_family = "Comics"
        
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
        
        render_chart_to_svg(
            json_data=data,
            output_svg_path=chart_svg_path,
            js_file=template,
            framework=framework,
            framework_type=framework_type,
            html_output_path=html_path
        )
        render_chart_time = time.time() - render_chart_start
        logger.info(f"Rendering chart took: {render_chart_time:.4f} seconds")
        
        with open(chart_svg_path, "r", encoding="utf-8") as f:
            chart_svg_content = f.read()
            if "This is a fallback SVG using a PNG screenshot" in chart_svg_content:
                return False
            chart_inner_content = extract_svg_content(chart_svg_content)
        
        assemble_start = time.time()
        data["chart_type"] = chart_type
        final_svg, layout_info = make_infographic(
            data=data,
            chart_svg_content=chart_inner_content,
            padding=padding,
            between_padding=between_padding,
            dark=requirements.get("background", "light") == "dark",
            has_title='has_title' in requirements,
            html_path=html_path,
            mask_path=mask_path,
            title_font_family=title_font_family
        )
        
        layout_info["chart_variation"] = chart_name
        layout_info["chart_type"] = chart_type
        layout_info["data_source"] = input

        assemble_time = time.time() - assemble_start
        logger.info(f"Assembling infographic took: {assemble_time:.4f} seconds")
        
        if final_svg is None:
            logger.error("Failed to assemble infographic: SVG content extraction failed")
            return False
        
        # 使用文件锁保护写入操作,最多重试3次
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # 写入SVG文件
                with open(output_path, "w", encoding="utf-8") as f:
                    try:
                        fcntl.flock(f, fcntl.LOCK_EX)
                        f.write(final_svg)
                    finally:
                        fcntl.flock(f, fcntl.LOCK_UN)

                # 写入info文件
                with open(info_path, "w", encoding="utf-8") as f:
                    try:
                        fcntl.flock(f, fcntl.LOCK_EX)
                        layout_info_str = json.dumps(layout_info, indent=4)
                        f.write(layout_info_str)
                    finally:
                        fcntl.flock(f, fcntl.LOCK_UN)

                # 写入datatable文件
                with open(datatable_path, "w", encoding="utf-8") as f:
                    try:
                        fcntl.flock(f, fcntl.LOCK_EX)
                        datatable_str = json.dumps(data["data"], indent=4)
                        f.write(datatable_str)
                    finally:
                        fcntl.flock(f, fcntl.LOCK_UN)

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
                time.sleep(1)
        
        # 获取当前时间戳
        timestamp = int(time.time())
        output_dir = os.path.dirname(output)
        output_filename = os.path.basename(output)        
        new_filename = f"{timestamp}_{chart_name}_{os.path.splitext(output_filename)[0]}.svg"        
        output_path = os.path.join(output_dir, new_filename)
        
        # 保存最终的SVG
        with open(output_path, "w", encoding="utf-8") as f:
            try:
                fcntl.flock(f, fcntl.LOCK_EX)
                f.write(final_svg)
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
                
    except Exception as e:
        logger.error(f"Error processing infographics: {e}")
        return False
    
    return True

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Infographics Generator")
    parser.add_argument("--input", type=str, required=True, help="Input JSON file path")
    parser.add_argument("--output", type=str, required=True, help="Output SVG file path")
    args = parser.parse_args()

    success = process(input=args.input, output=args.output, base_url="", api_key="")
    if success:
        print("Processing json successed.")
    else:
        print("Processing json failed.")

if __name__ == "__main__":
    main() 