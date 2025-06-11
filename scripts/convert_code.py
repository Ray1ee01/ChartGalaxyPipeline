#!/usr/bin/env python3
"""
扫描 modules/chart_engine/template/d3-js 下的所有 JS 文件，
使用 LLM 处理并输出到 d3-js-new 目录下的同名目录
"""

import os
import requests
import json
from pathlib import Path
import time
import concurrent.futures

# OpenAI API configuration
API_KEY = 'sk-GZPrsS9VcR4Xf5iADf6a55D0C0Bb4f8d8f12DaC9F0857cAe'
API_PROVIDER = 'https://aihubmix.com'
def query_openai(prompt: str, code_content: str) -> str:
    """
    调用 OpenAI API 处理代码
    Args:
        prompt: 提示词
        code_content: 需要处理的代码内容
    Returns:
        str: OpenAI 的响应结果,如果出错则返回 None
    """
    headers = {
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    data = {
        'model': 'gemini-2.5-pro-preview-05-06',
        'messages': [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': f'Please refactor the following JavaScript code:\n\n{code_content}'}
        ],
        'temperature': 0.3,
        'max_tokens': 30000
    }
    
    try:
        response = requests.post(f'{API_PROVIDER}/v1/chat/completions', headers=headers, json=data)
        response.raise_for_status()
        content = response.json()['choices'][0]['message']['content'].strip()
        
        # 删除所有代码块标记
        content = content.replace('```json', '')
        content = content.replace('```javascript', '')
        content = content.replace('```', '')
        content = content.strip()
            
        return content
    except Exception as e:
        print(f"调用 OpenAI API 出错: {e}")
        return None

def load_prompt():
    """加载转换提示词"""
    prompt_file = Path('scripts/convert_code_prompt.txt')
    if prompt_file.exists():
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read()
    else:
        print(f"警告：找不到提示词文件 {prompt_file}")
        return ""

def find_js_files(base_dir):
    """递归查找所有 JS 文件"""
    js_files = []
    base_path = Path(base_dir)
    
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith('.js'):
                file_path = Path(root) / file
                relative_path = file_path.relative_to(base_path)
                js_files.append({
                    'full_path': file_path,
                    'relative_path': relative_path,
                    'dir_name': relative_path.parent,
                    'file_name': file
                })
    
    return js_files

def process_js_file(file_info, prompt, output_base_dir):
    """处理单个 JS 文件"""
    print(f"正在处理: {file_info['relative_path']}")
    
    # 读取原始文件
    try:
        with open(file_info['full_path'], 'r', encoding='utf-8') as f:
            original_code = f.read()
    except Exception as e:
        print(f"读取文件失败 {file_info['full_path']}: {e}")
        return False
    
    # 检查文件大小，如果超过80000个字符 (约20000 tokens)，则跳过
    if len(original_code) > 80000:
        print(f"文件过大，跳过: {file_info['relative_path']} (大小: {len(original_code)} 字符)")
        return False
    
    # 调用 LLM 处理
    processed_code = query_openai(prompt, original_code)
    
    if processed_code is None:
        print(f"LLM 处理失败: {file_info['relative_path']}")
        return False
    
    # 创建输出目录
    output_dir = Path(output_base_dir) / file_info['dir_name']
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 写入处理后的文件
    output_file = output_dir / file_info['file_name']
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(processed_code)
        print(f"成功输出: {output_file}")
        return True
    except Exception as e:
        print(f"写入文件失败 {output_file}: {e}")
        return False

def main():
    """主函数"""
    # 配置路径
    source_dir = 'modules/chart_engine/template/d3-js'
    output_dir = 'modules/chart_engine/template/d3-js-new'
    
    # 检查源目录是否存在
    if not Path(source_dir).exists():
        print(f"错误：源目录不存在 {source_dir}")
        return
    
    # 加载提示词
    prompt = load_prompt()
    if not prompt:
        print("错误：无法加载提示词")
        return
    
    # 查找所有 JS 文件
    print(f"扫描目录: {source_dir}")
    js_files = find_js_files(source_dir)
    print(f"找到 {len(js_files)} 个 JS 文件")
    
    # 创建输出基础目录
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # 处理每个文件
    success_count = 0
    total_count = len(js_files)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_file = {executor.submit(process_js_file, file_info, prompt, output_dir): file_info for file_info in js_files}
        
        for i, future in enumerate(concurrent.futures.as_completed(future_to_file), 1):
            file_info = future_to_file[future]
            print(f"\n进度: {i}/{total_count}")
            try:
                if future.result():
                    success_count += 1
            except Exception as exc:
                print(f"{file_info['relative_path']} 生成时发生错误: {exc}")
            # 添加延迟避免 API 限制 (如果需要，可以在 process_js_file 内部或此处根据API策略调整)
            # time.sleep(0.1) # 调整或移除此处的延时，因为并发处理时，单个线程内的延时可能已足够

    print(f"\n处理完成！")
    print(f"成功处理: {success_count}/{total_count} 个文件")
    print(f"输出目录: {output_dir}")

if __name__ == "__main__":
    main()
