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
from .color_utils import get_contrast_color
from .mask_utils import calculate_mask, calculate_content_height
from .image_utils import find_best_size_and_position
from .svg_utils import extract_svg_content

padding = 50
between_padding = 25
grid_size = 5

def get_unique_fields_and_types(required_fields: Union[List[str], List[List[str]]], required_fields_type: List[List[str]]) -> Tuple[List[str], Dict[str, str]]:
    """Extract unique fields and their corresponding types from nested structure"""
    field_order = ['x', 'y', 'y2', 'group']  # Define the order of fields
    field_types = {}
    
    # Check if required_fields is a list of lists
    if required_fields and isinstance(required_fields[0], list):
        # Handle list of lists case
        for fields_group, types_group in zip(required_fields, required_fields_type):
            for field, type_list in zip(fields_group, types_group):
                if field not in field_types:
                    field_types[field] = type_list[0]  # Use first type from the list
    else:
        # Handle simple list case
        for field, type_list in zip(required_fields, required_fields_type):
            if field not in field_types:
                field_types[field] = type_list[0]  # Use first type from the list
    
    # Order fields according to field_order, keeping only those that exist
    ordered_fields = [field for field in field_order if field in field_types]
    
    return ordered_fields, field_types

def analyze_templates(templates: Dict) -> Tuple[int, Dict[str, str], int]:
    """Analyze templates and return count, data requirements and unique colors count"""
    template_count = 0
    template_requirements = {}
    unique_colors = set()
    
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_count += 1
                if 'requirements' in template_info:
                    req = template_info['requirements']
                    
                    # Count unique required colors
                    if 'required_other_colors' in req:
                        for color in req['required_other_colors']:
                            unique_colors.add(color)

                    if 'required_fields_colors' in req:
                        for color in req['required_fields_colors']:
                            unique_colors.add(color)
                        
                    if 'required_fields' in req and 'required_fields_type' in req:
                        ordered_fields, field_types = get_unique_fields_and_types(
                            req['required_fields'],
                            req['required_fields_type']
                        )
                        template_requirements[f"{engine}/{chart_type}/{chart_name}"] = template_info['requirements']
                    
    # print("unique colors: ", unique_colors)
    return template_count, template_requirements

def check_template_compatibility(data: Dict, templates: Dict) -> List[str]:
    """Check which templates are compatible with the given data"""
    compatible_templates = []
    
    # Get the combination type from the data
    combination_type = data.get("data", {}).get("type_combination", "")
    if not combination_type:
        return compatible_templates
    
    for engine, templates_dict in templates.items():
        # Skip vegalite-py templates
        #if engine == 'vegalite-py':
        #    continue
        ### WARNING: For liduan debug
        if engine != 'vegalite-py':
            continue
            
        for chart_type, chart_names_dict in templates_dict.items():
            for chart_name, template_info in chart_names_dict.items():
                template_key = f"{engine}/{chart_type}/{chart_name}"
                
                if 'requirements' in template_info:
                    req = template_info['requirements']
                    if 'required_fields' in req and 'required_fields_type' in req:
                        ordered_fields, field_types = get_unique_fields_and_types(
                            req['required_fields'],
                            req['required_fields_type']
                        )
                        data_type_str = ' + '.join([field_types[field] for field in ordered_fields])
                        
                        if len(req.get('required_fields_colors', [])) > 0 and len(data["colors"]["field"]) == 0:
                            continue

                        if len(req.get('required_fields_icons', [])) > 0 and len(data["images"]["field"]) == 0:
                            continue

                        # If the combination type matches the template's data type, it's compatible
                        if combination_type == data_type_str:
                            compatible_templates.append(template_key)
                        
    return compatible_templates

