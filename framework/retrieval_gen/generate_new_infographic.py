import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from infographics_generator.infographics_generator import process
from generate_new_layouts import process_data_file as generate_new_layout
from image_gen import generate_image
from TitleGen.code.generate_title_image import get_title_b64
from convert_pallete_to_data import convert_palette_to_data
import json
import logging

client_key = 'sk-149DmKTCIvVQbbgk9099Bf51Ef2d4009A1B09c22246823F9'
base_url = 'https://aihubmix.com/v1'

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s',
    handlers=[logging.StreamHandler()]
)

def generate_new_infographic(raw_data_path, old_layout_path, output_file):
    annotations_path = './data/title_annotations.json'
    raw_data = json.load(open(raw_data_path, 'r'))

    # 创建临时文件夹
    tmp_dir = './tmp'
    os.makedirs(tmp_dir, exist_ok=True)
    
    # 处理数据文件
    new_layout_path = os.path.join(tmp_dir, 'new_layout.json')
    with open(new_layout_path, 'r') as f:
        new_layout_file = json.load(f)
        new_layout = new_layout_file["new_layout"]
    generate_new_layout(raw_data_path, old_layout_path, annotations_file=annotations_path, output_path=new_layout_path)

    # 转换调色板
    old_filename = new_layout_file["file_name"]
    # 提取文件名后缀之前的部分
    old_filename = old_filename.split('.')[0]
    # 只保留最后一个/之后的内容
    old_filename = old_filename.split('/')[-1]
    all_pallete_path = './ColorTest/filter_pallete_v3.json'
    with open(all_pallete_path, 'r') as f:
        all_pallete_file = json.load(f)
        pallete_data = all_pallete_file[old_filename]
    # 转换调色板
    raw_data = convert_palette_to_data(raw_data, pallete_data)

    # 获取标题
    with open(new_layout_path, 'r') as f:
        new_layout_file = json.load(f)
        new_layout = new_layout_file["new_layout"]
    title_info = [layout for layout in new_layout if layout["category_id"] == 3]
    title = title_info[0]["title"]
    raw_data['metadata']['title'] = title
    raw_data['titles']['main_title'] = title
    succ, title_image_base64 = get_title_b64(title, raw_data['colors']['background_color'])
    raw_data['images']['title'] = title_image_base64

    # 生成图像
    primary_image_base64 = generate_image(title, raw_data['colors']['other']['primary'])
    raw_data['images']['other']['primary'] = primary_image_base64


    updated_raw_data_path = os.path.join(tmp_dir, 'updated_raw_data.json')
    # 保存数据
    with open(updated_raw_data_path, 'w') as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=4)

    process(updated_raw_data_path, new_layout_path, output_file, client_key, base_url)

if __name__ == "__main__":
    generate_new_infographic("/data1/lizhen/resources/result/data_pool_v2/402.json", "./output_info/chart_info_375.json", "./output_svg/new_infographic.svg")

