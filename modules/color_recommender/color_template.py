import random
import colour
import numpy as np
from color_static import palette_iteration, StaticPalettes

static_palettes = StaticPalettes()

def rgb_to_hex(r, g, b):
    r = max(0, min(int(r), 255))
    g = max(0, min(int(g), 255))  
    b = max(0, min(int(b), 255))
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

def hex_to_rgb(hex):
    hex = hex.lstrip('#')
    return tuple(int(hex[i:i+2], 16) for i in (0, 2, 4))

def random_rgb():
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    return (r, g, b)

def random_hex():
    r, g, b = random_rgb()
    return rgb_to_hex(r, g, b)

def ciede2000(rgb1, rgb2):
    # 转换RGB为Lab
    rgb1_arr = np.array(rgb1) / 255.0
    rgb2_arr = np.array(rgb2) / 255.0
    
    lab1 = colour.XYZ_to_Lab(colour.sRGB_to_XYZ(rgb1_arr))
    lab2 = colour.XYZ_to_Lab(colour.sRGB_to_XYZ(rgb2_arr))
    
    # 计算CIEDE2000色差
    delta_E = colour.delta_E(lab1, lab2, method='CIE 2000')
    return delta_E

def rgb_to_hcl(r, g, b):
    """
    LCh (L: 0-100, C: 0-100+, h: 0-360)
    """
    rgb = np.array([r, g, b]) / 255.0
    xyz = colour.sRGB_to_XYZ(rgb)
    lab = colour.XYZ_to_Lab(xyz)
    lch = colour.Lab_to_LCHab(lab)
    return lch

def norm255rgb(rgb):
    return [int(max(min(x*255, 255),0)) for x in rgb]

def extend_color_in_l(rgb, number=5):
    lch = rgb_to_hcl(*rgb)
    res = []
    # for l in range(45, 95, 10):
    h = lch[2]
    start_l = 45 if h < 85 and h > 114 else 75
    end_l = 95
    delta = (end_l - start_l) / number
    for i in range(number):
        l = start_l + i * delta
        lch[0] = l
        lab = colour.LCHab_to_Lab(lch)
        xyz = colour.Lab_to_XYZ(lab)
        rgb = colour.XYZ_to_sRGB(xyz)
        res.append(norm255rgb(rgb))
    res = [rgb_to_hex(*rgb) for rgb in res]
    return res

def extend_color_in_c(rgb, number=5):
    lch = rgb_to_hcl(*rgb)
    res = []
    delta = (85 - 35) / number
    for i in range(number):
        c = 35 + i * delta
        lch[1] = c
        lab = colour.LCHab_to_Lab(lch)
        xyz = colour.Lab_to_XYZ(lab)
        rgb = colour.XYZ_to_sRGB(xyz)
        res.append(norm255rgb(rgb))
    res = [rgb_to_hex(*rgb) for rgb in res]
    return res

def delta_h(h1, h2):
    dh = (h1-h2) % 360
    if dh < 0:
        dh += 360
    if dh > 180:
        dh = 360 - dh
    return dh

def lighter_color(rgb):
    lch = rgb_to_hcl(*rgb)
    if lch[0] < 80:
        lch[0] += 15
    if lch[1] < 70:
        lch[1] += 10
    lab = colour.LCHab_to_Lab(lch)
    xyz = colour.Lab_to_XYZ(lab)
    rgb = colour.XYZ_to_sRGB(xyz)
    rgb = norm255rgb(rgb)
    return rgb

def iterate_rgb_palette(rgb_palette):
    lch_palette = [rgb_to_hcl(*rgb) for rgb in rgb_palette]
    lch_palette = palette_iteration(lch_palette)
    rgb_palette = [norm255rgb(colour.XYZ_to_sRGB(colour.Lab_to_XYZ(colour.LCHab_to_Lab(lch)))) for lch in lch_palette]
    return rgb_palette

def emphasis_color(used_colors, palette):
    # find the color with the largest distance to used colors in the palette
    max_dist = 0
    res = []
    for color in palette:
        min_dist = min([ciede2000(color, used_color) for used_color in used_colors])
        if min_dist > 10:
            res.append(rgb_to_hex(*color))
    return res

def check_in_palette(color, palette):
    for p in palette:
        if ciede2000(color, p) < 10:
            return True
    return False
    
