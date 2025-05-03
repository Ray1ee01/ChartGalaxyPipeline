
import os, json, time, tqdm, pickle
from image2palette.palette import nets_init, generate_color_open
import matplotlib.pyplot as plt
import matplotlib.patches as patches
# from multiprocessing import freeze_support
import numpy as np
from PIL import Image
from skimage import color as skcolor
from typing import Dict, List, Tuple


def display_colors(color_res):
    color_list = color_res['color_list']
    bcg_color = color_res['bcg']
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 4))
    
    n_colors = len(color_list)
    for i, color in enumerate(color_list):
        rect = patches.Rectangle((i, 0), 1, 1, facecolor=color)
        ax1.add_patch(rect)
    
    ax1.set_xlim(-0.1, n_colors + 0.1)
    ax1.set_ylim(-0.1, 1.1)
    ax1.axis('equal')
    ax1.set_xticks([])
    ax1.set_yticks([])
    ax1.set_title('Color List')

    rect = patches.Rectangle((0, 0), 1, 1, facecolor=bcg_color)
    ax2.add_patch(rect)

    ax2.set_xlim(-0.1, 1.1)
    ax2.set_ylim(-0.1, 1.1)
    ax2.axis('equal')
    ax2.set_xticks([])
    ax2.set_yticks([])
    ax2.set_title('Background Color')
    plt.tight_layout()
    plt.savefig('color_res.png')

import time, colour
def calculate_color_proportion(image_path, target_hex_color, threshold=15.0):
    img = Image.open(image_path)
    # resize image
    img = img.resize((200, 200), Image.LANCZOS)
    # translate to lab
    img_rgb = img.convert('RGB')
    img_rgb = np.array(img_rgb)
    img_lab = skcolor.rgb2lab(img_rgb).reshape(-1, 3)

    if target_hex_color.startswith('#'):
        target_hex_color = target_hex_color[1:]
    target_rgb = np.array([
        int(target_hex_color[0:2], 16) / 255,
        int(target_hex_color[2:4], 16) / 255,
        int(target_hex_color[4:6], 16) / 255
    ])
    # translate to lab use colour-science
    target_lab = colour.XYZ_to_Lab(colour.sRGB_to_XYZ(target_rgb))
    # print(target_lab)

    delta_e = np.zeros(img_lab.shape[0])
    for i in range(img_lab.shape[0]):
        delta_e[i] = np.linalg.norm(img_lab[i] - target_lab)

    # from IPython import embed; embed(); exit()
    
    matching_pixels = (delta_e < threshold).sum()
    total_pixels = len(delta_e)
    proportion = matching_pixels / total_pixels
    return proportion

def filter_palette(palette, 
                   delta_e_bcg_threshold=10.0, 
                   delta_e_between_threshold=10.0, 
                   grey_chroma_threshold=15.0):
    
    # 将 HEX 转换为 [0,1] 范围的 RGB
    def hex_to_rgb(hex_code: str):
        hex_code = hex_code.strip().lstrip('#')
        r = int(hex_code[0:2], 16) / 255.0
        g = int(hex_code[2:4], 16) / 255.0
        b = int(hex_code[4:6], 16) / 255.0
        return [r, g, b]

    # 将 [0,1] 范围的 sRGB 转换为 Lab (D65)
    def srgb_to_lab(srgb):
        xyz = colour.sRGB_to_XYZ(srgb)
        lab = colour.XYZ_to_Lab(xyz)
        return lab

    # 计算两种颜色在 Lab 空间下的 ∆E (CIE2000)
    def delta_e_cie2000(lab1, lab2):
        return colour.delta_E(lab1, lab2, method='CIE 2000')

    # 计算 Lab 转到 LCH，以获取 Chroma
    def lab_to_lch(lab):
        return colour.Lab_to_LCHab(lab)

    def norm01(x):
        return min(1.0, max(0.0, x))

    bcg_lab = srgb_to_lab(hex_to_rgb(palette['bcg']))
    color_labs = [(c, srgb_to_lab(hex_to_rgb(c))) for c in palette['color_list']]

    filtered_by_bcg = []
    similar_to_bcg = []
    for c_hex, c_lab in color_labs:
        if delta_e_cie2000(c_lab, bcg_lab) > delta_e_bcg_threshold:
            filtered_by_bcg.append((c_hex, c_lab))
        else:
            similar_to_bcg.append(c_hex)

    filtered_by_bcg_and_self = []
    similar_to_self = []
    for c_hex, c_lab in filtered_by_bcg:
        too_close = False
        for kept_hex, kept_lab in filtered_by_bcg_and_self:
            if delta_e_cie2000(c_lab, kept_lab) < delta_e_between_threshold:
                too_close = True
                break
        if not too_close:
            filtered_by_bcg_and_self.append((c_hex, c_lab))
        else:
            similar_to_self.append(c_hex)

    final_filtered = []
    context_colors = []
    for c_hex, c_lab in filtered_by_bcg_and_self:
        lch = lab_to_lch(c_lab)  # L, C, H
        if lch[1] >= grey_chroma_threshold:
            cg = False
            if lch[2] > 85 and lch[2] < 114 and lch[0] < 75:
                lch[0] = 80
                cg = True
            print(lch, cg)  
            if cg:
                c_lab = colour.LCHab_to_Lab(lch)
                c_rgb = colour.XYZ_to_sRGB(colour.Lab_to_XYZ(c_lab))
                # norm to [0, 1]
                c_rgb = [norm01(c) for c in c_rgb]
                c_hex = '#%02x%02x%02x' % tuple([int(c * 255) for c in c_rgb])
            final_filtered.append(c_hex)
        else:
            context_colors.append(c_hex)

    return {
        'color_list': final_filtered,
        'bcg': palette['bcg'],
        'context_colors': context_colors,
        'similar_to_bcg': similar_to_bcg
    }


