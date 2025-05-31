# 1. 扫描当前目录下所有image文件 包含png jpg jpeg webp，进行编号 存储下list
import os, json
image_pathes = []
root = './images/'
image_path_file = 'image_pathes.json'

if os.path.exists(image_path_file):
    with open(image_path_file, 'r') as f:
        image_pathes = json.load(f)
        print(len(image_pathes))
else:
    print('error')

from openai import OpenAI
from PIL import Image
import base64
from io import BytesIO

client = OpenAI(
    api_key="sk-HGwzhul85auxqDzz6eF39b9eD47347F7A454Ad9e8f1f380d",
    base_url="https://aihubmix.com/v1"
)

def resize_image(img, max_size=512):
    width, height = img.size
    ratio = min(max_size / width, max_size / height)
    if ratio >= 1:
        return img
    new_width = int(width * ratio)
    new_height = int(height * ratio)
    resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return resized_img

def repaint_image(img):
    # rapaint transparent area with white color
    img = img.convert('RGBA')
    data = img.getdata()
    new_data = []
    for item in data:
        if item[3] == 0:
            new_data.append((255, 255, 255, 255))
        else:
            new_data.append(item)
    img.putdata(new_data)
    img = img.convert('RGB')
    # img.save('temp.png')
    return img
    
def image_to_base64(image_path, show=False, target_size=512):
    with Image.open(image_path) as img:
        # img = img.resize(size)
        img = resize_image(img, 512)
        img = repaint_image(img)
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return img_base64

wwxxhh = 0
def ask_image(prompt, image_data):
    global wwxxhh
    number_of_trials = 0
    while number_of_trials < 5:
        try:
            response = client.chat.completions.create(
            #   model="gpt-4o-mini",
            model="gemini-2.0-flash",
            messages=[
                {
                  "role": "user",
                  "content": [
                    {   
                        "type": "text", 
                        "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        },
                    },
                  ],
                }
              ]
            )
            wwxxhh += response.usage.total_tokens
            return response.choices[0].message.content

        except Exception as e:
            number_of_trials += 1
            print(e)

    return 'Error!'

# 2. 读取prompt.json文件，读取整个作为字符串，逐个读取image文件，调用ask_image函数，将返回的结果存储下来
import json
with open('prompt.json', 'r') as f:
    prompt = f.read()
# print(prompt)



ques_id = 15394
results_path = './results/'
image_path = image_pathes[ques_id]
print(image_path)

image_data = image_to_base64(image_path)
result = ask_image(prompt, image_data)
print(result)

# from IPython import embed
# embed()