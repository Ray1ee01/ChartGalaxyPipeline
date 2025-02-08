import colour
import numpy as np
import random

def palette_iteration(lch_palette):
    # rank the colors in the palette by hue
    # linearly interpolate between colors in the palette
    lchs = lch_palette[:]
    lchs.sort(key=lambda x: x[2])
    lchs = lchs + [lchs[0]]
    res = []
    for i in range(len(lchs) - 1):
        lch1 = lchs[i]
        lch2 = lchs[i + 1]
        lch_inter = [(lch1[j] + lch2[j]) / 2 for j in range(3)]
        res.append(lch1)
        res.append(lch_inter)
    return res

from matplotlib import colors
import matplotlib.pyplot as plt
import numpy as np

class StaticPalettes:
    def __init__(self):
        self.qualitative_colormaps = ['Pastel1', 'Pastel2', 'Paired', 'Accent', 
                                    'Dark2', 'Set1', 'Set2', 'Set3', 'tab10', 
                                    'tab20', 'tab20b', 'tab20c']
    
    def get_colors_from_cmap(self, cmap_name, n_colors):
        if cmap_name not in self.qualitative_colormaps:
            raise ValueError(f"Uncertain palette name: {cmap_name}")
            
        cmap = plt.get_cmap(cmap_name)
        colors_rgb = cmap(np.linspace(0, 1, n_colors))
        hex_colors = [colors.rgb2hex(rgb[:3]) for rgb in colors_rgb]
        return hex_colors
    
    def get_named_color(self, color_name):
        try:
            rgb = colors.to_rgb(color_name)
            return colors.rgb2hex(rgb)
        except ValueError:
            raise ValueError(f"Uncertain color name: {color_name}")
    
    def list_available_colormaps(self):
        return self.qualitative_colormaps

    def get_colors(self, n_colors):
        # random select a palette
        color_map = random.choice(self.qualitative_colormaps)
        return self.get_colors_from_cmap(color_map, n_colors)
    
class EmphasisColors:
    def __init__(self):
        self.colors = []
        # 默认添加几种强调色
        self.colors.append("#FF0000")
        self.colors.append("#00FF00")
        self.colors.append("#0000FF")
        self.colors.append("#FFFF00")
        self.colors.append("#FF00FF")
        self.colors.append("#00FFFF")
        
    def add_color(self, color):
        self.colors.append(color)
    
    def get_color(self):
        # 随机返回一个颜色
        return random.choice(self.colors)

if __name__ == "__main__":
    sp = StaticPalettes()
    print(sp.get_colors_from_cmap('tab10', 10))
    print(sp.get_named_color('red'))
    print(sp.list_available_colormaps())