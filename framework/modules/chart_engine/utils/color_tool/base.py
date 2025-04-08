
def hex_to_rgb(hex_color):
    return tuple(int(hex_color[i:i+2], 16) for i in (1, 3, 5))
def interpolate_color(color1, color2, steps):
    # 将RGB值转换为HSV值
    def rgb_to_hsv(rgb_color):
        r, g, b = rgb_color
        max_val = max(r, g, b)
        min_val = min(r, g, b)
        delta = max_val - min_val
        if delta == 0:
            return 0, 0, max_val
        saturation = delta / max_val
        if max_val == r:
            hue = (g - b) / delta
        elif max_val == g:
            hue = 2 + (b - r) / delta
        else:
            hue = 4 + (r - g) / delta
        hue = hue * 60
        return hue, saturation, max_val
    # 将HSV值转换为RGB值
    def hsv_to_rgb(hue, saturation, value):
        if saturation == 0:
            return value, value, value
        i = int(hue / 60) % 6
        f = hue / 60 - i
        p = value * (1 - saturation)
        q = value * (1 - saturation * f)
        t = value * (1 - saturation * (1 - f))
        if i == 0:
            return value, t, p
        elif i == 1:
            return q, value, p
        elif i == 2:
            return p, value, t
        elif i == 3:
            return p, q, value
        elif i == 4:
            return t, p, value
        else:
            return value, p, q
    # 将颜色转换为RGB值
    color1 = hex_to_rgb(color1)
    color2 = hex_to_rgb(color2)
    # 计算中间值    
    hsv1 = rgb_to_hsv(color1)   
    hsv2 = rgb_to_hsv(color2)
    # 插值
    colors = []
    for i in range(steps):
        ratio = i / (steps - 1)
        hsv = [
            (1 - ratio) * hsv1[0] + ratio * hsv2[0],
            (1 - ratio) * hsv1[1] + ratio * hsv2[1],
            (1 - ratio) * hsv1[2] + ratio * hsv2[2]
        ]
        rgb = hsv_to_rgb(hsv[0], hsv[1], hsv[2])
        colors.append(rgb)
    # 将rgb值转换为int
    colors = [tuple(int(c) for c in color) for color in colors]
    # 将RGB值转换为十六进制颜色
    colors = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors]
    return colors

def interpolate_color2(color1, color2, steps):
    color1_rgb = hex_to_rgb(color1)
    color2_rgb = hex_to_rgb(color2)
    
    diff_r = color2_rgb[0] - color1_rgb[0]
    diff_g = color2_rgb[1] - color1_rgb[1]
    diff_b = color2_rgb[2] - color1_rgb[2]
    
    colors = []
    for i in range(steps):
        colors.append(f"#{int(color1_rgb[0] + diff_r * i / (steps - 1)):02x}{int(color1_rgb[1] + diff_g * i / (steps - 1)):02x}{int(color1_rgb[2] + diff_b * i / (steps - 1)):02x}")
    return colors