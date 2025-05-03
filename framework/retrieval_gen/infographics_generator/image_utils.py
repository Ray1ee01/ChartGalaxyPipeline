import numpy as np
from typing import Tuple
from .mask_utils import calculate_mask, expand_mask
import os
from PIL import Image

def find_best_size_and_position(main_mask: np.ndarray, image_content: str, padding: int, mode: str = "side", chart_bbox: dict = None, avoid_mask: np.ndarray = None) -> Tuple[int, int, int]:
    """
    通过降采样加速查找最佳图片尺寸和位置
    
    Args:
        main_mask: 主要内容的mask
        image_content: base64图片内容
        padding: 边界padding
        mode: 放置模式，可选"side"、"background"或"overlay"
        chart_bbox: 图表边界框，格式为{"x": x, "y": y, "width": width, "height": height}
        avoid_mask: 需要避免重叠的区域mask
    
    Returns:
        Tuple[int, int, int]: (image_size, best_x, best_y)
    """
    # Save the main_mask to PNG for debugging
    os.makedirs('tmp', exist_ok=True)
    mask_image = Image.fromarray((main_mask * 255).astype(np.uint8))
    mask_image.save('tmp/main_mask.png')
    
    grid_size = 5
    
    # 将main_mask降采样到1/grid_size大小
    h, w = main_mask.shape
    downsampled_h = h // grid_size
    downsampled_w = w // grid_size
    downsampled_main = np.zeros((downsampled_h, downsampled_w), dtype=np.uint8)
        
    # 对每个grid进行降采样，只要原grid中有内容（1）就标记为1
    for i in range(downsampled_h):
        for j in range(downsampled_w):
            y_start = max(0, (i - 1) * (grid_size))
            x_start = max(0, (j - 1) * (grid_size))
            y_end = min((i + 2) * (grid_size), h)
            x_end = min((j + 2) * (grid_size), w)
            grid = main_mask[y_start:y_end, x_start:x_end]
            downsampled_main[i, j] = 1 if np.any(grid == 1) else 0
    
    # 如果有avoid_mask，也进行降采样
    downsampled_avoid = None
    if avoid_mask is not None:
        downsampled_avoid = np.zeros((downsampled_h, downsampled_w), dtype=np.uint8)
        for i in range(downsampled_h):
            for j in range(downsampled_w):
                y_start = max(0, (i - 1) * (grid_size))
                x_start = max(0, (j - 1) * (grid_size))
                y_end = min((i + 2) * (grid_size), h)
                x_end = min((j + 2) * (grid_size), w)
                grid = avoid_mask[y_start:y_end, x_start:x_end]
                downsampled_avoid[i, j] = 1 if np.any(grid == 1) else 0
    
    # 调整padding到降采样尺度
    downsampled_padding = max(1, padding // grid_size)
    
    # 二分查找最佳尺寸
    min_size = max(1, 128 // grid_size)  # 最小尺寸也要降采样
    max_size = int(min(downsampled_main.shape) * 1)
    best_size = min_size
    best_x = downsampled_padding
    best_y = downsampled_padding
    
    if mode == "side":
        best_overlap_ratio = float('inf')
    elif mode == "background":
        best_overlap_ratio = float('inf')
    else:
        best_overlap_ratio = 0
        
    overlap_threshold = 0.01
    if mode == "side":
        overlap_threshold = 0.01
    elif mode == "background":
        overlap_threshold = 0.05
    elif mode == "overlay":
        overlap_threshold = 0.97
    
    while max_size - min_size >= 2:  # 由于降采样，可以用更小的阈值
        mid_size = (min_size + max_size) // 2
        
        # 生成当前尺寸的图片mask并降采样
        original_size = mid_size * grid_size
        temp_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{original_size}" height="{original_size}">
            <image width="{original_size}" height="{original_size}" href="{image_content}"/>
        </svg>"""
        image_mask = calculate_mask(temp_svg, original_size, original_size, 0, grid_size=grid_size, bg_threshold=240)
        if mode == "background":
            image_mask = expand_mask(image_mask, 10)
        # Save the original image mask to PNG for debugging
        os.makedirs('tmp', exist_ok=True)
        mask_image = Image.fromarray((image_mask * 255).astype(np.uint8))
        mask_image.save('tmp/image_mask.png')
        # 将image_mask降采样
        downsampled_image = np.zeros((mid_size, mid_size), dtype=np.uint8)
        for i in range(mid_size):
            for j in range(mid_size):
                y_start = max(0, (i - 1) * (grid_size))
                x_start = max(0, (j - 1) * (grid_size))
                y_end = min((i + 2) * (grid_size), original_size)
                x_end = min((j + 2) * (grid_size), original_size)
                grid = image_mask[y_start:y_end, x_start:x_end]
                downsampled_image[i, j] = 1 if np.any(grid == 1) else 0
        
        # 计算有效的搜索范围
        if mode == "background" and chart_bbox is not None:
            # 将chart_bbox转换到降采样尺度
            chart_x = max(0, chart_bbox["x"] // grid_size)
            chart_y = max(0, chart_bbox["y"] // grid_size)
            chart_width = min(chart_bbox["width"] // grid_size, downsampled_w - chart_x)
            chart_height = min(chart_bbox["height"] // grid_size, downsampled_h - chart_y)
            
            # 确保搜索范围在chart_bbox内
            y_range = chart_height - mid_size - downsampled_padding * 2
            x_range = chart_width - mid_size - downsampled_padding * 2
            
            if y_range <= 0 or x_range <= 0:
                max_size = mid_size - 1
                continue
        else:
            y_range = downsampled_h - mid_size - downsampled_padding * 2
            x_range = downsampled_w - mid_size - downsampled_padding * 2
            
            if y_range <= 0 or x_range <= 0:
                max_size = mid_size - 1
                continue
        
        # 在降采样空间中寻找最佳位置
        min_overlap = float('inf')
        if mode == "side" or mode == "background":
            min_overlap = float('inf')
        elif mode == "overlay":
            min_overlap = 0
        current_x = downsampled_padding
        current_y = downsampled_padding
        min_distance = float('inf')
        mask_center_x = np.mean(np.where(downsampled_main == 1)[1]) if np.any(downsampled_main == 1) else downsampled_w // 2
        mask_center_y = np.mean(np.where(downsampled_main == 1)[0]) if np.any(downsampled_main == 1) else downsampled_h // 2

        if mode == "background" and chart_bbox is not None:
            y_start = chart_y + downsampled_padding
            y_end = chart_y + chart_height - mid_size - downsampled_padding + 1
            x_start = chart_x + downsampled_padding
            x_end = chart_x + chart_width - mid_size - downsampled_padding + 1
        else:
            y_start = downsampled_padding
            y_end = downsampled_h - mid_size - downsampled_padding + 1
            x_start = downsampled_padding
            x_end = downsampled_w - mid_size - downsampled_padding + 1
        
        for y in range(y_start, y_end):
            for x in range(x_start, x_end):
                region = downsampled_main[y:y + mid_size, x:x + mid_size]
                
                overlap = np.sum((region == 1) & (downsampled_image == 1))
                total = np.sum(downsampled_image == 1)
                overlap_ratio = overlap / total if total > 0 else 1.0
                
                # 检查与avoid_mask的重叠
                avoid_overlap = 0
                if downsampled_avoid is not None:
                    avoid_region = downsampled_avoid[y:y + mid_size, x:x + mid_size]
                    avoid_overlap = np.sum((avoid_region == 1) & (downsampled_image == 1))
                
                if mode == "side" or mode == "background":
                    if mode == "background" and chart_bbox is not None:
                        distance_to_left = x - (chart_x + downsampled_padding)
                        distance_to_right = (chart_x + chart_width - mid_size - downsampled_padding) - x
                        distance_to_top = y - (chart_y + downsampled_padding)
                        distance_to_bottom = (chart_y + chart_height - mid_size - downsampled_padding) - y
                    else:
                        distance_to_left = x - downsampled_padding
                        distance_to_right = downsampled_w - mid_size - downsampled_padding - x
                        distance_to_top = y - downsampled_padding
                        distance_to_bottom = downsampled_h - mid_size - downsampled_padding - y

                    distance_to_border = min(distance_to_left, distance_to_right, distance_to_top, distance_to_bottom)
                    if overlap_ratio < min_overlap or (overlap_ratio < overlap_threshold and distance_to_border < min_distance):
                        min_overlap = overlap_ratio
                        current_x = x
                        current_y = y
                        min_distance = distance_to_border
                elif mode == "overlay":
                    # 对于overlay模式，需要同时满足与main_mask的重叠足够大，且与avoid_mask没有重叠
                    if avoid_overlap > 0:
                        continue  # 跳过与avoid_mask有重叠的位置
                    distance_to_center = np.sqrt(((x + mid_size / 2 - mask_center_x) ** 2 + (y + mid_size / 2 - mask_center_y) ** 2))
                    if overlap_ratio > min_overlap or (overlap_ratio > overlap_threshold and distance_to_center < min_distance):
                        min_overlap = overlap_ratio
                        current_x = x
                        current_y = y
                        min_distance = distance_to_center
        
        # print(f"Trying size {mid_size * grid_size}x{mid_size * grid_size}, minimum overlap ratio: {min_overlap:.3f}")
        
        if mode == "side" or mode == "background":
            if min_overlap < overlap_threshold:
                best_size = mid_size
                best_overlap_ratio = min_overlap
                best_x = current_x
                best_y = current_y
                min_size = mid_size + 1
            else:
                max_size = mid_size - 1
        elif mode == "overlay":
            if min_overlap > overlap_threshold:
                best_size = mid_size
                best_overlap_ratio = min_overlap
                best_x = current_x
                best_y = current_y
                min_size = mid_size + 1
            else:
                max_size = mid_size - 1

    if best_overlap_ratio > overlap_threshold and (mode == "side" or mode == "background"):
        return 0, 0, 0
    if best_overlap_ratio < overlap_threshold and mode == "overlay":
        return 0, 0, 0

    final_size = best_size * grid_size
    final_x = best_x * grid_size
    final_y = best_y * grid_size
    
    '''
    # 生成最终尺寸的图片mask
    temp_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{final_size}" height="{final_size}">
        <image width="{final_size}" height="{final_size}" href="{image_content}"/>
    </svg>"""
    final_image_mask = calculate_mask(temp_svg, final_size, final_size, 0)
    
    # 创建合并的mask，将image_mask放在正确的位置
    combined_mask = np.zeros_like(main_mask)
    combined_mask[main_mask == 1] = 1
    # 将image_mask放在正确的位置
    combined_mask[final_y:final_y + final_size, final_x:final_x + final_size] = np.where(final_image_mask == 1, 2, combined_mask[final_y:final_y + final_size, final_x:final_x + final_size])
    
    # 保存合并的mask
    combined_image = Image.fromarray((combined_mask * 127).astype(np.uint8))
    combined_image.save('tmp/all_mask.png')
    
    print(f"Final result: size={final_size}x{final_size}, position=({final_x}, {final_y}), overlap ratio={best_overlap_ratio:.3f}")
    '''
    return final_size, final_x, final_y 

def find_best_position(main_mask: np.ndarray, image_size: int, original_x: int, original_y: int, padding: int, avoid_mask: np.ndarray = None) -> Tuple[int, int]:
    """
    找到离原始位置最近的不重叠位置
    
    Args:
        main_mask: 主要内容的mask
        image_size: 图片尺寸（假设是正方形）
        original_x: 原始x坐标
        original_y: 原始y坐标
        padding: 边界padding
        avoid_mask: 需要避免重叠的区域mask
    
    Returns:
        Tuple[int, int]: (best_x, best_y)
    """
    # 保存调试信息
    os.makedirs('tmp', exist_ok=True)
    mask_image = Image.fromarray((main_mask * 255).astype(np.uint8))
    mask_image.save('tmp/main_mask.png')
    
    h, w = main_mask.shape
    
    # 创建一个图像大小的mask
    image_mask = np.ones((image_size, image_size), dtype=np.uint8)
    
    # 确保原始位置在有效范围内
    original_x = max(padding, min(original_x, w - image_size - padding))
    original_y = max(padding, min(original_y, h - image_size - padding))
    
    # 检查原始位置是否可用（不与main_mask重叠）
    if is_valid_position(main_mask, image_mask, original_x, original_y, avoid_mask):
        return original_x, original_y, True
    
    # 如果原始位置不可用，搜索最近的有效位置
    best_x, best_y, overlap = find_nearest_valid_position(main_mask, image_mask, original_x, original_y, padding, h, w, avoid_mask)
    
    return best_x, best_y, overlap

def is_valid_position(main_mask, image_mask, x, y, avoid_mask=None):
    """检查位置是否有效（不与main_mask重叠）"""
    # 获取main_mask在当前位置的区域
    region = main_mask[y:y + image_mask.shape[0], x:x + image_mask.shape[1]]
    
    # 如果区域大小与image_mask不匹配，则位置无效
    if region.shape != image_mask.shape:
        return False
    
    # 检查是否与main_mask重叠
    overlap = np.sum((region == 1) & (image_mask == 1))
    if overlap > 0:
        return False
    
    # 检查是否与avoid_mask重叠
    if avoid_mask is not None:
        avoid_region = avoid_mask[y:y + image_mask.shape[0], x:x + image_mask.shape[1]]
        if avoid_region.shape == image_mask.shape:
            avoid_overlap = np.sum((avoid_region == 1) & (image_mask == 1))
            if avoid_overlap > 0:
                return False
    
    return True

def find_nearest_valid_position(main_mask, image_mask, original_x, original_y, padding, h, w, avoid_mask=None):
    """找到离原始位置最近的有效位置"""
    image_height, image_width = image_mask.shape
    
    # 定义搜索范围
    max_distance = max(h // 3, w // 3)
    
    # 按距离递增的顺序搜索
    for distance in range(1, max_distance):
        # 搜索当前距离的所有点
        for dx in range(-distance, distance + 1):
            for dy in range(-distance, distance + 1):
                # 只考虑在当前距离上的点
                if abs(dx) + abs(dy) != distance:
                    continue
                
                # 计算新位置
                new_x = original_x + dx
                new_y = original_y + dy
                
                # 检查位置是否在有效范围内
                if new_x < padding or new_x > w - image_width - padding:
                    continue
                if new_y < padding or new_y > h - image_height - padding:
                    continue
                
                # 检查位置是否有效
                if is_valid_position(main_mask, image_mask, new_x, new_y, avoid_mask):
                    return new_x, new_y, True
    
    # 如果找不到有效位置，返回原始位置
    return original_x, original_y, False