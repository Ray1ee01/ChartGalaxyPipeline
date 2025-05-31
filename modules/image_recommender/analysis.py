# check results_m folder and get distribution
import os, json
json_path = './results_m/'

available_list = ['image_content', 'topic', 'data_facts', 'color_style', 'size']
data_fact_list = ['increasing', 'decreasing', 'highlight', 'deny', 'maximum', 'minimum', 'comparison', 'none']
color_style_list = ['monochrome', 'colorful', 'grayscale', 'dual-color']
size_list = ['icon', 'clipart', 'background']

distribution = {
    'data_facts': {},
    'color_style': {},
    'size': {}
}

cases = {
    'data_facts': {},
    'color_style': {},
    'size': {}
}
ct = 0
case_limit = 10
image_pathes = []
with open('image_pathes.json', 'r') as f:
    image_pathes = json.load(f)


for i, file in enumerate(os.listdir(json_path)):
    if not file.endswith('.json'):
        continue
    
    # load json
    with open(f'{json_path}{file}', 'r') as f:
        data = json.load(f)
    
    ct += 1
    distribution['color_style'][data['color_style']] = distribution['color_style'].get(data['color_style'], 0) + 1
    distribution['size'][data['size']] = distribution['size'].get(data['size'], 0) + 1
    distribution['data_facts'][data['data_facts']] = distribution['data_facts'].get(data['data_facts'], 0) + 1

    file_id = int(file.split('.')[0])
    cases['color_style'][data['color_style']] = cases['color_style'].get(data['color_style'], [])
    if len(cases['color_style'][data['color_style']]) < case_limit:
        cases['color_style'][data['color_style']].append((file_id, image_pathes[file_id]))
    cases['size'][data['size']] = cases['size'].get(data['size'], [])
    if len(cases['size'][data['size']]) < case_limit:
        cases['size'][data['size']].append((file_id, image_pathes[file_id]))
    cases['data_facts'][data['data_facts']] = cases['data_facts'].get(data['data_facts'], [])
    if len(cases['data_facts'][data['data_facts']]) < case_limit:
        cases['data_facts'][data['data_facts']].append((file_id, image_pathes[file_id]))

# save json
with open('distribution.json', 'w') as f:
    json.dump(distribution, f, indent=4)
with open('cases.json', 'w') as f:
    json.dump(cases, f, indent=4)

# move cases to './cases/'
cases_path = './cases/'
if not os.path.exists(cases_path):
    os.makedirs(cases_path)
for key in cases:
    for case in cases[key]:
        for i, info in enumerate(cases[key][case]):
            file_id, image_path = info
            target_path = f'{cases_path}{key}/{case}/'
            if not os.path.exists(target_path):
                os.makedirs(target_path)
            os.system(f'cp {image_path} {target_path}{file_id}.jpg')

print(ct)