def classify_and_get_palette(proportions, threshold=4.0):
    if len(proportions) == 1:
        return {
            'mode': 'monochrome',
            'main_color_index': [0],
            'other_color_index': []
        }
    if len(proportions) == 2:
        max_id = np.argmax(proportions)
        other_id = 1 - max_id
        if proportions[max_id] > threshold * proportions[other_id]:
            return {
                'mode': 'monochrome',
                'main_color_index': [max_id],
                'other_color_index': [other_id],
            }
        else:
            return {
                'mode': 'dual-color',
                'main_color_index': [0,1],
                'other_color_index': []
            }
    
    top1_id, top2_id, top3_id = np.argsort(proportions)[::-1][:3]
    all_index = list(range(len(proportions)))
    if proportions[top1_id] > threshold * proportions[top2_id]:
        return {
            'mode': 'monochrome',
            'main_color_index': [top1_id],
            'other_color_index': [i for i in all_index if i != top1_id],
        }
    if proportions[top2_id] > threshold * proportions[top3_id]:
        return {
            'mode': 'dual-color',
            'main_color_index': [top1_id, top2_id],
            'other_color_index': [i for i in all_index if i != top1_id and i != top2_id],
        }
    return {
        'mode': 'colorful',
        'main_color_index': all_index,
        'other_color_index': []
    }

def package_color(classify_result, color_res):
    color_list = color_res['color_list']
    bcg_color = color_res['bcg']
    return {
        'mode': classify_result['mode'],
        'color_list': color_list,
        'main_color': [color_list[i] for i in classify_result['main_color_index']],
        'bcg': bcg_color,
        'context_colors': color_res['context_colors'],
        'similar_to_bcg': color_res['similar_to_bcg'],
        'other_colors': [color_list[i] for i in classify_result['other_color_index']]
    }


