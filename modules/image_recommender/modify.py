# check all json file in results_path
import json, os
results_path = './results/'
target_path = './results_m/'
# remove target_path
if os.path.exists(target_path):
    os.system(f'rm -r {target_path}')
if not os.path.exists(target_path):
    os.makedirs(target_path)

available_list = ['image_content', 'topic', 'data_facts', 'color_style', 'icon_or_clipart']
data_fact_list = ['increasing', 'decreasing', 'highlight', 'deny', 'maximum', 'minimum', 'comparison', 'none']
color_style_list = ['monochrome', 'colorful', 'grayscale', 'dual-color']
scale_and_complexity_level_list = ['icon', 'clipart', 'background']
for i, file in enumerate(os.listdir(results_path)):
    if not file.endswith('.json'):
        continue
    
    # load json
    with open(f'{results_path}{file}', 'r') as f:
        data = json.load(f)

    if 'output_case' in data:
        data = data['output_case']

    if 'Topic' in data:
        data['topic'] = data['Topic']
        del data['Topic']
    
    if 'key_words' in data:
        data['topic'] = data['key_words']
        del data['key_words']
    
    # key error
    error = False
    for key in available_list:
        if key not in data:
            error = True
            break
    if error:
        print(f'{file} is not complete')
        continue

    # data_facts error
    if data['data_facts'] == 'increase':
        data['data_facts'] = 'increasing'
    if data['data_facts'] not in data_fact_list:
        print(f'{file} data_facts is error')
        continue

    # color_style error
    if data['color_style'] == 'gray-scale' or data['color_style'] == 'black and white':
        data['color_style'] = 'grayscale'
    if data['color_style'] == 'duo-color' or data['color_style'] == 'duel-color':
        data['color_style'] = 'dual-color'
    if data['color_style'] not in color_style_list:
        print(f'{file} color_style is error')
        continue

    # scale_and_complexity_level error
    if data['icon_or_clipart'] not in scale_and_complexity_level_list:
        print(f'{file} icon_or_clipart is error')
        continue
    data['size'] = data['icon_or_clipart']
    del data['icon_or_clipart']
    
    # save json
    target_file = f'{target_path}{file}'
    with open(target_file, 'w') as f:
        json.dump(data, f)