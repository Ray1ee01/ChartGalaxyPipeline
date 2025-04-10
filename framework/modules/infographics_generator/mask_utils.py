import os
import random
import subprocess
import re
from PIL import Image
import numpy as np
from typing import Tuple

def calculate_mask(svg_content: str, width: int, height: int, padding: int, grid_size: int = 5) -> np.ndarray:
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
        
        # 给SVG内容添加padding
        # 提取viewBox属性
        viewbox_match = re.search(r'viewBox=["\']([^"\']+)["\']', mask_svg_content)
        if viewbox_match:
            viewbox = viewbox_match.group(1)
            values = list(map(float, viewbox.split()))
            # 调整viewBox以包含padding
            new_values = [values[0] - padding, values[1] - padding, 
                          values[2] + 2 * padding, values[3] + 2 * padding]
            new_viewbox = ' '.join(map(str, new_values))
            mask_svg_content = mask_svg_content.replace(viewbox, new_viewbox)
            
            # 找到SVG标签结束和第一个内容元素之间的位置
            svg_tag_end = re.search(r'<svg[^>]*>', mask_svg_content).end()
            # 在内容前添加group，并应用transform以考虑padding
            group_start = f'<g transform="translate({padding}, {padding})">'
            group_end = '</g>'
            
            # 拆分SVG头部和内容
            svg_header = mask_svg_content[:svg_tag_end]
            svg_content_part = mask_svg_content[svg_tag_end:]
            
            # 找到结束标签
            svg_end_tag = '</svg>'
            svg_content_without_end = svg_content_part.replace(svg_end_tag, '')
            
            # 重组SVG，添加group
            mask_svg_content = svg_header + group_start + svg_content_without_end + group_end + svg_end_tag
        
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
                        white_pixels = np.all(grid >= 220, axis=2)
                        white_ratio = np.mean(white_pixels)
                        mask[y:y_end, x:x_end] = 0 if white_ratio > 0.95 else 1
        
        return mask
        
    finally:
        if os.path.exists(mask_svg):
            os.remove(mask_svg)
        if os.path.exists(temp_mask_png):
            os.remove(temp_mask_png)

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