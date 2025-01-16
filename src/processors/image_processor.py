
import base64
import io
import requests
from PIL import Image
from typing import Tuple

class ImageProcessor:
    def __init__(self):
        pass

    def url_to_base64(self, url: str) -> str:
        """将URL图片转换为base64字符串"""
        if url.startswith(('http://', 'https://')):
            # 网络路径
            response = requests.get(url)
            img = Image.open(io.BytesIO(response.content))
        else:
            # 本地路径
            img = Image.open(url)
        buffered = io.BytesIO()
        img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def get_width_and_height(self, url: str) -> Tuple[int, int]:
        """获取图片宽高"""
        response = requests.get(url)
        img = Image.open(io.BytesIO(response.content))
        return img.size

    def resize(self, base64_str: str, width: int, height: int) -> str:
        """调整图片大小"""
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
        resized_img = img.resize((width, height))
        buffered = io.BytesIO()
        resized_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def crop(self, base64_str: str, x: int, y: int, width: int, height: int) -> str:
        """裁剪图片"""
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
        cropped_img = img.crop((x, y, x + width, y + height))
        buffered = io.BytesIO()
        cropped_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def rotate(self, base64_str: str, degree: int) -> str:
        """旋转图片"""
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
        rotated_img = img.rotate(degree, expand=True)
        buffered = io.BytesIO()
        rotated_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()

    def flip(self, base64_str: str, direction: str) -> str:
        """翻转图片,direction可以是'horizontal'或'vertical'"""
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
        if direction == 'horizontal':
            flipped_img = img.transpose(Image.FLIP_LEFT_RIGHT)
        else:
            flipped_img = img.transpose(Image.FLIP_TOP_BOTTOM)
        buffered = io.BytesIO()
        flipped_img.save(buffered, format=img.format)
        return base64.b64encode(buffered.getvalue()).decode()
    
    def crop_by_circle(self, base64_str: str) -> str:
        """裁剪图片为圆形"""
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
        # 计算最小半径
        radius = min(img.size[0], img.size[1]) // 2
        # 计算圆心坐标
        center_x = img.size[0] // 2
        center_y = img.size[1] // 2
        # 创建圆形遮罩
        mask = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((center_x - radius, center_y - radius, 
                     center_x + radius, center_y + radius), fill=255)
        # 应用遮罩
        output = Image.new('RGBA', img.size, (0, 0, 0, 0))
        output.paste(img, mask=mask)
        # 保存并返回base64
        buffered = io.BytesIO()
        output.save(buffered, format='PNG')
        return base64.b64encode(buffered.getvalue()).decode()
