import sys
import os
import base64
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from infographics_generator.infographics_generator import process
from generate_new_layouts import process_data_file as generate_new_layout
from image_gen import generate_image
from TitleGen.code.generate_title_image import get_title_b64
from convert_pallete_to_data import convert_palette_to_data
import json
import logging
from gpt_infographic_gen import generate_infographic_gpt

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
    
    print(f'pallete_data: {pallete_data}')
    
    # 转换调色板
    raw_data = convert_palette_to_data(raw_data, pallete_data)

    # 提取调色板中的所有颜色
    color_list = []
    
    def extract_colors(data):
        if isinstance(data, str) and data.startswith('#'):
            color_list.append(data)
        elif isinstance(data, list):
            for item in data:
                extract_colors(item)
        elif isinstance(data, dict):
            for value in data.values():
                extract_colors(value)
    
    # 递归提取所有颜色
    extract_colors(pallete_data)

    # 获取标题
    with open(new_layout_path, 'r') as f:
        new_layout_file = json.load(f)
        new_layout = new_layout_file["new_layout"]
    title_info = [layout for layout in new_layout if layout["category_id"] == 3]
    print(f"title_info: {title_info}")
    title = title_info[0]["title"]
    raw_data['metadata']['title'] = title
    raw_data['titles']['main_title'] = title
    succ, title_image_base64 = get_title_b64(title, color_list)
    # title_image_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    raw_data['images']['title'] = title_image_base64

    # 生成图像
    # primary_image_base64 = generate_image(title, color_list)
    primary_image_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    raw_data['images']['other']['primary'] = primary_image_base64

    updated_raw_data_path = os.path.join(tmp_dir, 'updated_raw_data.json')
    # 保存数据
    with open(updated_raw_data_path, 'w') as f:
        json.dump(raw_data, f, ensure_ascii=False, indent=4)

    process(updated_raw_data_path, new_layout_path, output_file, client_key, base_url, chart_name="multiple_radar_chart_01")

if __name__ == "__main__":
    # data_path = "/data1/lizhen/resources/result/data_pool_v2/168.json" # energy
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Art_scenario_1_163730_69876.json" # energy 
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Wildlife_Conservation_scenario_3_204419_45138.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Sports_scenario_5_135209_29792.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Energy_scenario_3_021315_79695.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Wildlife_Conservation_scenario_1_202610_44111.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Wildlife_Conservation_scenario_1_205234_14839.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Art_scenario_3_162158_83770.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Entertainment_scenario_1_235156_92311.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Cultural_Traditions_scenario_1_014722_29615.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Educational_Systems_scenario_5_192906_66659.json"
    # data_path = "/data1/lizhen/resources/result/claude_data_v2/Educational_Systems_scenario_1_195246_69059.json"
    data_path = "/data1/lizhen/resources/result/claude_data_v2/Energy_scenario_3_025843_42770.json"
    # data_path = "/data1/lizhen/resources/result/data_pool_v2/93.json"
    data_name = data_path.split('/')[-1][:-5]

    old_layout_path = f"./output_info/chart_info_26.json"
    generate_new_infographic(data_path, old_layout_path, "./output_svg/new_infographic.svg")

    raw_data = json.load(open(data_path, 'r'))
    raw_data_str = json.dumps(raw_data['data'])

    # img_base64 = generate_infographic_gpt(raw_data_str)
    # save_path = f"./output_gpt/{data_name}_gpt.png"
    # with open(save_path, 'wb') as f:
    #     f.write(base64.b64decode(img_base64))

