import requests
from .generate_prompt import get_prompt
from .crop_image import crop
from .check_image import check
from .rearrange_image import rearrange_image
import base64
from openai import OpenAI
from PIL import Image
from io import BytesIO

API_KEY = 'sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9'
API_PROVIDER = 'https://aihubmix.com/v1'

# 创建OpenAI客户端的函数，每个进程需要自己的客户端实例
def create_client():
    return OpenAI(
        api_key=API_KEY,
        base_url=API_PROVIDER,
    )

# def get_image(  bg_hex, 
#                 prompt_path = './TitleGen/prompts/generated_output.md',
#                 save_path = './images/title/generated_image.png',
#                 res = "RESOLUTION_1408_576"):
#     url = "https://aihubmix.com/ideogram/generate"
#     api_key = "sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9"
#     with open(prompt_path, 'r', encoding='utf-8') as file:
#         image_prompt = file.read()

#     payload = { "image_request": {
#             "prompt": image_prompt,
#             #"aspect_ratio": "ASPECT_16_9",
#             "model": "V_2",
#             "magic_prompt_option": "AUTO",
#             "style_type": "DESIGN",
#             "resolution": res,
#             "color_palette":{
#                 "members":[
#                     {
#                     "color_hex": bg_hex,
#                     "color_weight": 1
#                     }
#                 ]
#             }
#         } }
#     headers = {
#         "Api-Key": api_key,
#         "Content-Type": "application/json"
#     }
#     response = requests.post(url, json=payload, headers=headers)
#     data = response.json()
#     image_url = data['data'][0]['url']
#     response_image = requests.get(image_url)
#     if response_image.status_code == 200:
#         with open(save_path, 'wb') as file:
#             file.write(response_image.content)
#     return response

def get_image_from_openai(color_list, 
                prompt_path = './TitleGen/prompts/generated_output.md',
                save_path = './images/title/generated_image.png',
                res = "RESOLUTION_1408_576"):
    
    # 每个进程创建自己的客户端实例
    local_client = create_client()

    with open(prompt_path, 'r', encoding='utf-8') as file:
        prompt = file.read()
    
    try:
        result = local_client.images.generate(
            model="gpt-image-1", 
            prompt=prompt,
            n=1,
            size="1536x1024",
            quality="high",
            moderation="low",
            background="transparent",
        )
        
        print(f"生成的图像成功")
        
        # 立即保存图像
        if result and result.data:
            image_base64 = result.data[0].b64_json
            image_data = base64.b64decode(image_base64)
            # 将base64转换为PIL图像
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
            # 使用PIL的save方法保存图像，指定PNG格式以保持透明度
            image.save(save_path, 'PNG')
            return True
        return None
    except Exception as e:
        print(f"生成图像失败: {e}")
        return None

def get_title(title, 
            color_list, 
            prompt_times = 2, 
            image_times = 4, 
            image_res = "RESOLUTION_1536_640",#"RESOLUTION_1408_576", 
            save_path = './TitleGen/images/title/generated_image.png'):
    succ = 0
    for i in range(prompt_times):
        if succ == 1:
            break
        print("Prompt times: ", i)
        get_prompt(title, color_list)
        print("Prompt generated.")
        for j in range(image_times):
            print("Image times: ", j)
            image_response = get_image_from_openai(color_list=color_list, res=image_res, save_path=save_path)
            print("image_response: ", image_response.json())
            
            crop(image_path=save_path)
            rearrange_image(image_path=save_path)
            check_result, check_response = check(title, image_path=save_path)
            print("check_response: ", check_response)
            print("check_result: ", check_result)
            
            if check_result == "Yes":
                succ = 1
                break
    return succ, save_path

def get_title_b64(title, 
            color_list, 
            prompt_times = 2, 
            image_times = 4, 
            image_res = "RESOLUTION_1536_640",#"RESOLUTION_1408_576", 
            save_path = './TitleGen/images/title/generated_image.png'):
    succ = 0
    for i in range(prompt_times):
        if succ == 1:
            break
        print("Prompt times: ", i)
        get_prompt(title, color_list)
        print("Prompt generated.")
        for j in range(image_times):
            print("Image times: ", j)
            get_image_from_openai(color_list=color_list, res=image_res, save_path=save_path)
            
            crop(image_path=save_path)
            rearrange_image(image_path=save_path)
            check_result, check_response = check(title, image_path=save_path)
            print("check_response: ", check_response)
            print("check_result: ", check_result)
            
            if check_result == "Yes":
                succ = 1
                break
    if succ == 1:
        with open(save_path, "rb") as image_file:
            image_data = image_file.read()
            base64_image = base64.b64encode(image_data).decode('utf-8')
            return succ, base64_image
    return succ, None