if __name__ == '__main__':
    # freeze_support()  # Windows系统需要
    image_res = [('/data1/jiashu/data/tabular_data_v2/image/1657.jpeg', 0.3573246896266937),
        ('/data1/jiashu/data/tabular_data_v2/image/2093.jpeg', 0.35279521346092224),
        ('/data1/jiashu/data/tabular_data_v2/image/663.jpeg', 0.34443750977516174),
        ('/data1/jiashu/data/tabular_data_v2/image/2027.jpeg', 0.33736342191696167),
        ('/data1/jiashu/data/tabular_data_v2/image/1275.jpeg', 0.29700979590415955),
        ('/data1/jiashu/data/tabular_data_v2/image/1104.jpeg', 0.27424561977386475),
        ('/data1/jiashu/data/tabular_data_v2/image/1.jpeg', 0.21782559156417847),
        ('/data1/jiashu/data/tabular_data_v2/image/1256.jpeg', 0.2154102623462677),
        ('/data1/jiashu/data/tabular_data_v2/image/1349.jpeg', 0.1834704577922821),
        ('/data1/jiashu/data/tabular_data_v2/image/1139.jpeg', 0.16845592856407166),
        ('/data1/jiashu/data/tabular_data_v2/image/842.jpeg', 1)]

    init = False
    Sal, Sp = None, None
    def get_palette(number, bcg_flag, image_path):
        global init, Sal, Sp
        if not init:
            Sal, Sp = nets_init()
            init = True
        return generate_color_open(number, bcg_flag, image_path, Sal, Sp)
    
    image_path = image_res[-1][0]
    palette = get_palette(10, True, image_path); print(palette)
    # palette = {'color_list': ['#AFAFAF', '#7C888F', '#3C505D', '#D89B5B', '#D9D9D9', '#B297C7', '#D1D1D5', '#E0E0E0', '#F6F6F6', '#E1DFDC'], 'bcg': '#F2EDEE'}
    # palette = {'color_list': ['#F6F6F6', '#3F4F62', '#586878', '#FF9D63', '#549AFE', '#FFE44A', '#B984E0', '#22877C', '#C3C3C3', '#F4D2BF'], 'bcg': '#E2F1F6'}
    # palette = {'color_list': ['#C3C3C3', '#9A9A9A', '#576876', '#E1675C', '#D2BC72', '#E49738', '#D1A1C0', '#A7667F', '#8B3751', '#923C5E'], 'bcg': '#F2EDEE'}
    palette = filter_palette(palette)

    proportions = []
    for color in palette['color_list']:
    # if True:
        # color = palette['color_list'][-1]
        time0 = time.time()
        res = calculate_color_proportion(image_path, color)
        # print(f'{color}: {res}, cost {time.time() - time0:.2f} seconds')
        # print(res)
        # break
        proportions.append(res)
    
    
    print(proportions)
    classification = classify_and_get_palette(proportions)
    # print(classification)
    pkg_color = package_color(classification, palette)
    print(pkg_color)
    print(image_path)
    display_colors(palette)

# 0 
# {'mode': 'monochrome', 'color_list': ['#E1675C', '#D2BC72', '#E49738', '#D1A1C0', '#A7667F', '#8B3751'], 
#  'main_color': ['#8B3751'], 'bcg': '#F2EDEE', 
#  'context_colors': ['#C3C3C3', '#9A9A9A', '#576876'], 'similar_to_bcg': [], 
#  'other_colors': ['#E1675C', '#D2BC72', '#E49738', '#D1A1C0', '#A7667F']}

# 1
# {'mode': 'colorful', 'color_list': ['#FF9D63', '#549AFE', '#FFE44A', '#B984E0', '#22877C', '#F4D2BF'], 
#  'main_color': ['#FF9D63', '#549AFE', '#FFE44A', '#B984E0', '#22877C', '#F4D2BF'], 'bcg': '#E2F1F6', 
#  'context_colors': ['#3F4F62', '#C3C3C3'], 'similar_to_bcg': ['#F6F6F6'], 'other_colors': []}

# 2
# {'mode': 'dual-color', 'color_list': ['#D89B5B', '#B297C7'], 
#  'main_color': ['#D89B5B', '#B297C7'], 'bcg': '#F2EDEE', 
#  'context_colors': ['#AFAFAF', '#7C888F', '#3C505D'], 
#  'similar_to_bcg': ['#D9D9D9', '#D1D1D5', '#E0E0E0', '#F6F6F6', '#E1DFDC'], 'other_colors': []}

# 3
# {'mode': 'dual-color', 'color_list': ['#1D3951', '#0060DC', '#CB4E6C', '#F0CE71', '#21BBAC', '#ACE3E2', '#0087F5', '#96A2F5'], 
#  'main_color': ['#0087F5', '#21BBAC'], 'bcg': '#E2F1F6', 
#  'context_colors': ['#96A3AF'], 'similar_to_bcg': ['#F6F6F6'], 
#  'other_colors': ['#1D3951', '#0060DC', '#CB4E6C', '#F0CE71', '#ACE3E2', '#96A2F5']}

# 4
# {'mode': 'monochrome', 'color_list': ['#11283D', '#9E5BCE', '#C29A6D', '#B24D3D', '#D49517', '#F2A45D'], 
# 'main_color': ['#9E5BCE'], 'bcg': '#F2EDEE', 
# 'context_colors': ['#A1A1A1', '#BCC4C8', '#485C69'], 
# 'similar_to_bcg': ['#CBCBCB'], 
# 'other_colors': ['#11283D', '#C29A6D', '#B24D3D', '#D49517', '#F2A45D']}

# 5
# {'mode': 'monochrome', 'color_list': ['#744EA1'], 
#  'main_color': ['#744EA1'], 'bcg': '#E2F1F6', 
#  'context_colors': ['#8C8C8C', '#1D221F', '#AFAFAF', '#374A5C', '#0F2840'], 
#  'similar_to_bcg': ['#F6F6F6', '#EBEEF4'], 'other_colors': []}