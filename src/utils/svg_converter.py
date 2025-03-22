from cairosvg import svg2png
from PIL import Image
from lxml import etree
from io import StringIO
def get_svg_size(svg_string):
    # 创建解析器
    parser = etree.XMLParser(remove_comments=True, remove_blank_text=True)
    # 将SVG字符串解析为XML树
    tree = etree.parse(StringIO(svg_string), parser)
    root = tree.getroot()
    print(root)
    # 获取svg的width和height
    width = root.get('width')
    height = root.get('height')
    return float(width), float(height)
    
def convert_svg_to_png(svg_path, png_path):
    # 获取svg的尺寸
    with open(svg_path, 'r') as f:
        svg_string = f.read()
    svg_width, svg_height = get_svg_size(svg_string)
    # drawing = svg2rlg(svg_path)
    # renderPM.drawToFile(drawing, png_path, fmt="PNG")
    # image = Image.open(png_path)
    # width, height = image.size
    # return width, height, svg_width, svg_height
    
    #设置分辨率，并获取png的尺寸
    svg2png(url=svg_path, write_to=png_path, output_width=int(svg_width), output_height=int(svg_height))
    #获取png的尺寸
    image = Image.open(png_path)
    width, height = image.size
    return width, height, svg_width, svg_height
    