def calculate_mask(svg_content: str, width: int, height: int) -> np.ndarray:
    """将SVG转换为二值化的mask数组"""
    width = int(width)
    height = int(height)
    
    # 创建临时文件
    tmp_dir = "./tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    mask_svg = os.path.join(tmp_dir, f"temp_mask_{random.randint(0, 999999)}.svg")
    temp_mask_png = os.path.join(tmp_dir, f"temp_mask_{random.randint(0, 999999)}.png")
    
    try:
        # 修改SVG内容，移除渐变
        mask_svg_content = svg_content.replace('url(#', 'none')
        mask_svg_content = mask_svg_content.replace('&', '&amp;')
        
        # print("mask_svg: ", mask_svg)
        with open(mask_svg, "w", encoding="utf-8") as f:
            f.write(mask_svg_content)
            
        subprocess.run([
            'rsvg-convert',
            '-f', 'png',
            '-o', temp_mask_png,
            '--dpi-x', '300',
            '--dpi-y', '300',
            '--background-color', '#ffffff',
            mask_svg
        ], check=True)
        
        # 读取为numpy数组并处理
        img = Image.open(temp_mask_png).convert('RGB')
        img_array = np.array(img)
        
        # 确保图像尺寸匹配预期尺寸
        actual_height, actual_width = img_array.shape[:2]
        if actual_width != width or actual_height != height:
            img = img.resize((width, height), Image.LANCZOS)
            img_array = np.array(img)
        
        # 转换为二值mask
        grid_size = 5
        mask = np.ones((height, width), dtype=np.uint8)
        
        for y in range(0, height, grid_size):
            for x in range(0, width, grid_size):
                y_end = min(y + grid_size, height)
                x_end = min(x + grid_size, width)
                
                if y_end > y and x_end > x:
                    grid = img_array[y:y_end, x:x_end]
                    if grid.size > 0:
                        white_pixels = np.all(grid >= 220, axis=2)
                        white_ratio = np.mean(white_pixels)
                        mask[y:y_end, x:x_end] = 0 if white_ratio > 0.85 else 1
        
        return mask
        
    finally:
        # if os.path.exists(mask_svg):
        #     os.remove(mask_svg)
        # if os.path.exists(temp_mask_png):
        #     os.remove(temp_mask_png)
        pass

def calculate_content_height(mask: np.ndarray) -> Tuple[int, int, int]:
    """计算mask中内容的实际高度范围"""
    # 在计算行是否有内容时，确保使用正确的阈值
    # mask中1表示内容，0表示背景
    content_rows = np.sum(mask == 1, axis=1) > 0  # 任何非零值表示该行有内容
    content_indices = np.where(content_rows)[0]
    
    if len(content_indices) == 0:
        return 0, 0, 0
        
    start_y = content_indices[0]
    end_y = content_indices[-1]
    height = end_y - start_y + 1
    
    return start_y, end_y, height