text_types = ['title', 'caption']
class ColorDesign:
    def __init__(self, image_palette, lighter='high', seed_order = 0):
        self.pool = image_palette
        mode = image_palette['mode']
        self.mode = mode
        self.rgb_pool = [hex_to_rgb(color) for color in self.pool['main_color']]
        if lighter == 'high':
            self.rgb_pool_cp = [lighter_color(rgb) for rgb in self.rgb_pool]
            self.rgb_pool = self.rgb_pool_cp
        seed_order = seed_order % len(self.rgb_pool)
        self.rgb_pool = self.rgb_pool[seed_order:] + self.rgb_pool[:seed_order]
        self.rgb_pool_hex = [rgb_to_hex(*rgb) for rgb in self.rgb_pool]
        self.main_color_hex = self.rgb_pool_hex
        self.middle_color = None

        black = (0, 0, 0)
        white = (255, 255, 255)
        gray1 = (75, 75, 75)
        gray2 = (150, 150, 150)
        gray3 = (200, 200, 200)
        self.rgb_pool.sort(key=lambda x: ciede2000(x, black))

        bcg = image_palette['bcg']
        bcg_rgb = hex_to_rgb(bcg)
        self.main_color = self.rgb_pool
        self.bcg_color = bcg_rgb
        dist_color_2_black = ciede2000(self.bcg_color, black)
        dist_color_2_white = ciede2000(self.bcg_color, white)
        if dist_color_2_black > dist_color_2_white:
            self.lightness = 'light'
        else:
            self.lightness = 'dark'

        if mode == 'colorful':
            iter_rgb2 = iterate_rgb_palette(self.rgb_pool)
            iter_rgb3 = iterate_rgb_palette(iter_rgb2)
            self.rgb_pool_hex_2 = [rgb_to_hex(*rgb) for rgb in iter_rgb2]
            self.rgb_pool_hex_3 = [rgb_to_hex(*rgb) for rgb in iter_rgb3]

        self.basic_colors = [black, white, gray1, gray2, gray3]
        self.basic_colors_hex = [rgb_to_hex(*color) for color in self.basic_colors]
        

    def get_emphasis_colors(self, used_colors):
        if isinstance(used_colors[0], str):
            used_colors = [hex_to_rgb(color) for color in used_colors]
        hex_pool = self.pool['other_colors'] + self.pool['main_color']
        if self.mode == 'colorful':
            hex_pool += self.rgb_pool_hex_2 + self.rgb_pool_hex_3
        palette = [hex_to_rgb(color) for color in hex_pool]
        used_colors.append(self.bcg_color)
        return emphasis_color(used_colors, palette)
    
    def get_reverse_color(self, color, seed = 0):
        bcg_color_hex = rgb_to_hex(*self.bcg_color)
        if color == bcg_color_hex:
            return self.get_color('text', seed_text = seed, reverse = True)['title'][0]
        else:
            if self.lightness == 'dark':
                if seed % 2 == 0:
                    return self.basic_colors_hex[1]
                return bcg_color_hex
            else:
                if seed % 2 == 0:
                    return self.basic_colors_hex[0]
                return bcg_color_hex

    def get_color(self, type, number = 1, group = 1, \
                  seed_color = 0, seed_context_color = 0, seed_middle_color = 0, \
                  seed_text = 0, seed_mark = 0, seed_axis = 0):
        if type == 'background':
            return [self.pool['bcg']]

        if self.mode == 'monochrome': 
            main_color = self.main_color[0]
            if group == 1:
                if number < 6:
                    extend_colors1 = extend_color_in_l(main_color)
                    extend_colors2 = extend_color_in_c(main_color)
                else:
                    extend_colors1 = extend_color_in_l(main_color, number)
                    extend_colors2 = extend_color_in_c(main_color, number)
            else:
                if group < 6:
                    extend_colors1 = extend_color_in_l(main_color)
                    extend_colors2 = extend_color_in_c(main_color)
                else:
                    extend_colors1 = extend_color_in_l(main_color, group)
                    extend_colors2 = extend_color_in_c(main_color, group)

            main_color_hex = rgb_to_hex(*main_color)
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                gray_color = self.basic_colors_hex[4]
            else:
                other_color = self.basic_colors_hex[0]
                gray_color = self.basic_colors_hex[2]
            if seed_context_color > 0 and len(self.pool['context_color']) > 0:
                choice = seed_context_color % len(self.pool['context_color'])
                gray_color = self.pool['context_color'][choice]

            if type == 'text':
                seed = seed_text % 4
                if seed == 0: # all same color
                    return {
                        'title': [main_color_hex],
                        'caption': [main_color_hex],
                        'annotation': [main_color_hex],
                    }
                if seed == 1: # all black/white
                    return {
                        'title': [other_color],
                        'caption': [other_color],
                        'annotation': [other_color],
                    }
                if seed == 2: # extend in lightness
                    if self.lightness == 'dark':
                        res = extend_colors1[-3:]
                    else:
                        res = extend_colors1[:3]
                    return {
                        'title': res[:1],
                        'caption': res[1:2],
                        'annotation': res[2:3],
                    }
                if seed == 3: # main color + other black/white
                    return {
                        'title': [main_color_hex],
                        'caption': [other_color],
                        'annotation': [other_color],
                    }
                    
            if type == 'marks':
                if group == 1:
                    seed = seed_mark % 6
                    if seed == 0:
                        return {
                            'group1': [main_color_hex for _ in range(number)],
                        }
                    if seed == 1:
                        return {
                            'group1': extend_colors1[:number],
                        }
                    if seed == 2:
                        return {
                            'group1': extend_colors1[-number:],
                        }
                    if seed == 3:
                        return {
                            'group1': extend_colors2[:number],
                        }   
                    if seed == 4:
                        return {
                            'group1': extend_colors2[-number:],
                        }
                    if seed == 5:
                        return {
                            'group1': [gray_color for _ in range(number)],
                        }
                else:
                    seed = seed_mark % 4
                    group_colors = []
                    if seed == 0:
                        group_colors = extend_colors1[:group]
                    if seed == 1:
                        group_colors = extend_colors1[-group:]
                    if seed == 2:
                        group_colors = extend_colors2[:group]
                    if seed == 3:
                        group_colors = extend_colors2[-group:]
                    res = {}
                    for i in range(group):
                        res[f'group{i+1}'] = group_colors
                    return res
                
            if type == 'axis':
                seed = seed_axis % 5
                if seed == 0:
                    return {
                        'axis': [extend_colors1[0]]
                    }
                if seed == 1:
                    return {
                        'axis': [extend_colors2[0]]
                    }
                if seed == 3: # gray
                    return {
                        'axis': [gray_color]
                    }
                if seed == 4: # main color
                    return {
                        'axis': [main_color_hex]
                    }
                return {
                    'axis': [other_color]
                }
        
        if self.mode == 'dual-color':
            selected_color = self.main_color
            color1 = selected_color[0]
            color2 = selected_color[1]
            
            if number < 6:
                extend_colors1_l = extend_color_in_l(color1)
                extend_colors2_l = extend_color_in_l(color2)
                extend_colors1_c = extend_color_in_c(color1)
                extend_colors2_c = extend_color_in_c(color2)
            else:
                extend_colors1_l = extend_color_in_l(color1, number)
                extend_colors2_l = extend_color_in_l(color2, number)
                extend_colors1_c = extend_color_in_c(color1, number)
                extend_colors2_c = extend_color_in_c(color2, number)

            color1_hex = rgb_to_hex(*color1)
            color2_hex = rgb_to_hex(*color2)
            main_color1_hex = color1_hex
            main_color2_hex = color2_hex

            middle_colors = [color for color in self.pool['other_colors']]
            # print("middle_colors: ", middle_colors)
            if len(middle_colors) == 0:
                middle_colors = ["#ababab"]
            middle_color_seed = seed_middle_color % len(middle_colors)
            middle_color = middle_colors[middle_color_seed]

            other_color = None
            gray_color = None
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                gray_color = self.basic_colors_hex[4]
            else:
                other_color = self.basic_colors_hex[0]
                gray_color = self.basic_colors_hex[2]
            if seed_context_color > 0 and len(self.pool['context_color']) > 0:
                choice = seed_context_color % len(self.pool['context_color'])
                gray_color = self.pool['context_color'][choice]

            if type == 'text':
                seed = seed_text % 14
                if seed == 0:
                    return {
                        'title': [other_color],
                        'caption': [other_color],
                        'annotation': [other_color],
                    }
                if seed == 1:
                    return {
                        'title': [other_color],
                        'caption': [gray_color],
                        'annotation': [gray_color],
                    }
                if seed == 2:
                    return {
                        'title': [main_color1_hex],
                        'caption': [other_color],
                        'annotation': [other_color],
                    }
                if seed == 3:
                    return {
                        'title': [main_color2_hex],
                        'caption': [other_color],
                        'annotation': [other_color],
                    }
                if seed == 4:
                    return {
                        'title': [main_color1_hex],
                        'caption': [main_color1_hex, main_color2_hex],
                        'annotation': [other_color],
                    }
                if seed == 5:
                    return {
                        'title': [main_color2_hex],
                        'caption': [main_color1_hex, main_color2_hex],
                        'annotation': [other_color],
                    }
                if seed == 6:
                    return {
                        'title': [other_color],
                        'caption': [main_color1_hex, main_color2_hex],
                        'annotation': [other_color],
                    }
                if seed == 7:
                    return {
                        'title': [main_color1_hex],
                        'caption': [main_color1_hex, main_color2_hex],
                        'annotation': [gray_color],
                    }
                if seed == 8:
                    return {
                        'title': [main_color2_hex],
                        'caption': [main_color1_hex, main_color2_hex],
                        'annotation': [gray_color],
                    }
                if seed == 9:
                    return {
                        'title': [other_color],
                        'caption': [main_color1_hex, main_color2_hex],
                        'annotation': [gray_color],
                    }
                if seed == 10:
                    return {
                        'title': [main_color1_hex],
                        'caption': [other_color, main_color1_hex, main_color2_hex],
                        'annotation': [gray_color],
                    }
                if seed == 11:
                    return {
                        'title': [main_color2_hex],
                        'caption': [other_color, main_color1_hex, main_color2_hex],
                        'annotation': [gray_color],
                    }
                if seed == 12:
                    return {
                        'title': [other_color],
                        'caption': [other_color, main_color1_hex, main_color2_hex],
                        'annotation': [gray_color],
                    }
                if seed == 13:
                    return {
                        'title': [main_color1_hex, main_color2_hex, middle_color],
                        'caption': [other_color],
                        'annotation': [gray_color],
                    }

            if type == 'marks':
                if group == 1 and number == 2:
                    return {
                        'group1': [main_color1_hex, main_color2_hex],
                    }
                if group == 1:
                    seed = seed_mark % 4
                    if seed == 0:
                        return {
                            'group1': [other_color],
                        }
                    if seed == 1:
                        return {
                            'group1': [main_color1_hex],
                        }
                    if seed == 2:
                        return {
                            'group1': [main_color2_hex],
                        }
                    if seed == 3:
                        return {
                            'group1': [gray_color],
                        }
                else:
                    assert group == 2
                    seed = seed_mark % 5
                    if seed == 0:
                        return {
                            'group1': [main_color1_hex],
                            'group2': [main_color2_hex],
                        }
                    if seed == 1:
                        return {
                            'group1': extend_colors1_l[:number],
                            'group2': extend_colors2_l[:number],
                        }
                    if seed == 2:
                        return {
                            'group1': extend_colors1_l[-number:],
                            'group2': extend_colors2_l[-number:],
                        }
                    if seed == 3:
                        return {
                            'group1': extend_colors1_c[:number],
                            'group2': extend_colors2_c[:number],
                        }
                    if seed == 4:
                        return {
                            'group1': extend_colors1_c[-number:],
                            'group2': extend_colors2_c[-number:],
                        }

            if type == 'axis':
                axis_seed = seed_axis % 5
                if axis_seed == 0:
                    return {
                        'axis': [other_color],
                    }
                if axis_seed == 1:
                    return {
                        'axis': [gray_color],
                    }
                if axis_seed == 2:
                    return {
                        'axis': [extend_colors1_l[0]],
                    }
                if axis_seed == 3:
                    return {
                        'axis': [extend_colors2_l[0]],
                    }
                if axis_seed == 4:
                    return {
                        'axis': [middle_color],
                    }

        if self.mode == 'colorful':
            other_color = None
            gray_color = None
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                gray_color = self.basic_colors_hex[4]
            else:
                other_color = self.basic_colors_hex[0]
                gray_color = self.basic_colors_hex[2]
            if seed_context_color > 0 and len(self.pool['context_color']) > 0:
                choice = seed_context_color % len(self.pool['context_color'])
                gray_color = self.pool['context_color'][choice]
            
            if type == 'text':
                seed = seed_text % 2
                if seed == 0:
                    return {
                        'title': [other_color],
                        'caption': [other_color],
                        'annotation': [other_color],
                    }
                if self.middle_color is None:
                    rand_color = random.choice(self.rgb_pool_hex)
                    extend_colors = extend_color_in_l(hex_to_rgb(rand_color))
                    dark_rand_color = extend_colors[0] if self.lightness == 'dark' else extend_colors[-1]
                    self.middle_color = {
                        'color': rand_color,
                        'dark': dark_rand_color,
                    }
                return {
                    'title': [self.middle_color['dark']],
                    'caption': [self.middle_color['dark']],
                    'annotation': [self.middle_color['dark']]
                }
            if type == 'marks':
                seed = seed_mark % 2 + 1
                if group == 1:
                    clist = []
                    if len(self.rgb_pool_hex) >= number:
                        if seed == 1:
                            clist = self.rgb_pool_hex[:number]
                        if seed == 2:
                            clist = self.rgb_pool_hex[-number:]
                    elif len(self.rgb_pool_hex_2) >= number:
                        if seed == 1:
                            clist = self.rgb_pool_hex_2[:number]
                        if seed == 2:
                            clist = self.rgb_pool_hex_2[-number:]
                    elif len(self.rgb_pool_hex_3) >= number:
                        if seed == 1:
                            clist = self.rgb_pool_hex_3[:number]
                        if seed == 2:
                            clist = self.rgb_pool_hex_3[-number:]
                    else:
                        clist = static_palettes.get_colors(number)
                    return {
                        'group1': clist,
                    }
                else:
                    base_colors = []
                    if len(self.rgb_pool_hex) >= group:
                        if seed == 1:
                            base_colors = self.rgb_pool_hex[:group]
                        if seed == 2:
                            base_colors = self.rgb_pool_hex[-group:]
                    elif len(self.rgb_pool_hex_2) >= group:
                        if seed == 1:
                            base_colors = self.rgb_pool_hex_2[:group]
                        if seed == 2:
                            base_colors = self.rgb_pool_hex_2[-group:]
                    elif len(self.rgb_pool_hex_3) >= group:
                        if seed == 1:
                            base_colors = self.rgb_pool_hex_3[:group]
                        if seed == 2:
                            base_colors = self.rgb_pool_hex_3[-group:]
                    else:
                        base_colors = static_palettes.get_colors(group)
                    if seed_color % 2 == 0:
                        res = {}
                        for i in range(group):
                            res[f'group{i+1}'] = [base_colors[i] for _ in range(number)]
                    else:
                        res = {}
                        for i in range(group):
                            res[f'group{i+1}'] = extend_color_in_l(hex_to_rgb(base_colors[i]), number)
                    return res

            if type == 'axis':
                seed = seed_axis % 3
                if seed == 0:
                    return {
                        'axis': [gray_color],
                    }
                if seed == 1:
                    return {
                        'axis': [other_color],
                    }
                return {
                    'axis': [random.choice(self.rgb_pool_hex)]
                }

    def rank_color(self, palette, importance):
        assert len(palette) == len(importance)
        dists_to_bcg = [ciede2000(hex_to_rgb(color), self.bcg_color) for color in palette]
        # sort by importance, high importance with high dist to bcg
        # low importance with low dist to bcg
        dist_sorted_indices = sorted(range(len(dists_to_bcg)), key=lambda i: dists_to_bcg[i], reverse=True)
        imp_sorted_indices = sorted(range(len(importance)), key=lambda i: importance[i], reverse=True)

        ranked_palette = [None] * len(palette)

        for rank, color_idx in enumerate(dist_sorted_indices):
            ranked_palette[imp_sorted_indices[rank]] = palette[color_idx]

        return ranked_palette

    def rank_color_by_contrast(self, palette):
        dists_to_bcg = [ciede2000(hex_to_rgb(color), self.bcg_color) for color in palette]
        print("bcg_color: ", self.bcg_color)
        sorted_colors = sorted(zip(palette, dists_to_bcg), key=lambda x: -x[1])
        ranked_palette = [color for color, _ in sorted_colors]
        return ranked_palette
