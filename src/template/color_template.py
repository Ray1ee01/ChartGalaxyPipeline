import random

def rgb_to_hex(r, g, b):
    r = max(0, min(r, 255))
    g = max(0, min(g, 255))  
    b = max(0, min(b, 255))
    return '#{:02x}{:02x}{:02x}'.format(r, g, b)

def random_rgb():
    r = random.randint(0, 255)
    g = random.randint(0, 255)
    b = random.randint(0, 255)
    return (r, g, b)

def random_hex():
    r, g, b = random_rgb()
    return rgb_to_hex(r, g, b)

class ColorDesign:
    def __init__(self, image_palette, mode='monochromatic'):
        self.pool = image_palette
        self.mode = mode

    def get_color(self, type, number):
        if type == 'background':
            return [rgb_to_hex(240,240,240) for _ in range(number)]
        if type == 'text':
            return [rgb_to_hex(0, 0, 0) for _ in range(number)]
        if type == 'marks':
            return [random_hex() for _ in range(number)]
        if type == 'axis':
            return [random_hex() for _ in range(number)]
        if type == 'embellishment':
            return [random_hex() for _ in range(number)]
        