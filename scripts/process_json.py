import os
import json

def process_json_files(directory):
    # 遍历目录中的所有文件
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.json'):
                file_path = os.path.join(root, file)
                
                try:
                    # 读取JSON文件
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    # 检查是否需要修改
                    if 'titles' not in data:
                        # 创建新的titles结构
                        data['titles'] = {
                            'main_title': data.get('metadata', {}).get('title', ''),
                            'sub_title': data.get('metadata', {}).get('description', '')
                        }
                    
                    # 删除指定字段
                    if 'title' in data:
                        del data['title']
                    if 'description' in data:
                        del data['description']
                    if 'main_insight' in data:
                        del data['main_insight']
                    
                    # 保存修改后的文件
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    
                    print(f"处理文件: {file_path}")
                
                except Exception as e:
                    print(f"处理文件 {file_path} 时出错: {str(e)}")

# 执行处理
input_directory = '/data/lizhen/input_data/data2'
process_json_files(input_directory)
print("处理完成!")