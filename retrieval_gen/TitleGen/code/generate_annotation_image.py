from PIL import Image, ImageDraw, ImageFont
from crop_image import crop
import textwrap

def get_bottom_right_pixel_color(image_path):
    img = Image.open(image_path)
    width, height = img.size
    pixel_color = img.getpixel((width - 1, height - 1))
    return pixel_color

def get_image_single_line(text, 
                        image_path = 'images/title/cropped_image.png', 
                        font_path = 'fonts/CALIFR.TTF', 
                        font_size = 30, 
                        save_path = 'images/annotation/line1.png', 
                        last_line = False):
    bg_color = get_bottom_right_pixel_color(image_path)
    # 背景颜色的RGB分量 
    R, G, B = bg_color[:3]
    # 根据背景颜色亮度选择文字颜色（黑或白）
    brightness = 0.2126 * R + 0.7152 * G + 0.0722 * B
    if brightness > 128:
        text_color = (0, 0, 0)
    else:
        text_color = (255, 255, 255)

    # 创建一个背景色为透明的图像
    if last_line:
        height = 50
    else:
        height = 38
    font = ImageFont.truetype(font_path, font_size)
    image = Image.new('RGBA', (5000, height), color=(R, G, B, 255))
    draw = ImageDraw.Draw(image)

    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    # 居中对齐的起始位置
    position = ((5000 - text_width) // 2, 0)#(35 - text_height) // 2)
    # 绘制文本
    draw.text(position, text, font=font, fill=text_color)
    image.save(save_path)
    return save_path

def get_image_lines(text_list, save_folder = 'images/annotation', title_image_path = 'images/title/generated_image.png'):
    for i, text in enumerate(text_list):
        isave_path = save_folder + '/line' + str(i + 1) + '.png'
        if i == len(text_list) - 1:
            get_image_single_line(text, image_path=title_image_path, save_path = isave_path, last_line = True)
        else:
            get_image_single_line(text, image_path=title_image_path, save_path = isave_path, last_line = False)
    images = [Image.open(save_folder + '/line' + str(i + 1) + '.png') for i in range(len(text_list))]
    widths, heights = zip(*(img.size for img in images))

    total_height = sum(heights)
    max_width = max(widths)
    combined_image = Image.new('RGBA', (max_width, total_height), (255, 255, 255, 0))
    y_offset = 0
    for img in images:
        combined_image.paste(img, (0, y_offset))
        y_offset += img.height

    combined_image.save(save_folder + '/combined_annotation.png')
    return save_folder + '/combined_annotation.png'

def break_lines(annotation_text, width=70):
    lines = textwrap.wrap(annotation_text, width)
    return lines
