import random
import colour
import numpy as np
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

def extend_color_in_l(rgb):
    lch = rgb_to_hcl(*rgb)
    res = []
    for l in range(45, 95, 10):
        lch[0] = l
        lab = colour.LCHab_to_Lab(lch)
        xyz = colour.Lab_to_XYZ(lab)
        rgb = colour.XYZ_to_sRGB(xyz)
        res.append(norm255rgb(rgb))
    res = [rgb_to_hex(*rgb) for rgb in res]
    return res

def extend_color_in_c(rgb):
    lch = rgb_to_hcl(*rgb)
    res = []
    for c in range(35, 85, 10):
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
    if lch[0] < 70:
        lch[0] += 10
    if lch[1] < 60:
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
    def __init__(self, image_palette, mode='monochromatic'):
        self.pool = image_palette
        self.mode = mode
        self.rgb_pool = [hex_to_rgb(color) for color in self.pool['color_list']]
        black = (0, 0, 0)
        white = (255, 255, 255)
        gray = (128, 128, 128)
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
                self.lightness = 'black'

        if mode == 'complementary':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp = [rgb for rgb in rgb_cp if ciede2000(rgb, bcg_rgb) > 10]
            lch_pool = [rgb_to_hcl(*rgb) for rgb in rgb_cp]
            h_pool = [lch[2] for lch in lch_pool]

            # for each color, find the color with hue difference closest to 180
            self.complementary_colors = []
            for i in range(len(lch_pool)):
                h = lch_pool[i][2]
                h_diff = [delta_h(h, h2) for h2 in h_pool]
                min_idx = 0
                delta_h_min = 180
                for j in range(len(h_diff)):
                    if abs(h_diff[j] - 180) < delta_h_min:
                        delta_h_min = h_diff[j]
                        min_idx = j
                self.complementary_colors.append([rgb_cp[i], rgb_cp[min_idx]])
            self.rgb_pool = rgb_cp
            self.rgb_pool_hex = [rgb_to_hex(*rgb) for rgb in self.rgb_pool]
            
            self.bcg_color = bcg_rgb
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'black'

        if mode == 'analogous':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp = [rgb for rgb in rgb_cp if ciede2000(rgb, bcg_rgb) > 10]
            lch_pool = [rgb_to_hcl(*rgb) for rgb in rgb_cp]
            h_pool = [lch[2] for lch in lch_pool]

            # for each color, find the color with hue difference closest 
            self.complementary_colors = []
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
                self.complementary_colors.append([rgb_cp[i], rgb_cp[min_idx]])
            self.rgb_pool = rgb_cp
            self.rgb_pool_hex = [rgb_to_hex(*rgb) for rgb in self.rgb_pool]
            
            self.bcg_color = bcg_rgb
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'black'

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

        self.basic_colors = [black, white, gray]
        self.basic_colors_hex = [rgb_to_hex(*color) for color in self.basic_colors]
        self.light = 'high' if random.randint(0, 1) == 0 else 'low'

    def get_emphasis_color(self, used_colors):
        if isinstance(used_colors[0], str):
            used_colors = [hex_to_rgb(color) for color in used_colors]
        palette = self.rgb_pool
        if self.mode == 'polychromatic':
            palette = self.rgb_pool_hex_3
        used_colors.append(self.bcg_color)
        return emphasis_color(used_colors, palette)

    def get_color(self, type, number, group = 1, seed_color = 0, seed_middle_color = 0, \
            seed_text = 0, seed_mark = 0, seed_axis = 0, seed_embellishment = 0, reverse = False):
        if type == 'background':
            return [self.pool['bcg'] for _ in range(number)]

        if self.mode == 'monochromatic': 
            main_color = self.main_color
            if seed_color > 0:
                length_color = len(self.main_color_pool)
                seed_color = seed_color % length_color
                main_color = self.main_color_pool[seed_color]
            if self.light == 'high':
                main_color = lighter_color(main_color)
            extend_colors1 = extend_color_in_l(main_color)
            extend_colors2 = extend_color_in_c(main_color)
            main_color_hex = rgb_to_hex(*main_color)
            bcg_color_hex = rgb_to_hex(*self.bcg_color)

            if type == 'text':
                seed = -1 - seed_text % 2 if reverse else seed_text % 5
                if seed == 0: # all same color
                    return [main_color_hex for _ in range(number)]
                if seed == 1: # all black/white
                    if self.lightness == 'dark':
                        return [self.basic_colors_hex[1] for _ in range(number)]
                    return [self.basic_colors_hex[0] for _ in range(number)]
                if seed == 2: # extend in lightness
                    res = extend_colors1[:number]
                    if len(res) < number:
                        res += [extend_colors1[-1] for _ in range(number - len(res))]
                    return res
                if seed == 3: # extend in chroma
                    res = extend_colors2[:number]
                    if len(res) < number:
                        res += [extend_colors2[-1] for _ in range(number - len(res))]
                    return res
                if seed == 4: # main color + other black/white
                    res = [main_color_hex]
                    other_color = None
                    if self.lightness == 'dark':
                        other_color = self.basic_colors_hex[1]
                    else:
                        other_color = self.basic_colors_hex[0]
                    for i in range(1, number):
                        res.append(other_color)
                    return res
                if seed == -1: # reverse black/white
                    if self.lightness == 'dark':
                        return [self.basic_colors[0] for _ in range(number)]
                    return [self.basic_colors[1] for _ in range(number)]
                if seed == -2: # reverse bcg color
                    return [bcg_color_hex for _ in range(number)]
                    
            if type == 'marks':
                print("extend_colors1: ", extend_colors1)
                print("extend_colors2: ", extend_colors2)
                seed = seed_mark % 6
                # use extend color in l or c
                if seed == 1 and len(extend_colors1) >= number:
                    return extend_colors1[:number]
                if seed == 2 and len(extend_colors1) >= number:
                    return extend_colors1[-number:]
                if seed == 3 and len(extend_colors2) >= number:
                    return extend_colors2[:number]
                if seed == 4 and len(extend_colors2) >= number:
                    return extend_colors2[-number:]
                # use gray color as marks
                if seed == 5:
                    return [self.basic_colors_hex[2] for _ in range(number)]
                # use main color as marks
                return [main_color_hex for _ in range(number)]
                
            if type == 'axis':
                seed = seed_axis % 5
                if seed == 1: # darkest color of c
                    return [extend_colors1[0] for _ in range(number)]
                if seed == 2: # darkest color of l
                    return [extend_colors2[0] for _ in range(number)]
                if seed == 3: # gray
                    return [self.basic_colors_hex[2] for _ in range(number)]
                if seed == 4: # main color
                    return [main_color_hex for _ in range(number)]
                if self.lightness == 'dark': # black or white
                    return [self.basic_colors_hex[1] for _ in range(number)]
                return [self.basic_colors_hex[0] for _ in range(number)]

            if type == 'embellishment':
                seed = seed_embellishment % 3
                if seed == 1:
                    res = []
                    for i in range(number):
                        res.append(random.choice(extend_colors1))
                    return res
                if seed == 2:
                    res = []
                    for i in range(number):
                        res.append(random.choice(extend_colors2))
                    return res
                return [main_color_hex for _ in range(number)]
        
        if self.mode == 'complementary' or self.mode == 'analogous':
            length = len(self.complementary_colors)
            seed_color = seed_color % length
            selected_color = self.complementary_colors[seed_color]
            color1 = selected_color[0]
            color2 = selected_color[1]
            if self.light == 'high':
                color1 = lighter_color(color1)
                color2 = lighter_color(color2)
            extend_colors1_l = extend_color_in_l(color1)
            extend_colors2_l = extend_color_in_l(color2)
            extend_colors1_c = extend_color_in_c(color1)
            extend_colors2_c = extend_color_in_c(color2)
            if self.lightness == 'dark':
                main_color1_hex = extend_colors1_l[-1]
                main_color2_hex = extend_colors2_l[-1]
            else:
                main_color1_hex = extend_colors1_l[0]
                main_color2_hex = extend_colors2_l[0]
            
            color1_hex = rgb_to_hex(*color1)
            color2_hex = rgb_to_hex(*color2)
            middle_colors = [color for color in self.rgb_pool_hex if color != color1_hex and color != color2_hex]
            middle_color_seed = seed_middle_color % len(middle_colors)
            middle_color = middle_colors[middle_color_seed]
            other_color = None
            inside_color = None
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                inside_color = self.basic_colors_hex[0]
            else:
                other_color = self.basic_colors_hex[0]
                inside_color = self.basic_colors_hex[1]

            if type == 'text':
                type_num = 4
                if number > 2:
                    type_num = 10
                if number > 3:
                    type_num = 12
                if number > 4:
                    type_num = 13
                text_seed = (seed_text % type_num) + 1 if not reverse else -1 - seed_text % 2
                if text_seed == 1: # all black/white
                    return [other_color for _ in range(number)]
                if text_seed == 2: # title black/white，others gray
                    res = [other_color]
                    for i in range(1, number):
                        res.append(self.basic_colors_hex[2])
                    return res
                if text_seed == 3: # title color1, others black/white
                    res = [main_color1_hex]
                    for i in range(1, number):
                        res.append(other_color)
                    return res
                if text_seed == 4: # title color2, others black/white
                    res = [main_color2_hex]
                    for i in range(1, number):
                        res.append(other_color)
                    return res
                if text_seed == 5 and number > 2: # title color1, caption/annotation color1 and color2, other black/white
                    res = [main_color1_hex, main_color1_hex, main_color2_hex]
                    for i in range(3, number):
                        res.append(other_color)
                    return res
                if text_seed == 6 and number > 2: # title color2, caption/annotation color1 and color2, other black/white
                    res = [main_color2_hex, main_color1_hex, main_color2_hex]
                    for i in range(3, number):
                        res.append(other_color)
                    return res
                if text_seed == 7 and number > 2: # title color1, caption/annotation color1 and color2, other gray
                    res = [main_color1_hex, main_color1_hex, main_color2_hex]
                    for i in range(3, number):
                        res.append(self.basic_colors_hex[2])
                    return res
                if text_seed == 8 and number > 2: # title color2, caption/annotation color1 and color2, other gray
                    res = [main_color2_hex, main_color1_hex, main_color2_hex]
                    for i in range(3, number):
                        res.append(self.basic_colors_hex[2])
                    return res
                if text_seed == 9 and number > 2: # title (color1, black/white, color2), black/white
                    res = [main_color1_hex, other_color, main_color2_hex]
                    for i in range(3, number):
                        res.append(other_color)
                    return res
                if text_seed == 10 and number > 2: # title (color1, black/white, color2), gary
                    res = [main_color1_hex, other_color, main_color2_hex]
                    for i in range(3, number):
                        res.append(self.basic_colors_hex[2])
                    return res
                if text_seed == 11 and number > 3: # title (color1, black/white, color2, middle_color), black/white
                    res = [main_color1_hex, other_color, main_color2_hex, middle_color]
                    for i in range(4, number):
                        res.append(other_color)
                    return res
                if text_seed == 12 and number > 3: # title (color1, black/white, color2, middle_color), gray
                    res = [main_color1_hex, other_color, main_color2_hex, middle_color]
                    for i in range(4, number):
                        res.append(self.basic_colors_hex[2])
                    return res
                if text_seed == 13 and number > 4: # title (color1, black/white, color2, middle_color), color1, color2, gray
                    res = [main_color1_hex, other_color, main_color2_hex, middle_color, main_color1_hex, main_color2_hex]
                    for i in range(6, number):
                        res.append(self.basic_colors_hex[2])
                    return res
                if text_seed == -1:
                    return [inside_color for _ in range(number)]
                if text_seed == -2:
                    return [middle_color for _ in range(number)]
                return [other_color for _ in range(number)]

            if type == 'marks':
                type_num = 2
                if number > 2:
                    type_num = 6
                mark_seed = (seed_mark % type_num) + 1
                if mark_seed == 1:
                    return [self.basic_colors_hex[2] for _ in range(number)]
                if mark_seed == 2 and number == 2:
                    res = [main_color1_hex, main_color2_hex]
                    return res
                if mark_seed == 3 and number % 2 == 0 and number / 2 <= len(extend_colors1_l):
                    target = number // 2
                    res = extend_colors1_l[:target] + extend_colors2_l[:target]
                    return res
                if mark_seed == 4 and number % 2 == 0 and number / 2 <= len(extend_colors1_c):
                    target = number // 2
                    res = extend_colors1_c[:target] + extend_colors2_c[:target]
                    return res
                if mark_seed == 5 and number % 2 == 0 and number / 2 <= len(extend_colors1_l):
                    target = number // 2
                    res = extend_colors1_l[-target:] + extend_colors2_l[-target:]
                    return res
                if mark_seed == 6 and number % 2 == 0 and number / 2 <= len(extend_colors1_c):
                    target = number // 2
                    res = extend_colors1_c[-target:] + extend_colors2_c[-target:]
                    return res
                return [self.basic_colors_hex[2] for _ in range(number)]

            if type == 'axis':
                axis_seed = seed_axis % 3
                if axis_seed == 1: # other color
                    return [other_color for _ in range(number)]
                if axis_seed == 2: # middle color
                    return [middle_color for _ in range(number)]
                return [self.basic_colors_hex[2] for _ in range(number)]

            if type == 'embellishment':
                res = [main_color1_hex, main_color2_hex, middle_color]
                return res

        if self.mode == 'polychromatic':
            other_color = None
            inside_color = None
            if self.lightness == 'dark':
                other_color = self.basic_colors_hex[1]
                inside_color = self.basic_colors_hex[0]
            else:
                other_color = self.basic_colors_hex[0]
                inside_color = self.basic_colors_hex[1]
            if type == 'text':
                if reverse:
                    return [inside_color for _ in range(number)]
                return [other_color for _ in range(number)]
            if type == 'marks':
                seed = seed_mark % 4
                print("rgb_pool_hex: ", self.rgb_pool_hex)
                if seed == 0:
                    return [self.basic_colors_hex[2] for _ in range(number)]
                if len(self.rgb_pool_hex) >= number:
                    if seed == 1:
                        return self.rgb_pool_hex[:number]
                    if seed == 2:
                        return self.rgb_pool_hex[-number:]
                if len(self.rgb_pool_hex_2) >= number:
                    if seed == 1:
                        return self.rgb_pool_hex_2[:number]
                    if seed == 2:
                        return self.rgb_pool_hex_2[-number:]
                if len(self.rgb_pool_hex_3) >= number:
                    if seed == 1:
                        return self.rgb_pool_hex_3[:number]
                    if seed == 2:
                        return self.rgb_pool_hex_3[-number:]
                return static_palettes.get_colors(number)

            if type == 'axis':
                seed = seed_axis % 2
                if seed == 0:
                    return [self.basic_colors_hex[2] for _ in range(number)]
                return [other_color for _ in range(number)]
            if type == 'embellishment':
                return self.rgb_pool_hex[:number]

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
