import base64
import io
import requests
from PIL import Image, ImageDraw
from typing import Tuple
from .svg_processor_modules.elements import Path

class ImageProcessor:
    def __init__(self):
        pass
    
    @staticmethod
    def url_to_base64(url: str) -> str:
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

    # def get_width_and_height(self, url: str) -> Tuple[int, int]:
    #     """获取图片宽高"""
    #     response = requests.get(url)
    #     img = Image.open(io.BytesIO(response.content))
    #     return img.size
    @staticmethod
    def get_width_and_height(base64_str: str) -> Tuple[int, int]:
        """获取图片宽高"""
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
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

    def clip_by_path(self, base64_str: str, path: Path) -> str:
        """根据路径裁剪图片"""
        coordinates = path._get_path_coordinates()
        img = Image.open(io.BytesIO(base64.b64decode(base64_str)))
        #把image临时保存到本地
        img.save('temp.png')
        print(img)
        # 创建一个与图片大小相同的空白图像
        mask = Image.new('L', img.size, 0)
        draw = ImageDraw.Draw(mask)
        if not path._bounding_box:
            path._bounding_box = path.get_bounding_box()
        # 在裁剪前保持横纵比对path进行缩放,保证能够容纳下path
        scale_factor = min(img.width / path._bounding_box.width, img.height / path._bounding_box.height)
        coordinates = [(x * scale_factor, y * scale_factor) for x, y in coordinates]
        
        # 同时调整path的坐标,通过平移,保证path在图片内部
        min_x = min(coordinates, key=lambda x: x[0])[0]
        min_y = min(coordinates, key=lambda y: y[1])[1]
        max_x = max(coordinates, key=lambda x: x[0])[0]
        max_y = max(coordinates, key=lambda y: y[1])[1]
        # 计算平移量
        translate_x = min_x
        translate_y = min_y
        # 将path的坐标平移到图片内部
        coordinates = [(x - translate_x, y - translate_y) for x, y in coordinates]
        draw.polygon(coordinates, fill=255)
        
        # 将裁剪后的图像与原始图像进行按位与操作
        img = Image.composite(img, Image.new('RGBA', img.size, (0, 0, 0, 0)), mask)
        # print("image size: ", img.size)
        # 裁剪后的图片需要进行crop，以保证裁剪后的图片与path的bounding box一致
        img = img.crop((0, 0, path._bounding_box.width*scale_factor, path._bounding_box.height*scale_factor))
        # print("image size after crop: ", img.size)
        buffered = io.BytesIO()
        # 明确指定保存格式为PNG，因为我们需要支持透明度
        img.save(buffered, format='PNG')
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
