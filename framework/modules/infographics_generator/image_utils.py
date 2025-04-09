import numpy as np
from typing import Tuple
from .mask_utils import calculate_mask

def find_best_size_and_position(main_mask: np.ndarray, image_content: str, padding: int) -> Tuple[int, int, int]:
    """通过降采样加速查找最佳图片尺寸和位置"""
    grid_size = 5
    
    # 将main_mask降采样到1/grid_size大小
    h, w = main_mask.shape
    downsampled_h = h // grid_size
    downsampled_w = w // grid_size
    downsampled_main = np.zeros((downsampled_h, downsampled_w), dtype=np.uint8)
    
    # ... [保持原有代码不变] ...
    
    return final_size, final_x, final_y 