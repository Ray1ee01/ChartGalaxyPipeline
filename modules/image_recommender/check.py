# 1. 扫描当前目录下所有image文件 包含png jpg jpeg webp，进行编号 存储下list
import os, json
import uuid  # 添加导入uuid模块
image_pathes = []
root = '/data/lizhen/resources/image'
image_root = os.path.join(root, 'images')
image_path_file = os.path.join(root, 'image_pathes.txt')
result_map_file = os.path.join(root, 'result_map.txt')

# Load existing result mappings
result_map = {}
if os.path.exists(result_map_file):
    with open(result_map_file, 'r') as f:
        for line in f:
            filename, result_file = line.strip().split(',')
            result_map[filename] = result_file

existing_paths = set()
if os.path.exists(image_path_file):
    with open(image_path_file, 'r') as f:
        existing_paths = set(line.strip() for line in f.readlines())
        image_pathes = [os.path.join(image_root, path) for path in existing_paths]
        print(f"Loaded {len(image_pathes)} existing image paths")

print('Scanning images...')
new_paths = []
for root_dir, dirs, files in os.walk(image_root):
    for file in files:
        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            abs_path = os.path.join(root_dir, file)
            rel_path = os.path.relpath(abs_path, image_root)
            if rel_path not in existing_paths:
                new_paths.append(rel_path)
                image_pathes.append(abs_path)

if new_paths:
    print(f"Found {len(new_paths)} new images")
    with open(image_path_file, 'a') as f:
        for path in new_paths:
            f.write(path + '\n')

print(f"Total images: {len(image_pathes)}")

from openai import OpenAI
from PIL import Image
import base64
from io import BytesIO
import requests
from concurrent.futures import ThreadPoolExecutor
import threading

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
    number_of_trials = 0
    while number_of_trials < 5:
        try:
            response = requests.post(
                "https://aihubmix.com/v1/chat/completions",
                headers={
                    "Authorization": "Bearer sk-HGwzhul85auxqDzz6eF39b9eD47347F7A454Ad9e8f1f380d",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gemini-2.0-flash",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_data}"
                                }
                            }
                        ]
                    }]
                }
            )
            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            else:
                print(f"Error status code: {response.status_code}")
                number_of_trials += 1
        except Exception as e:
            print(f"Request error: {e}")
            number_of_trials += 1
    
    return 'Error!'

# 2. 读取prompt.json文件，读取整个作为字符串，逐个读取image文件，调用ask_image函数，将返回的结果存储下来
import json
with open('modules/image_recommender/prompt.json', 'r') as f:
    prompt = f.read()
# print(prompt)

results_path = os.path.join(root, 'results')
if not os.path.exists(results_path):
    os.makedirs(results_path)

def process_image(args):
    i, image_path, prompt, results_path = args
    rel_path = os.path.relpath(image_path, image_root)
    
    # 使用UUID生成随机文件名，而不是使用索引
    random_filename = str(uuid.uuid4())
    target_path = os.path.join(results_path, f'{random_filename}.json')
    
    # Skip if already processed
    if rel_path in result_map:
        print(f'Skipping {i+1}/{len(image_pathes)} (already exists in result map)')
        return
    
    print(f'Processing {i+1}/{len(image_pathes)}')
    try:
        image_data = image_to_base64(image_path)
        result = ask_image(prompt, image_data)
        try:
            result = json.loads(result)
        except:
            result = result.replace('```json', '').replace('```', '')
            result = json.loads(result)
        
        # Add filename and remove explanation
        result['filename'] = rel_path
        if 'explanation' in result:
            del result['explanation']
        
        with open(target_path, 'w') as f:
            json.dump(result, f)
            
        # Update result mapping
        with open(result_map_file, 'a') as f:
            f.write(f"{rel_path},{target_path}\n")
        result_map[rel_path] = target_path
    except Exception as e:
        print(f'Failed to process {i+1}/{len(image_pathes)}: {str(e)}')

# Pre-scan for existing results
print("Pre-scanning for existing results...")
results_path = os.path.join(root, 'results')
if not os.path.exists(results_path):
    os.makedirs(results_path)

# Filter out already processed images
image_pathes = [path for path in image_pathes if os.path.relpath(path, image_root) not in result_map]
print(f"Remaining images to process: {len(image_pathes)}")

# Main processing loop with thread pool
num_threads = 20
with ThreadPoolExecutor(max_workers=num_threads) as executor:
    tasks = [
        (i, image_pathes[i], prompt, results_path) for i in range(len(image_pathes))
    ]
    executor.map(process_image, tasks)