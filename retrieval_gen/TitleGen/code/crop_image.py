from PIL import Image

def crop(image_path, edge = 10):
    img = Image.open(image_path).convert("RGBA")
    original_img = img.copy()
    width, height = original_img.size

    # 左上角像素的颜色作为背景颜色
    background_color_list = []
    background_color_list.append(img.getpixel((0, 0)))
    background_color_list.append(img.getpixel((0, height-1)))
    background_color_list.append(img.getpixel((width-1, 0)))
    background_color_list.append(img.getpixel((width-1, height-1)))

    for i in range(3):
        img = Image.open(image_path).convert("RGBA")
        original_img = img.copy()
        width, height = original_img.size
        original_datas = img.getdata()
        new_datas = []
        background_color = background_color_list[i]
        for item in original_datas:
            if abs(item[0] - background_color[0]) <= 12 and abs(item[1] - background_color[1]) <= 12 and abs(item[2] - background_color[2]) <= 12:
                new_datas.append((0, 0, 0, 0))
            else:
                new_datas.append(item)
        img.putdata(new_datas)

        box = list(img.getbbox())
        # 确保框不越界
        box[0] = max(0, box[0]-edge)
        box[1] = max(0, box[1]-edge)
        box[2] = min(width, box[2]+edge)
        box[3] = min(height, box[3]+edge)
        box = tuple(box)

        img = original_img.crop(box)
        img.save(image_path)
    return image_path