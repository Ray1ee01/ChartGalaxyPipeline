
import os, json, time, tqdm, pickle
from image2palette.palette import nets_init, generate_color_open
# from multiprocessing import freeze_support
import matplotlib.pyplot as plt
import matplotlib.patches as patches
# from multiprocessing import freeze_support
import numpy as np
from PIL import Image
from typing import Dict, List, Tuple
import colour

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

    bcg_lab = srgb_to_lab(hex_to_rgb(palette['bcg']))
    color_labs = [(c, srgb_to_lab(hex_to_rgb(c))) for c in palette['color_list']]

    filtered_by_bcg = []
    for c_hex, c_lab in color_labs:
        if delta_e_cie2000(c_lab, bcg_lab) > delta_e_bcg_threshold:
            filtered_by_bcg.append((c_hex, c_lab))

    filtered_by_bcg_and_self = []
    for c_hex, c_lab in filtered_by_bcg:
        too_close = False
        for kept_hex, kept_lab in filtered_by_bcg_and_self:
            if delta_e_cie2000(c_lab, kept_lab) < delta_e_between_threshold:
                too_close = True
                break
        if not too_close:
            filtered_by_bcg_and_self.append((c_hex, c_lab))

    final_filtered = []
    for c_hex, c_lab in filtered_by_bcg_and_self:
        lch = lab_to_lch(c_lab)  # L, C, H
        if lch[1] >= grey_chroma_threshold:
            final_filtered.append(c_hex)

    return {
        'color_list': final_filtered,
        'bcg': palette['bcg']
    }

if __name__ == '__main__':
    # freeze_support()  # Windows系统需要

    # 1. read image path info
    root = '../data/realworld_test/'
    file_type = ['png', 'jpg', 'jpeg', 'webp']
    image_path = [f for f in os.listdir(root) if f.endswith(tuple(file_type))]

    # 2. init palette generator
    init = False
    Sal, Sp = None, None
    def get_palette(number, bcg_flag, image_path):
        global init, Sal, Sp
        if not init:
            Sal, Sp = nets_init()
            init = True
        return generate_color_open(number, bcg_flag, image_path, Sal, Sp)

    # 3. load image and generate palette
    # img_path = 'D:/projects/ColorPalette/check_202501022351/not_infographic/metaphor/873628027729884274.jpg'
    # print(get_palette(7, True, img_path))
    # exit()

    palettes = {}
    total_start_time = time.time()
    for key in tqdm.tqdm(image_path):
        start_time = time.time()
        img_path = root + '/' + key
        name = key.split('.')[0]
        # print(f'processing {key} {img_path}...')
        res = None
        try:
            res = get_palette(10, True, img_path)
        except Exception as e:
            print(f'Error: {key} {img_path} {e}')
            res = None
            continue
        if res:
            res = filter_palette(res)
        palettes[key] = res
        print(f'{key} finished, cost {time.time() - start_time:.2f} seconds')
    print(f'total cost {time.time() - total_start_time:.2f} seconds')

    # 4. save palette
    target_root = './'
    palette_path = os.path.join(target_root, 'palette.json')
    with open(palette_path, 'w') as f:
        json.dump(palettes, f)
