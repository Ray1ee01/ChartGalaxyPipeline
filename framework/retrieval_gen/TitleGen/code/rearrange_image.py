from PIL import Image
import numpy as np

def rearrange_image(image_path, hspace=50, vspace=20):
    # 打开图片并转换为RGBA模式
    img = Image.open(image_path).convert("RGBA")
    width, height = img.size
    
    # 转换为numpy数组以便处理
    img_array = np.array(img)
    
    # 创建透明度掩码 (非零表示非透明像素)
    alpha_mask = img_array[:, :, 3] > 0

    # 使用OpenCV的连通组件分析找到所有联通块
    from scipy.ndimage import label
    
    # 对alpha通道进行连通组件标记
    labeled_array, num_features = label(alpha_mask)
    
    # 统计每个联通块的像素数
    for i in range(1, num_features + 1):
        # 获取当前联通块的掩码
        component_mask = labeled_array == i
        # 计算像素数
        pixel_count = np.sum(component_mask)
        
        # 如果像素数小于20,将该区域设为透明
        if pixel_count < 20:
            img_array[component_mask] = [0, 0, 0, 0]
            alpha_mask[component_mask] = False
    
    # 找出每一行是否包含非透明像素
    row_has_content = np.any(alpha_mask, axis=1)
    
    # 识别文本行区间
    text_rows = []
    in_text = False
    start_row = 0
    
    for i, has_content in enumerate(row_has_content):
        if has_content and not in_text:
            # 开始新的文本行
            in_text = True
            start_row = i
        elif not has_content and in_text:
            # 结束当前文本行
            in_text = False
            text_rows.append((start_row, i))
    
    # 如果最后一行有内容但没有结束
    if in_text:
        text_rows.append((start_row, height))
    
    # 如果没有找到文本行，直接返回
    if not text_rows:
        return image_path
    
    # 对每一行文本，找出其水平范围
    text_boxes = []
    for start_y, end_y in text_rows:
        # 提取当前行的透明度掩码
        row_mask = alpha_mask[start_y:end_y, :]
        
        # 找出每一列是否包含非透明像素
        col_has_content = np.any(row_mask, axis=0)
        # 找出第一个和最后一个非透明像素的列
        non_empty_cols = np.where(col_has_content)[0]
        if len(non_empty_cols) > 0:
            start_x = non_empty_cols[0]
            end_x = non_empty_cols[-1] + 1  # +1 因为切片是开区间
            text_boxes.append((start_x, start_y, end_x, end_y))
    
    # 决定重排为几行
    num_rows = 1 if len(text_boxes) <= 3 else 2
    
    # 计算每行应该包含多少个文本框
    boxes_per_row = [len(text_boxes) // num_rows + (1 if i < len(text_boxes) % num_rows else 0) 
                     for i in range(num_rows)]
    
    # 创建新图像
    # 首先计算新图像的尺寸
    new_width = 0
    new_height = 0
    
    for row in range(num_rows):
        row_width = 0
        row_height = 0
        start_idx = sum(boxes_per_row[:row])
        end_idx = start_idx + boxes_per_row[row]
        
        for i in range(start_idx, end_idx):
            box = text_boxes[i]
            row_width += (box[2] - box[0])
            row_height = max(row_height, box[3] - box[1])
            
            # 添加间距，除了最后一个框
            if i < end_idx - 1:
                row_width += hspace
        
        new_width = max(new_width, row_width)
        new_height += row_height + vspace
    
    # 创建新的透明图像
    new_img = Image.new("RGBA", (new_width, new_height), (0, 0, 0, 0))
    
    # 将文本框放置到新图像中
    y_offset = 0
    for row in range(num_rows):
        x_offset = 0
        row_height = 0
        start_idx = sum(boxes_per_row[:row])
        end_idx = start_idx + boxes_per_row[row]
        
        # 计算当前行的最大高度
        for i in range(start_idx, end_idx):
            box = text_boxes[i]
            row_height = max(row_height, box[3] - box[1])
        
        for i in range(start_idx, end_idx):
            box = text_boxes[i]
            # 提取文本框
            text_img = img.crop(box)
            
            # 计算粘贴位置（底边对齐）
            paste_y = y_offset + row_height - (box[3] - box[1])
            
            # 粘贴到新图像
            new_img.paste(text_img, (x_offset, paste_y), text_img)
            
            # 更新x偏移
            x_offset += (box[2] - box[0]) + hspace
        
        # 更新y偏移
        y_offset += row_height + vspace
    
    # new_img_path = image_path.replace(".png", "_rearranged.png")
    # 保存新图像
    new_img.save(image_path)
    return image_path

# if __name__ == "__main__":
#     image_path = "./TitleGen/images/title/generated_image.png"
#     new_img_path = rearrange_image(image_path)
#     print(f"New image saved at: {new_img_path}")

