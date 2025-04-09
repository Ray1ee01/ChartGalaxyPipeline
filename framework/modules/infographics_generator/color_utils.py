from typing import Tuple

def parse_color(c: str) -> Tuple[int, int, int]:
    """将颜色字符串解析为RGB元组"""
    if c.startswith('#'):
        c = c.lstrip('#')
        if len(c) == 3:
            c = ''.join(x + x for x in c)
        return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))
    elif c.startswith('rgb'):
        return tuple(map(int, c.strip('rgb()').split(',')))
    raise ValueError(f"Unsupported color format: {c}")

def rgb_to_hsl(r: int, g: int, b: int) -> Tuple[float, float, float]:
    """RGB颜色转换为HSL颜色空间"""
    r, g, b = r/255.0, g/255.0, b/255.0
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    h, s, l = 0, 0, (max_val + min_val) / 2
    
    if max_val != min_val:
        d = max_val - min_val
        s = d / (2 - max_val - min_val) if l > 0.5 else d / (max_val + min_val)
        if max_val == r:
            h = (g - b) / d + (6 if g < b else 0)
        elif max_val == g:
            h = (b - r) / d + 2
        elif max_val == b:
            h = (r - g) / d + 4
        h /= 6
        
    return h * 360, s * 100, l * 100

def hsl_to_rgb(h: float, s: float, l: float) -> Tuple[int, int, int]:
    """HSL颜色转换为RGB颜色空间"""
    h, s, l = h/360, s/100, l/100
    
    def hue_to_rgb(p: float, q: float, t: float) -> float:
        if t < 0:
            t += 1
        if t > 1:
            t -= 1
        if t < 1/6:
            return p + (q - p) * 6 * t
        if t < 1/2:
            return q
        if t < 2/3:
            return p + (q - p) * (2/3 - t) * 6
        return p
    
    if s == 0:
        r = g = b = l
    else:
        q = l * (1 + s) if l < 0.5 else l + s - l * s
        p = 2 * l - q
        r = hue_to_rgb(p, q, h + 1/3)
        g = hue_to_rgb(p, q, h)
        b = hue_to_rgb(p, q, h - 1/3)
        
    return tuple(round(x * 255) for x in (r, g, b))

def get_contrast_color(color: str, method: str = 'complement') -> str:
    """获取给定颜色的对比色"""
    r, g, b = parse_color(color)
    
    if method == 'complement':
        contrast_r = 255 - r
        contrast_g = 255 - g
        contrast_b = 255 - b
    elif method == 'hsl':
        h, s, l = rgb_to_hsl(r, g, b)
        h = (h + 180) % 360
        contrast_r, contrast_g, contrast_b = hsl_to_rgb(h, s, l)
    else:
        raise ValueError(f"Unsupported method: {method}")
    
    return f'#{contrast_r:02x}{contrast_g:02x}{contrast_b:02x}' 