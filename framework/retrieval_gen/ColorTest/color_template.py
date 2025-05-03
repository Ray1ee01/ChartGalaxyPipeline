import random
import colour
import numpy as np
# from ..utils.color_statics import palette_iteration, StaticPalettes
from color_statics import palette_iteration, StaticPalettes


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
    return norm255rgb(rgb)

def iterate_rgb_palette(rgb_palette):
    lch_palette = [rgb_to_hcl(*rgb) for rgb in rgb_palette]
    lch_palette = palette_iteration(lch_palette)
    rgb_palette = [norm255rgb(colour.XYZ_to_sRGB(colour.Lab_to_XYZ(colour.LCHab_to_Lab(lch)))) for lch in lch_palette]
    return rgb_palette

def emphasis_color(used_colors, palette):
    # find the color with the largest distance to used colors in the palette
    max_dist = 0
    max_color = None
    for color in palette:
        min_dist = min([ciede2000(color, used_color) for used_color in used_colors])
        if min_dist > max_dist:
            max_dist = min_dist
            max_color = color
    if max_dist < 10:
        return None
    return max_color

def check_in_palette(color, palette):
    for p in palette:
        if ciede2000(color, p) < 10:
            return True
    return False
    
text_types = ['title', 'caption']
class ColorDesign:
    def __init__(self, image_palette, mode='monochromatic', lighter='high', same_threshold=8):
        self.pool = image_palette
        self.mode = mode
        self.rgb_pool = [hex_to_rgb(color) for color in self.pool['color_list']]
        # check similar color and remove
        res = []
        for i in range(len(self.rgb_pool)):
            find = False
            for j in range(i):
                if ciede2000(self.rgb_pool[i], self.rgb_pool[j]) < same_threshold:
                    find = True
                    break
            if not find:
                res.append(self.rgb_pool[i])
        self.rgb_pool = res
        self.hex_rgb_pool = [rgb_to_hex(*rgb) for rgb in self.rgb_pool]
        print('rgb_pool', self.rgb_pool)

        black = (0, 0, 0)
        white = (255, 255, 255)
        gray1 = (75, 75, 75)
        gray2 = (150, 150, 150)
        gray3 = (200, 200, 200)
        self.rgb_pool.sort(key=lambda x: ciede2000(x, black))

        if mode == 'monochromatic':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp.sort(key=lambda x: ciede2000(x, bcg_rgb))
            # self.main_color = random.choice(rgb_cp)
            self.main_color_pool = rgb_cp
            self.main_color = rgb_cp[-1]
            self.bcg_color = bcg_rgb
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'dark'

        if mode == 'complementary':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp = [rgb for rgb in rgb_cp if ciede2000(rgb, bcg_rgb) > 10]
            lch_pool = [rgb_to_hcl(*rgb) for rgb in rgb_cp]
            # filter c < 30
            lch_valid_idx = [i for i in range(len(lch_pool)) if lch_pool[i][1] > 30]
            lch_pool = [lch_pool[i] for i in lch_valid_idx]
            rgb_cp = [rgb_cp[i] for i in lch_valid_idx]
            h_pool = [lch[2] for lch in lch_pool]
            # print('lch', lch_pool)
            # rgbs_lch = [norm255rgb(colour.XYZ_to_sRGB(colour.Lab_to_XYZ(colour.LCHab_to_Lab(lch)))) for lch in lch_pool]
            # print('rgbs', rgbs_lch)

            # for each color, find the color with hue difference closest to 180
            self.complementary_colors = []
            if len(lch_pool) > 1:    
                save_colors = []
                for i in range(len(lch_pool)):
                    h = lch_pool[i][2]
                    h_diff = [delta_h(h, h2) for h2 in h_pool]
                    min_idx = 0
                    delta_h_min = 180
                    for j in range(len(h_diff)):
                        if abs(h_diff[j] - 180) < delta_h_min:
                            delta_h_min = h_diff[j]
                            min_idx = j
                    save_colors.append((rgb_cp[i], rgb_cp[min_idx], abs(delta_h_min)))
                save_colors.sort(key=lambda x: x[2])
                self.complementary_colors = [(x[0], x[1]) for x in save_colors]
            elif len(lch_pool) == 1:
                lch1 = lch_pool[0]
                h2 = (lch1[2] + 180) % 360
                rgb2 = norm255rgb(colour.XYZ_to_sRGB(colour.Lab_to_XYZ(colour.LCHab_to_Lab([lch1[0], lch1[1], h2]))))
                self.complementary_colors = [(rgb_cp[0], rgb2)]
            else:
                specific_c = 65
                rand_h1 = random.randint(0, 360)
                rand_h2 = (rand_h1 + 180) % 360
                rgb1 = norm255rgb(colour.XYZ_to_sRGB(colour.Lab_to_XYZ(colour.LCHab_to_Lab([specific_c, 65, rand_h1]))))
                rgb2 = norm255rgb(colour.XYZ_to_sRGB(colour.Lab_to_XYZ(colour.LCHab_to_Lab([specific_c, 65, rand_h2]))))
                self.complementary_colors = [(rgb1, rgb2)]
            print('complementary', self.complementary_colors)

            self.rgb_pool = rgb_cp
            self.rgb_pool_hex = [rgb_to_hex(*rgb) for rgb in self.rgb_pool]
            
            self.bcg_color = bcg_rgb
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'dark'

        if mode == 'analogous':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp = [rgb for rgb in rgb_cp if ciede2000(rgb, bcg_rgb) > 10]
            lch_pool = [rgb_to_hcl(*rgb) for rgb in rgb_cp]
            h_pool = [lch[2] for lch in lch_pool]

            # for each color, find the color with hue difference closest 
            self.complementary_colors = []
            save_colors = []
            for i in range(len(lch_pool)):
                h = lch_pool[i][2]
                h_diff = [delta_h(h, h2) for h2 in h_pool]
                min_idx = 0
                delta_h_min = 180
                for j in range(len(h_diff)):
                    if j == i:
                        continue
                    if abs(h_diff[j]) < delta_h_min:
                        delta_h_min = h_diff[j]
                        min_idx = j
                save_colors.append((rgb_cp[i], rgb_cp[min_idx], abs(delta_h_min)))
            save_colors.sort(key=lambda x: x[2])
            self.complementary_colors = [(x[0], x[1]) for x in save_colors]
            self.rgb_pool = rgb_cp
            self.rgb_pool_hex = [rgb_to_hex(*rgb) for rgb in self.rgb_pool]
            
            self.bcg_color = bcg_rgb
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'dark'

        if mode == 'polychromatic':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp = [rgb for rgb in rgb_cp if ciede2000(rgb, bcg_rgb) > 10]
            self.rgb_pool_hex = [rgb_to_hex(*rgb) for rgb in rgb_cp]
            rgb_extend = iterate_rgb_palette(rgb_cp)
            self.rgb_pool_hex_2 = [rgb_to_hex(*rgb) for rgb in rgb_extend]
            rgb_extend2 = iterate_rgb_palette(rgb_extend)
            self.rgb_pool_hex_3 = [rgb_to_hex(*rgb) for rgb in rgb_extend2]

            self.bcg_color = bcg_rgb
            if ciede2000(self.bcg_color, black) > ciede2000(self.bcg_color, white):
                self.lightness = 'light'
            else:
                self.lightness = 'dark'

        self.basic_colors = [black, white, gray1, gray2, gray3]
        self.basic_colors_hex = [rgb_to_hex(*color) for color in self.basic_colors]
        self.light = 'high' if lighter == 'high' else 'low'

    def get_emphasis_color(self, used_colors):
        if isinstance(used_colors[0], str):
            used_colors = [hex_to_rgb(color) for color in used_colors]
        palette = self.rgb_pool
        if self.mode == 'polychromatic':
            palette = self.rgb_pool_hex_3
        used_colors.append(self.bcg_color)
        return emphasis_color(used_colors, palette)
    
    def get_reverse_color(self, color, seed = 0):
        bcg_color_hex = rgb_to_hex(*self.bcg_color)
        if color == bcg_color_hex:
            return get_color('text', seed_text = seed, reverse = True)['title'][0]
        else:
            if self.lightness == 'dark':
                if seed % 2 == 0:
                    return self.basic_colors_hex[1]
                return bcg_color_hex
            else:
                if seed % 2 == 0:
                    return self.basic_colors_hex[0]
                return bcg_color_hex

    def get_color(self, type, number = 1, group = 1,\
            seed_color = 0, seed_middle_color = 0, seed_order = 0, \
            seed_text = 0, seed_mark = 0, seed_axis = 0):
        if type == 'background':
            return [self.pool['bcg'] for _ in range(number)]

        if self.mode == 'monochromatic': 
            main_color = self.main_color
            if self.light == 'high':
                main_color = lighter_color(main_color)
            if seed_color > 0:
                if seed_color == 1:
                    if self.lightness == 'dark':
                        main_color = [255, 255, 255]
                    else:
                        main_color = [55, 55, 55]
                else:
                    choice = seed_color % len(self.main_color_pool)
                    main_color = self.main_color_pool[choice]
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
            bcg_color_hex = rgb_to_hex(*self.bcg_color)
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                gray_color = self.basic_colors_hex[4]
            else:
                other_color = self.basic_colors_hex[0]
                gray_color = self.basic_colors_hex[2]

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
        
        if self.mode == 'complementary' or self.mode == 'analogous':
            length = len(self.complementary_colors)
            seed_color = seed_color % length
            selected_color = self.complementary_colors[seed_color]
            color1 = selected_color[0]
            color2 = selected_color[1]
            # random shift
            if seed_order % 2 == 1:
                color1, color2 = color2, color1
            if self.light == 'high':
                color1 = lighter_color(color1)
                color2 = lighter_color(color2)
            
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
            middle_colors = [color for color in self.rgb_pool_hex if color != color1_hex and color != color2_hex]
            middle_color_seed = seed_middle_color % len(middle_colors)
            middle_color = middle_colors[middle_color_seed]

            other_color = None
            inside_color = None
            print(self.lightness)
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                inside_color = self.basic_colors_hex[0]
                gray_color = self.basic_colors_hex[4]
            else:
                other_color = self.basic_colors_hex[0]
                inside_color = self.basic_colors_hex[1]
                gray_color = self.basic_colors_hex[2]

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
                        'caption': [gary_color],
                        'annotation': [gary_color],
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

        if self.mode == 'polychromatic':
            other_color = None
            gray_color = None
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                gray_color = self.basic_colors_hex[4]
            else:
                other_color = self.basic_colors_hex[0]
                gray_color = self.basic_colors_hex[2]
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
                seed = seed_mark % 2
                if group == 1:
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
        # 按到背景颜色的距离降序排序
        print("bcg_color: ", self.bcg_color)
        sorted_colors = sorted(zip(palette, dists_to_bcg), key=lambda x: -x[1])
        ranked_palette = [color for color, _ in sorted_colors]
        return ranked_palette

if __name__ == "__main__":
    palette = {
        'color_list': ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'],
        'bcg': '#000000'
    }
    design = ColorDesign(palette, mode='complementary')
    print(design.get_color('background', 5))
    print(design.get_color('text', 5))
    print(design.get_color('marks', 5))
    print(design.get_color('axis', 5))
    print(design.get_color('embellishment', 5))
