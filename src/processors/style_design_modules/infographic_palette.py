
from .image2palette.palette import nets_init, generate_color_open

init = False
Sal, Sp = None, None

def get_palette(number, bcg_flag, image_path):
    global init, Sal, Sp
    if not init:
        Sal, Sp = nets_init()
        init = True
    return generate_color_open(number, bcg_flag, image_path, Sal, Sp)

if __name__ == '__main__':
    palette = get_palette(5, True, '/data1/jiashu/ChartPipeline/src/cache/infographics/700098704608262850.jpg')
    print(palette)