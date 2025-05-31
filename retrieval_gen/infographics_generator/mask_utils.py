import os
import random
import subprocess
import re
from PIL import Image
import numpy as np
from typing import Tuple
import tempfile
from bs4 import BeautifulSoup
import scipy.ndimage as ndimage

def calculate_mask_v3(svg_content: str, width: int, height: int, background_color: str, grid_size: int = 5, max_difference = 15) -> np.ndarray:
    """将SVG转换为基于背景色的二值化mask数组"""
    width = int(width)
    height = int(height)
    
    # 将背景色转换为RGB格式
    original_background_color = background_color
    background_color = tuple(int(background_color[i:i+2], 16) for i in (1, 3, 5))
    
    # 预处理SVG内容，删除背景元素和细线条
    
    # 解析SVG内容
    soup = BeautifulSoup(svg_content, 'xml')
    
    # 删除class="background"的所有元素
    background_elements = soup.select('[class="background"]')
    for element in background_elements:
        element.decompose()
    
    # 删除stroke-width<=1的所有line元素
    thin_lines = soup.find_all('line')
    for line in thin_lines:
        stroke_width = line.get('stroke-width')
        if stroke_width and float(stroke_width) <= 1:
            line.decompose()
    # 删除所有text元素
    text_elements = soup.find_all('text')
    for text in text_elements:
        text.decompose()
    
    # 重新获取处理后的SVG内容
    svg_content_without_text = str(soup)
    
    # 创建临时文件
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as mask_svg_file_without_text, \
         tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_mask_png_file_without_text:
        mask_svg_without_text = mask_svg_file_without_text.name
        temp_mask_png_without_text = temp_mask_png_file_without_text.name
        
        # 修改SVG内容，移除渐变
        # 将渐变填充替换为可见的纯色填充，而不是none
        mask_svg_content = svg_content_without_text
        # mask_svg_content = re.sub(r'fill="url\(#[^"]*\)"', 'fill="#333333"', mask_svg_content)
        # mask_svg_content = re.sub(r'stroke="url\(#[^"]*\)"', 'stroke="#333333"', mask_svg_content)
        mask_svg_content = mask_svg_content.replace('&', '&amp;')
        
        # 提取SVG内容并添加新的SVG标签
        svg_content_match = re.search(r'<svg[^>]*>(.*?)</svg>', mask_svg_content, re.DOTALL)
        if svg_content_match:
            inner_content = svg_content_match.group(1)
            # 创建新的SVG标签
            mask_svg_content = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}"> \
            <rect width="{width}" height="{height}" fill="{original_background_color}" /> \
            {inner_content} \
            </svg>'
        
        mask_svg_file_without_text.write(mask_svg_content.encode('utf-8'))
        
        subprocess.run([
            'rsvg-convert',
            '-f', 'png',
            '-o', temp_mask_png_without_text,
            '--dpi-x', '300',
            '--dpi-y', '300',
        '--background-color', original_background_color,
            mask_svg_without_text
        ], check=True)
    
    # 读取为numpy数组并处理
    img_without_text = Image.open(temp_mask_png_without_text).convert('RGB')
    img_array_without_text = np.array(img_without_text)
    
    # 确保图像尺寸匹配预期尺寸
    actual_height, actual_width = img_array_without_text.shape[:2]
    if actual_width != width or actual_height != height:
        img_without_text = img_without_text.resize((width, height), Image.LANCZOS)
        img_array_without_text = np.array(img_without_text)
    
    
    # 解析SVG内容
    soup = BeautifulSoup(svg_content, 'xml')
    
    # 仅保留text和group元素
    for element in soup.find_all():
        if element.name not in ['text', 'g', 'svg']:
            element.decompose()
    
    svg_content_only_text = str(soup)
    
    # 创建临时文件
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as mask_svg_file_only_text, \
         tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_mask_png_file_only_text:
        mask_svg_only_text = mask_svg_file_only_text.name
        temp_mask_png_only_text = temp_mask_png_file_only_text.name
        mask_svg_file_only_text.write(svg_content_only_text.encode('utf-8'))
        mask_svg_file_only_text.flush()
        
        subprocess.run([
            'rsvg-convert',
            '-f', 'png',
            '-o', temp_mask_png_only_text,
            '--dpi-x', '300',
            '--dpi-y', '300',
            '--background-color', original_background_color,
            mask_svg_only_text
        ], check=True)
        
        
    img_only_text = Image.open(temp_mask_png_only_text).convert('RGB')
    img_array_only_text = np.array(img_only_text)
    
    # 确保图像尺寸匹配预期尺寸
    actual_height, actual_width = img_array_only_text.shape[:2]
    if actual_width != width or actual_height != height:
        img_only_text = img_only_text.resize((width, height), Image.LANCZOS)
        img_array_only_text = np.array(img_only_text)
    
    # 转换为二值mask
    mask = np.ones((height, width), dtype=np.uint8)
    # 随机采样300个点
    total_pixels = height * width
    sample_indices = np.random.choice(total_pixels, min(300, total_pixels), replace=False)
    sample_pixels = img_array_without_text.reshape(-1, 3)[sample_indices]
    
    # 排除接近背景色的像素
    non_bg_pixels = sample_pixels[~np.all(np.abs(sample_pixels - background_color) <= 10, axis=1)]
    
    if len(non_bg_pixels) == 0:
        mode_color = np.array([0, 0, 0])  # 如果没有非背景色像素，返回黑色
    else:
        # 将像素转换为元组以便计数
        pixels_tuple = [tuple(p) for p in non_bg_pixels]
        # 直接用Counter找出最常见的颜色
        from collections import Counter
        mode_color = np.array(Counter(pixels_tuple).most_common(1)[0][0])
    
    # 使用mode_color作为众数颜色创建mask
    mask = np.zeros((height, width), dtype=np.uint8)
    mask_only_text = np.zeros((height, width), dtype=np.uint8)
    color_diff = np.sqrt(np.sum((img_array_without_text - mode_color) ** 2, axis=2))
    mask[color_diff <= 10] = 1
    color_diff_only_text = np.sqrt(np.sum((img_array_only_text - background_color) ** 2, axis=2))
    mask_only_text[color_diff_only_text >= 10] = 1
    fill_mask = np.zeros((height, width), dtype=np.uint8)
    fill_mask_only_text = np.zeros((height, width), dtype=np.uint8)
    
    mask_padding = 8
    for i in range(height):
        last_j = -mask_padding
        for j in range(width):
            if mask[i, j] == 1:
                if j - last_j < mask_padding:
                    fill_mask[i, last_j:j+1] = 1
                else:
                    fill_mask[i, j] = 1
                last_j = j

    for j in range(width):
        last_i = -mask_padding
        for i in range(height):
            if mask[i, j] == 1:
                if i - last_i < mask_padding:
                    fill_mask[last_i:i+1, j] = 1
                else:
                    fill_mask[i, j] = 1
                last_i = i

    for j in range(width):
        last_i = -mask_padding
        for i in range(height):
            if mask_only_text[i, j] == 1:
                if i - last_i < mask_padding:
                    fill_mask_only_text[last_i:i+1, j] = 1
                else:
                    fill_mask_only_text[i, j] = 1
                last_i = i

    for i in range(height):
        last_j = -mask_padding
        for j in range(width):
            if mask_only_text[i, j] == 1:
                if j - last_j < mask_padding:
                    fill_mask_only_text[i, last_j:j+1] = 1
                else:
                    fill_mask_only_text[i, j] = 1
                last_j = j

    mask = fill_mask
    mask_only_text = fill_mask_only_text
    os.remove(mask_svg_without_text)
    os.remove(temp_mask_png_without_text)
    os.remove(mask_svg_only_text)
    os.remove(temp_mask_png_only_text)
    
    return mask, mask_only_text



