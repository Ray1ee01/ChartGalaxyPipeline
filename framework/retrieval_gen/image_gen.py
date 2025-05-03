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

def generate_image(description, main_color=None):
    
    # 每个进程创建自己的客户端实例
    local_client = create_client()
    
    prompt = f"""Create a flat-design pictogram symbolizing '{description}'. The design should be simple, no text or intricate details, no shading or gradients, and set against a white background."""
    if main_color:
        prompt += f" The main color of the design should be around {main_color} if possible."
    
    try:
        result = local_client.images.generate(
            model="gpt-image-1", 
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="low",
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
            
            # 转回base64
            buffered = BytesIO()
            image.save(buffered, format="PNG")
            processed_image_base64 = base64.b64encode(buffered.getvalue()).decode()
            
            return processed_image_base64
        
        return None
    except Exception as e:
        print(f"生成 {description} 的图像失败: {e}")
        return None