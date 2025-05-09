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

def generate_infographic_gpt(raw_data):
    
    # 每个进程创建自己的客户端实例
    local_client = create_client()

    prompt = f"""
        Create an infographic based on the following data: {raw_data}
        
        First, analyze the data and choose the most appropriate chart type (bar chart, line chart, pie chart, etc.) to best represent the insights.
        
        Then create a complete infographic that includes:
        
        1. Generate an engaging and descriptive title that captures the main insight from the data
        
        2. Create the main visualization using your chosen chart type:
        - Ensure clear data representation
        - Use appropriate scales and axes
        - Add data labels where necessary
        - Apply a cohesive color scheme
        
        3. Enhance the infographic with decorative pictograms:
        - Add relevant icons and symbols that relate to the data theme
        - Place pictograms strategically around the chart to improve visual appeal
        - Ensure pictograms are simple, clean and intuitive
        - All pictograms should have transparent backgrounds
        
        4. Layout and Design:
        - Arrange all elements (title, chart, pictograms) in a balanced composition
        - Maintain professional spacing and alignment
        - Ensure the final design is both informative and visually engaging
        
        The infographic should effectively communicate the data story while maintaining visual appeal through the thoughtful integration of charts and decorative elements.
    """
    
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
        
        print(f"生成 infographic 成功")
        
        # 直接返回base64
        if result and result.data:
            return result.data[0].b64_json
        
        return None
    except Exception as e:
        print(f"生成 infographic 失败: {e}")
        return None