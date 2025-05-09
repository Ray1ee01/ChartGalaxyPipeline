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

example_data_dir = "./data/example_data"
example_infographic_dir = "./data/example_infographic"

def generate_infographic_gpt(data_name):
    data_path = os.path.join(example_data_dir, f"{data_name}.json")
    with open(data_path, 'r') as f:
        raw_data = json.load(f)
        raw_data = raw_data['data']
    
    raw_data_str = json.dumps(raw_data)

    # 获取reference_infographic_path
    reference_infographic_path1 = os.path.join(example_infographic_dir, f"{data_name}-Origin.png")
    reference_infographic_path2 = os.path.join(example_infographic_dir, f"{data_name}-Origin.jpg")
    reference_infographic_path = reference_infographic_path1 if os.path.exists(reference_infographic_path1) else reference_infographic_path2

    # 每个进程创建自己的客户端实例
    local_client = create_client()

    prompt = f"""
        You are an experienced infographic designer. 

Given the following dataset in JSON format: {raw_data_str}

and a reference infographic image (used as a style guide), your task is to create a new infographic that clearly and creatively visualizes the data.

**Design Instructions**: 
- Maintain overall stylistic consistency with the reference infographic — including color scheme, typography, iconography, and visual tone — to ensure a coherent aesthetic. However, adapt the layout, chart types, and visual elements creatively to best suit the structure and insights of the new dataset.
- Prioritize effective communication of the new data over replicating the original design.
- Incorporate visual storytelling elements — such as icons, labels, contrast, or scale — to highlight key patterns or contrasts in the data.
- Include a clear, well-designed title that matches the tone and aesthetic of the reference.
- You may choose a light or dark background — whatever best fits the visual narrative and legibility.
- Legends, axes, and any necessary annotations should be present and styled consistently.

**Output Format**:
- A single high-resolution infographic image (portrait or square format)
- All text and numbers should be **fully readable**
- The image should be **self-explanatory** — no external explanation should be needed
- The style should be **clean, professional, and ready for publication**

Avoid any explanation outside the visual — the final image should be self-explanatory and visually engaging.
    """
    
    try:
        result = local_client.images.edit(
            model="gpt-image-1", 
            image=open(reference_infographic_path, "rb"),
            prompt=prompt,
            n=1,
            size="1024x1536",
            quality="high",
            # moderation="low",
            # background="auto",
        )
        
        print(f"生成 infographic 成功")
        
        # 直接返回base64
        if result and result.data:
            return result.data[0].b64_json
        
        return None
    except Exception as e:
        print(f"生成 infographic 失败: {e}")
        return None
    
if __name__ == "__main__":
    import os
    
    # 获取示例文件夹路径
    example_dir = './data/example_infographic'
    
    # 获取所有以-Origin.png结尾的文件
    data_name_list = []
    for file in os.listdir(example_dir):
        if file.endswith('-Origin.png'):
            data_name_list.append(file.split('-Origin')[0])
        elif file.endswith('-Origin.jpg'):
            data_name_list.append(file.split('-Origin')[0])
    
    print("数据名称列表:", data_name_list)

    data_name_list = ["Solar"]
    
    for data_name in data_name_list:
        print(f"生成 {data_name} 的 infographic")
        base64_image = generate_infographic_gpt(data_name)
        save_path = os.path.join(example_infographic_dir, f"{data_name}-GPT_ref.png")
        with open(save_path, "wb") as f:
            f.write(base64.b64decode(base64_image))
        print(f"生成 {data_name} 的 infographic 成功")
    