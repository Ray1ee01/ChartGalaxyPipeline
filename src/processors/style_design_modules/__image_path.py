import os
import json

def scan_images(root_dir):
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff')
    file_dict = {}

    for dirpath, dirnames, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.lower().endswith(image_extensions):
                if filename not in file_dict:
                    full_path = os.path.join(dirpath, filename)
                    relative_path = os.path.relpath(full_path, root_dir)
                    file_dict[filename] = relative_path

    return file_dict

def save_to_json(data, output_file):
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def main():
    root_directory = "/data3/yukai/datasets/infographic_data/check_202501022351" 
    output_json = "image_paths.json"
    
    # 扫描目录
    image_dict = scan_images(root_directory)
    
    # 保存结果到JSON
    save_to_json(image_dict, output_json)
    
    print(f"扫描完成,共找到 {len(image_dict)} 个图片文件")
    print(f"结果已保存到 {output_json}")

if __name__ == "__main__":
    main()