def find_best_size_and_position(main_mask: np.ndarray, image_content: str, padding: int) -> Tuple[int, int, int]:
    """
    通过降采样加速查找最佳图片尺寸和位置
    
    Args:
        main_mask: 主要内容的mask
        image_content: base64图片内容
        padding: 边界padding
    
    Returns:
        Tuple[int, int, int]: (image_size, best_x, best_y)
    """
    grid_size = 5  # 使用与calculate_mask相同的网格大小
    
    # 将main_mask降采样到1/grid_size大小
    h, w = main_mask.shape
    downsampled_h = h // grid_size
    downsampled_w = w // grid_size
    downsampled_main = np.zeros((downsampled_h, downsampled_w), dtype=np.uint8)
    
    # 对每个grid进行降采样，只要原grid中有内容（1）就标记为1
    for i in range(downsampled_h):
        for j in range(downsampled_w):
            y_start = i * grid_size
            x_start = j * grid_size
            y_end = min((i + 1) * grid_size, h)
            x_end = min((j + 1) * grid_size, w)
            grid = main_mask[y_start:y_end, x_start:x_end]
            downsampled_main[i, j] = 1 if np.any(grid == 1) else 0
    
    # 调整padding到降采样尺度
    downsampled_padding = max(1, padding // grid_size)
    
    # 二分查找最佳尺寸
    min_size = max(1, 128 // grid_size)  # 最小尺寸也要降采样
    max_size = int(min(downsampled_main.shape) * 0.5)
    best_size = min_size
    best_x = downsampled_padding
    best_y = downsampled_padding
    best_overlap_ratio = float('inf')
    
    while max_size - min_size >= 2:  # 由于降采样，可以用更小的阈值
        mid_size = (min_size + max_size) // 2
        
        # 生成当前尺寸的图片mask并降采样
        original_size = mid_size * grid_size
        temp_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{original_size}" height="{original_size}">
            <image width="{original_size}" height="{original_size}" href="{image_content}"/>
        </svg>"""
        image_mask = calculate_mask(temp_svg, original_size, original_size)
        
        # 将image_mask降采样
        downsampled_image = np.zeros((mid_size, mid_size), dtype=np.uint8)
        for i in range(mid_size):
            for j in range(mid_size):
                y_start = i * grid_size
                x_start = j * grid_size
                y_end = min((i + 1) * grid_size, original_size)
                x_end = min((j + 1) * grid_size, original_size)
                grid = image_mask[y_start:y_end, x_start:x_end]
                downsampled_image[i, j] = 1 if np.any(grid == 1) else 0
        
        # 计算有效的搜索范围
        y_range = downsampled_h - mid_size - downsampled_padding * 2
        x_range = downsampled_w - mid_size - downsampled_padding * 2
        
        if y_range <= 0 or x_range <= 0:
            max_size = mid_size - 1
            continue
        
        # 在降采样空间中寻找最佳位置
        min_overlap = float('inf')
        current_x = downsampled_padding
        current_y = downsampled_padding
        
        for y in range(downsampled_padding, downsampled_h - mid_size - downsampled_padding + 1):
            for x in range(downsampled_padding, downsampled_w - mid_size - downsampled_padding + 1):
                # 提取当前位置的区域
                region = downsampled_main[y:y + mid_size, x:x + mid_size]
                
                # 计算重叠
                overlap = np.sum((region == 1) & (downsampled_image == 1))
                total = np.sum(downsampled_image == 1)
                overlap_ratio = overlap / total if total > 0 else 1.0
                
                if overlap_ratio < min_overlap:
                    min_overlap = overlap_ratio
                    current_x = x
                    current_y = y
        
        print(f"Trying size {mid_size * grid_size}x{mid_size * grid_size}, minimum overlap ratio: {min_overlap:.3f}")
        
        if min_overlap < 0.025:  # 允许2.5%的重叠
            best_size = mid_size
            best_overlap_ratio = min_overlap
            best_x = current_x
            best_y = current_y
            min_size = mid_size + 1
        else:
            max_size = mid_size - 1
    
    # 将结果转换回原始尺度
    final_size = best_size * grid_size
    final_x = best_x * grid_size
    final_y = best_y * grid_size
    
    print(f"Final result: size={final_size}x{final_size}, position=({final_x}, {final_y}), overlap ratio={best_overlap_ratio:.3f}")
    
    return final_size, final_x, final_y

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

def process(input: str, output: str, base_url: str, api_key: str) -> bool:
    """
    Pipeline入口函数，处理单个文件的信息图生成
    
    Args:
        input: 输入JSON文件路径
        output: 输出SVG文件路径
        
    Returns:
        bool: 处理是否成功
    """
    # try:
    # 读取输入文件
    with open(input, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    logger.info("input file: %s", input)
    logger.info("output file: %s", output)
    # 扫描并获取所有可用的模板
    templates = scan_templates()
        
    
    # Count total templates
    total_templates = 0
    for engine, templates_dict in templates.items():
        for chart_type, chart_names_dict in templates_dict.items():
            total_templates += len(chart_names_dict)
    # logger.info(f"\nTotal number of templates: {total_templates}")
    
    # Analyze templates and get requirements
    template_count, template_requirements = analyze_templates(templates)
    # logger.info(f"Number of templates with requirements: {template_count}")
    
    # Log template requirements
    # logger.info("\nTemplate data requirements:")
    # for template_name, data_type in template_requirements.items():
    #     logger.info(f"{template_name}: {data_type}")
        
    # Check compatibility with current data
    compatible_templates = check_template_compatibility(data, templates)
    logger.info(f"\nNumber of compatible templates: {len(compatible_templates)}")
    
    if not compatible_templates:
        logger.error("No compatible templates found for the given data")
        return False
        
    # 随机选择一个兼容的模板
    selected_template = random.choice(compatible_templates)
    engine, chart_type, chart_name = selected_template.split('/')
    # 打印选择的模板信息
    logger.info(f"\nSelected template: {selected_template}")
    logger.info(f"Engine: {engine}")
    logger.info(f"Chart type: {chart_type}")
    logger.info(f"Chart name: {chart_name}\n")

    requirements = template_requirements[selected_template]
    if len(requirements["required_other_colors"]) > 0:
        for key in requirements["required_other_colors"]:
            if key == "positive" and "positive" not in data["colors"]["other"]:
                data["colors"]["other"]["positive"] = data["colors"]["other"]["primary"]
            elif key == "negative" and "negative" not in data["colors"]["other"]:
                data["colors"]["other"]["negative"] = get_contrast_color(data["colors"]["other"]["primary"])

    for column in data["data"]["columns"]:
        if column["data_type"] == "temporal":
            # 处理时间格式
            for row in data["data"]["data"]:
                value = str(row.get(column["name"], ""))
                
                try:
                    # 处理简单年份格式 (如 "05" 表示 2005)
                    if value.isdigit():
                        if len(value) == 2:
                            row[column["name"]] = f"2000-{value}"  # 使用年份-月份格式
                        else:
                            row[column["name"]] = value  # 保持原样的年份
                        continue
                    
                    # 处理带小数点的年份格式 (如 "2025.1" → "2025-01")
                    if "." in value:
                        year, month = value.split(".")
                        if year.isdigit() and month.isdigit():
                            # 确保月份是两位数
                            month = month.zfill(2)
                            row[column["name"]] = f"{year}-{month}"
                        continue
                    
                    # 处理月份年份组合 (如 "Jul 2025")
                    if " " in value:
                        from datetime import datetime
                        try:
                            # 尝试解析完整的月份名称
                            date_obj = datetime.strptime(value, "%B %Y")
                        except ValueError:
                            try:
                                # 尝试解析缩写的月份名称
                                date_obj = datetime.strptime(value, "%b %Y")
                            except ValueError:
                                continue
                        
                        # 转换为 "YYYY-MM" 格式
                        row[column["name"]] = date_obj.strftime("%Y-%m")
                        continue
                        
                except Exception as e:
                    logger.warning(f"Failed to parse temporal value '{value}': {str(e)}")
                    # 如果解析失败，保留原始值
                    continue
        
        elif column["data_type"] == "numerical":
            # 处理数值类型
            for row in data["data"]["data"]:
                value = row.get(column["name"])
                
                # 处理 null 或 None
                if value is None or value == "null" or value == "":
                    row[column["name"]] = 0
                    continue
                
                # 转换为字符串以进行处理
                value_str = str(value)
                
                # 提取数字（包括负号和小数点）
                import re
                numeric_chars = re.findall(r'-?\d*\.?\d+', value_str)
                if numeric_chars:
                    # 使用第一个匹配的数字
                    try:
                        row[column["name"]] = float(numeric_chars[0])
                    except ValueError:
                        row[column["name"]] = 0
                else:
                    row[column["name"]] = 0
    
    # 获取图表模板
    engine_obj, template = get_template_for_chart_name(chart_name)
    if engine_obj is None or template is None:
        logger.error(f"Failed to load template: {selected_template}")
        return False
    
    # 创建临时目录
    tmp_dir = "./tmp"
    os.makedirs(tmp_dir, exist_ok=True)
    
    # 处理输出文件名，将路径分隔符替换为下划线
    safe_output_name = os.path.basename(output).replace('/', '_').replace('\\', '_')
    
    # 生成图表SVG，使用安全的文件名
    chart_svg_path = os.path.join(tmp_dir, f"{os.path.splitext(safe_output_name)[0]}.chart.tmp")
    # try:
    render_chart_to_svg(
        json_data=data,
        output_svg_path=chart_svg_path,
        js_file=template,
        framework=engine.split('-')[0]  # Extract framework name (echarts/d3)
    )
    # except Exception as e:
    #     logger.error(f"Failed to generate chart SVG: {str(e)}")
    #     return False
        
    # 读取生成的SVG内容
    with open(chart_svg_path, "r", encoding="utf-8") as f:
        chart_svg_content = f.read()
        if "This is a fallback SVG using a PNG screenshot" in chart_svg_content:
            return False
        
        # 检查并删除大型rect
        try:
            svg_tree = etree.fromstring(chart_svg_content.encode())
            for rect in svg_tree.xpath("//rect"):
                width = float(rect.get("width", 0))
                height = float(rect.get("height", 0))
                if width * height > 500 * 500:
                    rect.getparent().remove(rect)
            chart_svg_content = etree.tostring(svg_tree, encoding='unicode')
        except Exception as e:
            logger.warning(f"Failed to process large rects: {str(e)}")
        
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
        
    # 确保输出文件扩展名是svg
    output_path = os.path.splitext(output)[0] + '.svg'
    
    # 保存最终的SVG
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_svg)
        
    png_file = f"{os.path.splitext(output)[0]}.png"
    mask_file = f"{os.path.splitext(output)[0]}_mask.png"
    
    '''
    # 生成PNG
    subprocess.run([
        'rsvg-convert',
        '-f', 'png',
        '-o', png_file,
        '--dpi-x', '300',
        '--dpi-y', '300',
        output
    ], check=True)
    '''
    
    os.remove(chart_svg_path)
    return True
            
    # except Exception as e:
    #     logger.error(f"信息图生成失败: {str(e)}")
    #     return False

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