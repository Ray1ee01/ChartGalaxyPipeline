import os
import json
from openai import OpenAI
from PIL import Image
from io import BytesIO
import base64
import sys
import time
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
import cv2
import numpy as np

API_KEY = 'sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9'
API_PROVIDER = 'https://aihubmix.com/v1'

# 创建OpenAI客户端的函数，每个进程需要自己的客户端实例
def create_client():
    return OpenAI(
        api_key=API_KEY,
        base_url=API_PROVIDER,
    )

# 全局客户端仅用于主进程
client = create_client()

def generate_image(description, color_list=None):
    
    # 每个进程创建自己的客户端实例
    local_client = create_client()

    prompt = f"""
        Create a pictogram for an infographic with the theme of "{description}".
        The pictogram should visually represent key concepts related to this theme using creative symbols, icons, or illustrations,
        such as people, light bulbs, or everyday objects, to clearly communicate the main idea to the audience.
        The pictogram should emphasize important concepts or data points central to the theme.
        Ensure the design is simple, clean, and easy to understand, with clear and intuitive use of shapes and symbols that relate to the theme.
        Ensure there is no text and chart elements in the design.
        The pictogram should be figurative, visually appealing, and have no background (pure white) to integrate seamlessly into the overall layout of the infographic.
    """
    if color_list:
        prompt += f" Use colors from {color_list} selectively in the design. You can choose some of these colors to create a harmonious and balanced color scheme. The design should incorporate the selected colors naturally while maintaining visual cohesion."
    
    try:
        result = local_client.images.generate(
            model="gpt-image-1", 
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="high",
            # moderation="low",
            # background="auto",
        )
        
        print(f"生成 {description} 的图像成功")
        
        # 立即保存图像并处理透明度
        if result and result.data:
            image_base64 = result.data[0].b64_json
            
            # 将base64转换为PIL图像
            image_data = base64.b64decode(image_base64)
            image = Image.open(BytesIO(image_data))
            
            # 转换为RGBA模式
            image = image.convert('RGBA')
            data = image.getdata()
            
            # 将白色(容差20)转换为透明
            new_data = []
            for item in data:
                # 检查RGB值是否接近白色(容差20)
                if item[0] > 235 and item[1] > 235 and item[2] > 235:
                    new_data.append((255, 255, 255, 0))
                else:
                    new_data.append(item)
                    
            image.putdata(new_data)

            # 将图像转换为numpy数组
            img_array = np.array(image)
            
            # 创建二值掩码,非透明像素为1,透明像素为0
            mask = (img_array[:,:,3] > 0).astype(np.uint8)
            
            # 标记联通区域
            num_labels, labels = cv2.connectedComponents(mask)
            
            # 计算每个联通区域的像素数
            for label in range(1, num_labels):
                area = np.sum(labels == label)
                # 如果区域像素数小于20,将其设为透明
                if area < 20:
                    img_array[labels == label] = [255, 255, 255, 0]
                    
            # 转回PIL图像
            image = Image.fromarray(img_array)
            
            # 转回base64
            buffered = BytesIO()
            image.save(buffered, format="PNG")
            processed_image_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            return processed_image_base64
        
        return None
    except Exception as e:
        print(f"生成 {description} 的图像失败: {e}")
        return None