def calculate_mask_v2(svg_content: str, width: int, height: int, background_color: str, grid_size: int = 5, max_difference = 15) -> np.ndarray:
    """将SVG转换为基于背景色的二值化mask数组"""
    width = int(width)
    height = int(height)
    
    # 将背景色转换为RGB格式
    original_background_color = background_color
    background_color = tuple(int(background_color[i:i+2], 16) for i in (1, 3, 5))
    
    # 预处理SVG内容，删除背景元素和细线条
    
    # 解析SVG内容
    soup = BeautifulSoup(svg_content, 'xml')
    
    # 删除class="background"的所有元素
    background_elements = soup.select('[class="background"]')
    for element in background_elements:
        element.decompose()
    
    # 删除stroke-width<=1的所有line元素
    thin_lines = soup.find_all('line')
    for line in thin_lines:
        stroke_width = line.get('stroke-width')
        if stroke_width and float(stroke_width) <= 1:
            line.decompose()
    
    # 重新获取处理后的SVG内容
    svg_content = str(soup)
    
    # 创建临时文件
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as mask_svg_file, \
         tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_mask_png_file:
        mask_svg = mask_svg_file.name
        temp_mask_png = temp_mask_png_file.name
        
        # 修改SVG内容，移除渐变
        # 将渐变填充替换为可见的纯色填充，而不是none
        mask_svg_content = re.sub(r'fill="url\(#[^"]*\)"', 'fill="#333333"', svg_content)
        mask_svg_content = re.sub(r'stroke="url\(#[^"]*\)"', 'stroke="#333333"', mask_svg_content)
        mask_svg_content = mask_svg_content.replace('&', '&amp;')
        
        # 提取SVG内容并添加新的SVG标签
        svg_content_match = re.search(r'<svg[^>]*>(.*?)</svg>', mask_svg_content, re.DOTALL)
        if svg_content_match:
            inner_content = svg_content_match.group(1)
            # 创建新的SVG标签
            mask_svg_content = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}"> \
            <rect width="{width}" height="{height}" fill="{original_background_color}" /> \
            {inner_content} \
            </svg>'
        
        mask_svg_file.write(mask_svg_content.encode('utf-8'))
        
    subprocess.run([
        'rsvg-convert',
        '-f', 'png',
        '-o', temp_mask_png,
        '--dpi-x', '300',
        '--dpi-y', '300',
        '--background-color', original_background_color,
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
    mask = np.ones((height, width), dtype=np.uint8)
    
    for y in range(0, height, grid_size):
        for x in range(0, width, grid_size):
            y_end = min(y + grid_size, height)
            x_end = min(x + grid_size, width)
            
            if y_end > y and x_end > x:
                grid = img_array[y:y_end, x:x_end]
                if grid.size > 0:
                    # 计算与背景色的差异
                    background_diff = np.sqrt(np.sum((grid - background_color) ** 2, axis=2))
                    white_ratio = np.mean(background_diff < max_difference)
                    mask[y:y_end, x:x_end] = 0 if white_ratio > 0.95 else 1
    
    # 删除临时文件
    os.remove(mask_svg)
    os.remove(temp_mask_png)
    
    return mask

def calculate_mask(svg_content: str, width: int, height: int, padding: int, grid_size: int = 5, bg_threshold: float = 220) -> np.ndarray:
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
        # 将渐变填充替换为可见的纯色填充，而不是none
        mask_svg_content = re.sub(r'fill="url\(#[^"]*\)"', 'fill="#333333"', svg_content)
        mask_svg_content = re.sub(r'stroke="url\(#[^"]*\)"', 'stroke="#333333"', mask_svg_content)
        mask_svg_content = mask_svg_content.replace('&', '&amp;')
        
        # 提取SVG内容并添加新的SVG标签
        svg_content_match = re.search(r'<svg[^>]*>(.*?)</svg>', mask_svg_content, re.DOTALL)
        if svg_content_match:
            inner_content = svg_content_match.group(1)
            # 创建新的SVG标签
            mask_svg_content = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}">{inner_content}</svg>'
        
        # 添加padding
        if padding > 0:
            svg_tag_match = re.search(r'<svg[^>]*>', mask_svg_content)
            if svg_tag_match:
                svg_tag = svg_tag_match.group(0)
                svg_tag_end = svg_tag_match.end()
                svg_content_part = mask_svg_content[svg_tag_end:]
                svg_end_tag = '</svg>'
                svg_content_without_end = svg_content_part.replace(svg_end_tag, '')
                
                # 添加transform group
                mask_svg_content = svg_tag + f'<g transform="translate({padding}, {padding})">' + svg_content_without_end + '</g>' + svg_end_tag
        
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
        mask = np.ones((height, width), dtype=np.uint8)
        
        for y in range(0, height, grid_size):
            for x in range(0, width, grid_size):
                y_end = min(y + grid_size, height)
                x_end = min(x + grid_size, width)
                
                if y_end > y and x_end > x:
                    grid = img_array[y:y_end, x:x_end]
                    if grid.size > 0:
                        white_pixels = np.all(grid >= bg_threshold, axis=2)
                        white_ratio = np.mean(white_pixels)
                        mask[y:y_end, x:x_end] = 0 if white_ratio > 0.95 else 1
        
        return mask
        
    finally:
        if os.path.exists(mask_svg):
            os.remove(mask_svg)
        if os.path.exists(temp_mask_png):
            os.remove(temp_mask_png)

def calculate_bbox(mask: np.ndarray) -> Tuple[int, int, int, int]:
    """计算mask的bbox"""
    rows = np.sum(mask == 1, axis=1) > 0
    cols = np.sum(mask == 1, axis=0) > 0
    row_indices = np.where(rows)[0]
    col_indices = np.where(cols)[0]
    return row_indices[0], col_indices[0], row_indices[-1], col_indices[-1]

def calculate_content_width(mask: np.ndarray, padding: int = 0) -> Tuple[int, int, int]:
    """计算mask中内容的实际宽度范围"""
    content_columns = np.sum(mask == 1, axis=0) > 0  # 任何非零值表示该列有内容
    content_indices = np.where(content_columns)[0]
    
    return content_indices[0] - padding, content_indices[-1] - padding, content_indices[-1] - content_indices[0] + 1

def calculate_content_height(mask: np.ndarray, padding: int = 0) -> Tuple[int, int, int]:
    """计算mask中内容的实际高度范围"""
    # mask中1表示内容，0表示背景
    content_rows = np.sum(mask == 1, axis=1) > 0  # 任何非零值表示该行有内容
    content_indices = np.where(content_rows)[0]
    
    if len(content_indices) == 0:
        return 0, 0, 0
        
    start_y = content_indices[0]
    end_y = content_indices[-1]
    height = end_y - start_y + 1
    
    return start_y - padding, end_y - padding, height

def fill_columns_between_bounds(mask: np.ndarray, x_min: int, x_max: int, y_min: int, y_max: int) -> np.ndarray:
    """
    扫描子矩形区域内每一列的第一个1和最后一个1，将两者之间的区域填充为1
    
    Args:
        mask: 输入的mask数组
        x_min: 子矩形区域的最小x坐标
        x_max: 子矩形区域的最大x坐标
        y_min: 子矩形区域的最小y坐标
        y_max: 子矩形区域的最大y坐标
    
    Returns:
        np.ndarray: 处理后的mask数组
    """
    # 确保坐标在有效范围内
    height, width = mask.shape
    x_min = max(0, min(x_min, width - 1))
    x_max = max(0, min(x_max, width - 1))
    y_min = max(0, min(y_min, height - 1))
    y_max = max(0, min(y_max, height - 1))
    
    # 创建新的mask副本
    new_mask = mask.copy()
    
    # 对每一列进行处理
    for x in range(x_min, x_max + 1):
        # 直接获取该列在指定范围内的切片
        col_slice = new_mask[y_min:y_max+1, x]
        
        if np.any(col_slice == 1):
            # 找出该列中1的位置
            content_indices = np.where(col_slice == 1)[0]
            
            if len(content_indices) > 0:
                # 填充该列从第一个1到最后一个1之间的所有位置
                col_slice[content_indices[0]:content_indices[-1]+1] = 1
                # 将修改后的切片放回原数组
                new_mask[y_min:y_max+1, x] = col_slice
    
    return new_mask

def expand_mask(mask: np.ndarray, dist: int) -> np.ndarray:
    """
    扩展现有掩码，将任何与现有掩码距离小于dist的像素设为1。
    
    Args:
        mask: 输入的掩码数组，其中1表示内容，0表示背景
        dist: 距离阈值（像素）
    
    Returns:
        np.ndarray: 扩展后的掩码数组
    """
    # 使用距离变换计算每个背景像素到最近的内容像素的距离
    # 首先反转掩码，因为距离变换计算到0的距离
    inv_mask = 1 - mask
    # 计算距离图
    dist_map = ndimage.distance_transform_edt(inv_mask)
    # 创建新的掩码，将距离小于dist的像素设为1
    expanded_mask = np.where(dist_map < dist, 1, mask)
    
    return expanded_mask