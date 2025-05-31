import json
import os
import base64
import requests
import threading
from collections import Counter
from PIL import Image
from concurrent.futures import ThreadPoolExecutor

API_KEY = 'sk-HGwzhul85auxqDzz6eF39b9eD47347F7A454Ad9e8f1f380d'
API_PROVIDER = 'https://aihubmix.com/v1'

# Thread-safe print function
print_lock = threading.Lock()
def thread_safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

def query_llm(prompt: str, image_path=None) -> str:
    """
    Query LLM API with a prompt and optionally an image
    Args:
        prompt: The prompt to send to LLM
        image_path: Path to the image file to analyze
    Returns:
        str: The response from LLM
    """
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    messages = [
        {'role': 'system', 'content': 'You are a data visualization expert. Provide concise, specific answers.'},
    ]
    
    # Add image content if available
    if image_path:
        try:
            with open(image_path, 'rb') as img_file:
                img_data = img_file.read()
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                
                messages.append({
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {'type': 'image_url', 'image_url': {'url': f'data:image/png;base64,{img_base64}'}}
                    ]
                })
        except Exception as e:
            thread_safe_print(f"Error processing image {image_path}: {e}")
            return None
    else:
        messages.append({'role': 'user', 'content': prompt})
    
    data = {
        'model': 'gemini-2.0-flash',
        'messages': messages,
        'temperature': 0.5,
        'max_tokens': 5000
    }
    
    try:
        response = requests.post(f'{API_PROVIDER}/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content'].strip()
    except Exception as e:
        thread_safe_print(f"Error querying LLM: {e}")
        return None

# 统计category-subcategory组合和type的计数
category_subcategory_counter = Counter()
type_counter = Counter()
available_qa_pairs = []
counter_lock = threading.Lock()
qa_pairs_lock = threading.Lock()

# 添加进度跟踪
processed_count = 0
retained_count = 0
total_count = 0
progress_lock = threading.Lock()
output_file_lock = threading.Lock()

def update_progress(is_retained=False):
    with progress_lock:
        global processed_count, retained_count
        processed_count += 1
        if is_retained:
            retained_count += 1
        if processed_count % 10 == 0 or processed_count == total_count:
            percentage = (processed_count / total_count) * 100
            retention_rate = (retained_count / processed_count) * 100 if processed_count > 0 else 0
            thread_safe_print(f"处理进度: {processed_count}/{total_count} ({percentage:.1f}%) - 已保留: {retained_count} ({retention_rate:.1f}%)")

# 实时写入到文件
def write_to_file(data):
    with output_file_lock:
        with open('test_filter.jsonl', 'a', encoding='utf-8') as out_f:
            json.dump(data, out_f, ensure_ascii=False)
            out_f.write('\n')

def process_line(line):
    data = json.loads(line)
    metadata = data['metadata']
    
    # 加载图片 - 修改为使用images列表中的第一个图片
    if 'images' in data and len(data['images']) > 0:
        image_path = data['images'][0]
    else:
        thread_safe_print(f"图片列表为空或不存在: {data.get('id', 'unknown')}")
        update_progress()
        return None
        
    if not os.path.exists(image_path):
        thread_safe_print(f"图片不存在: {image_path}")
        update_progress()
        return None
    
    # 从conversation中提取问题
    if 'conversation' in data and len(data['conversation']) > 0 and 'content' in data['conversation'][0]:
        question = data['conversation'][0]['content']
    else:
        thread_safe_print(f"未找到问题: {data.get('id', 'unknown')}")
        update_progress()
        return None
            
    # 使用LLM检查问题是否可回答
    prompt = f"""
    Look at this chart and determine if it's possible to answer the following question based on the information shown:
    {question}
    
    Please respond with only 'yes' or 'no'.
    If the information in the chart is unclear or insufficient to answer the question, respond with 'no'.
    If the information needed to answer is present in the chart, respond with 'yes', even if the answer might be difficult or complex.
    
    Note: If there are multiple <image> placeholders in the question, these are used to represent elements in the chart. You don't need to understand the <image> placeholders themselves.
    """
    
    try:
        response = query_llm(prompt, image_path)
        if response and response.lower() == 'yes':
            # 统计可回答的问题
            category = metadata['category']
            subcategory = metadata['subcategory']
            with counter_lock:
                category_subcategory_counter[f"{category} - {subcategory}"] += 1
                type_counter[metadata['type']] += 1
            with qa_pairs_lock:
                available_qa_pairs.append(data)
            
            # 实时写入到文件
            write_to_file(data)
            
            update_progress(is_retained=True)
            return data
    except Exception as e:
        thread_safe_print(f"处理问题时出错: {e}")
    
    update_progress()
    return None

# 读取test.jsonl文件并创建test_filter.jsonl
with open('test.jsonl', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 设置总数量
total_count = len(lines)
thread_safe_print(f"开始处理，总计 {total_count} 条数据")

# 创建新文件（清空已有内容）
with open('test_filter.jsonl', 'w', encoding='utf-8') as out_f:
    pass

with ThreadPoolExecutor(max_workers=15) as executor:
    results = list(executor.map(process_line, lines))

# 计算总数
total = sum(category_subcategory_counter.values())

# 打印category-subcategory统计
print("\n=== Category-Subcategory 统计 ===")
for cat_subcat, count in category_subcategory_counter.most_common():
    percentage = count / total * 100
    print(f"{cat_subcat}: {count} ({percentage:.1f}%)")

# 打印最终处理结果
retention_rate = (retained_count / processed_count) * 100 if processed_count > 0 else 0
print(f"\n=== 最终处理结果 ===")
print(f"处理总数: {processed_count}")
print(f"保留总数: {retained_count}")
print(f"保留率: {retention_rate:.1f}%")