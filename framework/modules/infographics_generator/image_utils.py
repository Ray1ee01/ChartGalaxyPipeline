import numpy as np
from typing import Tuple
from .mask_utils import calculate_mask
import os
from PIL import Image

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
    # Save the main_mask to PNG for debugging
    os.makedirs('tmp', exist_ok=True)
    mask_image = Image.fromarray((main_mask * 255).astype(np.uint8))
    mask_image.save('tmp/main_mask.png')
    
    grid_size = 5  # 使用与calculate_mask相同的网格大小
    
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
        temp_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{original_size}" height="{original_size}">
            <image width="{original_size}" height="{original_size}" href="{image_content}"/>
        </svg>"""
        image_mask = calculate_mask(temp_svg, original_size, original_size, 0, grid_size=grid_size, bg_threshold=240)
        
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
        
        if min_overlap < 0.01:
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
    
    return final_size, final_x, final_y 