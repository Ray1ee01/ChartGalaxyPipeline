import random
import colour
import numpy as np

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

def rgb2hcl(r, g, b):
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
    lch = rgb2hcl(*rgb)
    res = []
    for l in range(45, 95, 10):
        lch[0] = l
        lab = colour.LCHab_to_Lab(lch)
        xyz = colour.Lab_to_XYZ(lab)
        rgb = colour.XYZ_to_sRGB(xyz)
        res.append(norm255rgb(rgb))
    return res

def extend_color_in_c(rgb):
    lch = rgb2hcl(*rgb)
    res = []
    for c in range(35, 85, 10):
        lch[1] = c
        lab = colour.LCHab_to_Lab(lch)
        xyz = colour.Lab_to_XYZ(lab)
        rgb = colour.XYZ_to_sRGB(xyz)
        res.append(norm255rgb(rgb))
    return res

def delta_h(h1, h2):
    dh = (h1-h2) % 360
    if dh < 0:
        dh += 360
    if dh > 180:
        dh = 360 - dh
    return dh
    

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
            self.main_color = rgb_cp[-1]
            self.bcg_color = bcg_rgb
            print(self.main_color)
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'black'
            self.extend_colors1 = extend_color_in_l(self.main_color)
            self.extend_colors2 = extend_color_in_c(self.main_color)

        if mode == 'complementary':
            rgb_cp = self.rgb_pool.copy()
            bcg = image_palette['bcg']
            bcg_rgb = hex_to_rgb(bcg)
            rgb_cp = [rgb for rgb in rgb_cp if ciede2000(rgb, bcg_rgb) > 10]
            lch_pool = [rgb2hcl(*rgb) for rgb in rgb_cp]
            h_pool = [lch[2] for lch in lch_pool]

            # for each color, find the color with hue difference closest to 180
            self.complementary_colors = []
            for i in range(len(lch_pool)):
                h = lch_pool[i][2]
                h_diff = [delta_h(h, h2) for h2 in h_pool]
                h_diff[i] = 360
                min_idx = h_diff.index(min(h_diff))
                self.complementary_colors.append([rgb_cp[i], rgb_cp[min_idx]])
            
            self.bcg_color = bcg_rgb
            dist_color_2_black = ciede2000(self.bcg_color, black)
            dist_color_2_white = ciede2000(self.bcg_color, white)
            if dist_color_2_black > dist_color_2_white:
                self.lightness = 'light'
            else:
                self.lightness = 'black'


        if mode == 'analogous':
            pass

        if mode == 'polychromatic':
            pass
        self.basic_colors = [black, white, gray]


    def get_color(self, type, number, seed_color = 0, seed_text = 0, seed_mark = 0, seed_axis = 0, seed_embellishment = 0, reverse = False):
        if type == 'background':
            return [self.pool['bcg'] for _ in range(number)]

        if self.mode == 'monochromatic': 
            if type == 'text':
                seed = -1 - seed_text % 2 if reverse else seed_text % 5
                if seed == 0: # all same color
                    return [rgb_to_hex(*self.main_color) for _ in range(number)]
                if seed == 1: # all black/white
                    if self.lightness == 'dark':
                        return [rgb_to_hex(*self.basic_colors[1]) for _ in range(number)]
                    return [rgb_to_hex(*self.basic_colors[0]) for _ in range(number)]
                if seed == 2: # extend in lightness
                    res = self.extend_colors1[:number]
                    if len(res) < number:
                        res += [self.extend_colors1[-1] for _ in range(number - len(res))]
                    return [rgb_to_hex(*color) for color in res]
                if seed == 3: # extend in chroma
                    res = self.extend_colors2[:number]
                    if len(res) < number:
                        res += [self.extend_colors2[-1] for _ in range(number - len(res))]
                    return [rgb_to_hex(*color) for color in res]
                if seed == 4: # main color + other black/white
                    res = [self.main_color]
                    other_color = None
                    if self.lightness == 'dark':
                        other_color = self.basic_colors[1]
                    else:
                        other_color = self.basic_colors[0]
                    for i in range(1, number):
                        res.append(other_color)
                    return [rgb_to_hex(*color) for color in res]
                if seed == -1: # reverse black/white
                    if self.lightness == 'dark':
                        value = rgb_to_hex(*self.basic_colors[0])
                        return [value for _ in range(number)]
                    value = rgb_to_hex(*self.basic_colors[1])
                    return [value for _ in range(number)]
                if seed == -2: # reverse bcg color
                    value = rgb_to_hex(*self.bcg_color)
                    return [value for _ in range(number)]
                    
            if type == 'marks':
                seed = seed_mark % 6
                # use extend color in l or c
                if seed == 1 and len(self.extend_colors1) >= number:
                    print("extend_colors1: ", self.extend_colors1)
                    return [rgb_to_hex(*color) for color in self.extend_colors1[:number]]
                if seed == 2 and len(self.extend_colors1) >= number:
                    return [rgb_to_hex(*color) for color in self.extend_colors1[-number:]]
                if seed == 3 and len(self.extend_colors2) >= number:
                    return [rgb_to_hex(*color) for color in self.extend_colors2[:number]]
                if seed == 4 and len(self.extend_colors2) >= number:
                    return [rgb_to_hex(*color) for color in self.extend_colors2[-number:]]
                # use gray color as marks
                if seed == 5:
                    return [rgb_to_hex(*self.basic_colors[2]) for _ in range(number)]
                # use main color as marks
                return [rgb_to_hex(*self.main_color) for _ in range(number)]
                
            if type == 'axis':
                seed = seed_axis % 5
                if seed == 1: # darkest color of c
                    return [rgb_to_hex(*self.extend_colors1[0]) for _ in range(number)]
                if seed == 2: # darkest color of l
                    return [rgb_to_hex(*self.extend_colors2[0]) for _ in range(number)]
                if seed == 3: # gray
                    return [rgb_to_hex(*self.basic_colors[2]) for _ in range(number)]
                if seed == 4: # main color
                    return [rgb_to_hex(*self.main_color) for _ in range(number)]
                if self.lightness == 'dark': # black or white
                    return [rgb_to_hex(*self.basic_colors[1]) for _ in range(number)]
                return [rgb_to_hex(*self.basic_colors[0]) for _ in range(number)]

            if type == 'embellishment':
                seed = seed_embellishment % 3
                if seed == 1:
                    res = []
                    for i in range(number):
                        res.append(random.choice(self.extend_colors1))
                    return [rgb_to_hex(*color) for color in res]
                if seed == 2:
                    res = []
                    for i in range(number):
                        res.append(random.choice(self.extend_colors2))
                    return [rgb_to_hex(*color) for color in res]
                return [rgb_to_hex(*self.main_color) for _ in range(number)]
        
        if self.mode == 'complementary':
            length = len(self.complementary_colors)
            seed_color = seed_color % length
            selected_color = self.complementary_colors[seed_color]
            color1 = selected_color[0]
            color2 = selected_color[1]
            extend_colors1_l = extend_color_in_l(color1)
            extend_colors2_l = extend_color_in_l(color2)
            extend_colors1_c = extend_color_in_c(color1)
            extend_colors2_c = extend_color_in_c(color2)
            if self.lightness == 'dark':
                main_color1 = extend_colors1_l[-1]
                main_color2 = extend_colors2_l[-1]
            else:
                main_color1 = extend_colors1_l[0]
                main_color2 = extend_colors2_l[0]

            if type == 'text':
                text_seed = seed_text % 10
                if text_seed == 1:
                    return [rgb_to_hex(*color1) for _ in range(number)]
                if text_seed == 2:
                    return [rgb_to_hex(*color2) for _ in range(number)]
                if text_seed == 3:
                    res = [main_color1]
                    other_color = None
                    if self.lightness == 'dark':
                        other_color = self.basic_colors[1]
                    else:
                        other_color = self.basic_colors[0]
                    for i in range(1, number):
                        res.append(other_color)
                    return [rgb_to_hex(*color) for color in res]
                if text_seed == 4:
                    res = [main_color2]
                    other_color = None
                    if self.lightness == 'dark':
                        other_color = self.basic_colors[1]
                    else:
                        other_color = self.basic_colors[0]
                    for i in range(1, number):
                        res.append(other_color)
                    return [rgb_to_hex(*color) for color in res]
                if text_seed == 5: # black/white
                    if self.lightness == 'dark':
                        return [rgb_to_hex(*self.basic_colors[1]) for _ in range(number)]
                    return [rgb_to_hex(*self.basic_colors[0]) for _ in range(number)]
                



            
        pass


if __name__ == "__main__":
    palette = {
        'color_list': ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'],
        'bcg': '#000000'
    }
    design = ColorDesign(palette)
    print(design.get_color('background', 5))
    print(design.get_color('text', 5))
    print(design.get_color('marks', 5))
    print(design.get_color('axis', 5))
    print(design.get_color('embellishment', 5))
