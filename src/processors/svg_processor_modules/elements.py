from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from ...utils.node_bridge import NodeBridge
import re
import math
from abc import ABC, abstractmethod
import os
import json
import base64
import requests
import mimetypes
from urllib.parse import urlparse
from PIL import Image as PILImage
from io import BytesIO
# from ..image_processor import ImageProcessor
import pytesseract
import time
import cairosvg
from config import project_dir


node_bridge = NodeBridge()

@dataclass
class BoundingBox:
    """边界框类"""
    width: float
    height: float
    minx: float
    maxx: float
    miny: float
    maxy: float

    # 添加

    @property
    def relative_position(self) -> dict:
        """在group内的相对坐标"""
        return {
            'width': self.width,
            'height': self.height,
            'minx': self.minx,
            'maxx': self.maxx,
            'miny': self.miny,
            'maxy': self.maxy
        }

    @property
    def absolute_position(self) -> dict:
        """在图中的绝对坐标"""
        return {
            'width': self.width,
            'height': self.height,
            'minx': self.minx,
            'maxx': self.maxx,
            'miny': self.miny,
            'maxy': self.maxy
        }

    def is_overlapping(self, other: 'BoundingBox') -> bool:
        """判断两个边界框是否重叠

        Args:
            other: 另一个边界框

        Returns:
            bool: 是否重叠
        """
        # 检查x轴是否重叠
        x_overlap = not (self.maxx < other.minx or self.minx > other.maxx)
        # 检查y轴是否重叠
        y_overlap = not (self.maxy < other.miny or self.miny > other.maxy)

        # 两个轴都重叠时,边界框重叠
        return x_overlap and y_overlap

    def dump(self) -> str:
        """输出边界框信息"""
        return f"BoundingBox(width={self.width:.2f}, height={self.height:.2f}, minx={self.minx:.2f}, maxx={self.maxx:.2f}, miny={self.miny:.2f}, maxy={self.maxy:.2f})"

    def format(self) -> dict:
        """格式化边界框信息"""
        return {
            'width': self.width,
            'height': self.height,
            'minx': self.minx,
            'maxx': self.maxx,
            'miny': self.miny,
            'maxy': self.maxy
        }

@dataclass
class Padding:
    """内边距类"""
    top: float = 0
    right: float = 0
    bottom: float = 0
    left: float = 0


@dataclass
class DataAttribute:
    """数据属性"""
    """
    available_keys: x_data, y_data, group_data, x_data_list, y_data_list, group_data_list
    例如对于line chart,一条线会对应多个数据点,因此,需要x_data_list, y_data_list这样的扩展
    """
    data_attributes: dict
    _available_keys = {'x_data', 'y_data', 'group_data','size_data', 'order_data', 'x_data_list', 'y_data_list', 'group_data_list', 'y2_data_list'}
    _list_keys = {'x_data_list', 'y_data_list', 'group_data_list', 'y2_data_list'}
    _non_list_keys = {'x_data', 'y_data', 'group_data', 'size_data', 'order_data'}

    def __init__(self, data_attributes: dict):
        self._validate_keys(data_attributes)
        self._validate_values(data_attributes)
        self.data_attributes = data_attributes

    def update_attributes(self, data_attributes: dict):
        self._validate_keys(data_attributes)
        self._validate_values(data_attributes)
        self.data_attributes = data_attributes

    def _validate_keys(self, data_attributes: dict):
        """验证数据属性字典中的键是否合法"""
        invalid_keys = set(data_attributes.keys()) - self._available_keys
        if invalid_keys:
            raise ValueError(f"发现非法的数据属性键: {invalid_keys}。允许的键为: {self._available_keys}")

    def _validate_values(self, data_attributes: dict):
        """验证数据属性值的类型是否合法"""
        for key, value in data_attributes.items():
            if key in self._list_keys and not isinstance(value, list):
                raise ValueError(f"键 {key} 的值必须是list类型,但收到了 {type(value)}")
            elif key in self._non_list_keys and isinstance(value, list):
                raise ValueError(f"键 {key} 的值不能是list类型,但收到了list")



class LayoutElement(ABC):
    """布局元素基类"""
    def __init__(self):
        self.id = None
        self._bounding_box: Optional[BoundingBox] = None
        self._padding: Padding = Padding()
        self.attributes: dict = {}  # 添加 attributes 属性

    @property
    def bounding_box(self) -> Optional[BoundingBox]:
        return self._bounding_box

    def update_pos(self, old_min_x: float, old_min_y: float):
        print("self.tag: ", self.tag, "self.bounding_box: ", self._bounding_box)
        print("old_min_x: ", old_min_x, "old_min_y: ", old_min_y)
        if 'x' in self.attributes:
            self.attributes['x'] += self._bounding_box.minx - old_min_x
        else:
            self.attributes['x'] = self._bounding_box.minx - old_min_x
        if 'y' in self.attributes:
            self.attributes['y'] += self._bounding_box.miny - old_min_y
        else:
            self.attributes['y'] = self._bounding_box.miny - old_min_y
        print("self.tag: ", self.tag, "self.attributes['x']: ", self.attributes['x'], "self.attributes['y']: ", self.attributes['y'])
        print("self.tag: ", self.tag, "self.bounding_box: ", self.get_bounding_box())
    def update_scale(self, scale_x: float, scale_y: float):
        current_transform = self.attributes.get('transform', '')
        if scale_x >= 1 and scale_y >= 1:
            scale = max(scale_x, scale_y)
        else:
            scale = min(scale_x, scale_y)
        new_transform = f"scale({scale})"
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform}"
        else:
            self.attributes['transform'] = new_transform
        return scale

    @property
    def get_transform_matrix(self) -> List[float]:
        """解析transform属性,返回标准SVG变换矩阵

        Returns:
            List[float]: 变换矩阵 [a, b, c, d, e, f]
            表示矩阵:
            | a c e |
            | b d f |
            | 0 0 1 |
        """
        transform = self.attributes.get('transform', '')
        if not transform:
            return [1, 0, 0, 1, 0, 0]

        # 初始变换矩阵
        matrix = [1, 0, 0, 1, 0, 0]

        # 匹配所有transform命令
        transform_pattern = r'(translate|rotate|scale)\(([-\d\s,.]+)\)'
        transforms = re.finditer(transform_pattern, transform)

        for t in transforms:
            command = t.group(1)
            params = [float(p) for p in t.group(2).replace(' ', '').split(',') if p]

            if command == 'translate':
                tx = params[0]
                ty = params[1] if len(params) > 1 else 0
                # 平移矩阵与当前矩阵相乘
                translate_matrix = [1, 0, 0, 1, tx, ty]
                matrix = self._multiply_matrices(matrix, translate_matrix)

            elif command == 'rotate':
                angle = params[0] * (math.pi / 180)  # 转换为弧度
                cos_a = math.cos(angle)
                sin_a = math.sin(angle)

                if len(params) == 3:  # 带中心点的旋转
                    cx, cy = params[1], params[2]
                    # 1. 平移到原点
                    translate1 = [1, 0, 0, 1, -cx, -cy]
                    # 2. 旋转
                    rotate = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
                    # 3. 平移回原位置
                    translate2 = [1, 0, 0, 1, cx, cy]

                    # 按顺序应用变换: matrix * translate1 * rotate * translate2
                    matrix = self._multiply_matrices(matrix, translate2)
                    matrix = self._multiply_matrices(matrix, rotate)
                    matrix = self._multiply_matrices(matrix, translate1)
                else:  # 普通旋转
                    rotate = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
                    matrix = self._multiply_matrices(matrix, rotate)

            elif command == 'scale':
                sx = params[0]
                sy = params[1] if len(params) > 1 else sx
                # 缩放矩阵与当前矩阵相乘
                scale_matrix = [sx, 0, 0, sy, 0, 0]
                matrix = self._multiply_matrices(matrix, scale_matrix)

        return matrix

    def _multiply_matrices(self, m1: List[float], m2: List[float]) -> List[float]:
        """矩阵乘法

        Args:
            m1: 第一个矩阵 [a1, b1, c1, d1, e1, f1]
            m2: 第二个矩阵 [a2, b2, c2, d2, e2, f2]

        Returns:
            List[float]: 结果矩阵 [a, b, c, d, e, f]
        """
        return [
            m1[0] * m2[0] + m1[2] * m2[1],          # a
            m1[1] * m2[0] + m1[3] * m2[1],          # b
            m1[0] * m2[2] + m1[2] * m2[3],          # c
            m1[1] * m2[2] + m1[3] * m2[3],          # d
            m1[0] * m2[4] + m1[2] * m2[5] + m1[4],  # e
            m1[1] * m2[4] + m1[3] * m2[5] + m1[5]   # f
        ]

    def _apply_transform(self, minX: float, minY: float, maxX: float, maxY: float, matrix: List[float]) -> Dict[str, float]:
        """应用变换矩阵到边界框的四个角点

        Args:
            minX: 边界框左上角x坐标
            minY: 边界框左上角y坐标
            maxX: 边界框右下角x坐标
            maxY: 边界框右下角y坐标
            matrix: 变换矩阵 [a, b, c, d, e, f]

        Returns:
            Dict[str, float]: 变换后的边界框
        """
        # 计算四个角点变换后的坐标
        nx1, ny1 = self._apply_matrix(minX, minY, matrix)  # 左上
        nx2, ny2 = self._apply_matrix(maxX, maxY, matrix)  # 右下
        nx3, ny3 = self._apply_matrix(minX, maxY, matrix)  # 左下
        nx4, ny4 = self._apply_matrix(maxX, minY, matrix)  # 右上

        # 找出变换后的最小和最大坐标
        new_min_x = min(nx1, nx2, nx3, nx4)
        new_min_y = min(ny1, ny2, ny3, ny4)
        new_max_x = max(nx1, nx2, nx3, nx4)
        new_max_y = max(ny1, ny2, ny3, ny4)

        # return {
        #     'minX': new_min_x,
        #     'minY': new_min_y,
        #     'maxX': new_max_x,
        #     'maxY': new_max_y
        # }
        return BoundingBox(new_max_x - new_min_x, new_max_y - new_min_y, new_min_x, new_max_x, new_min_y, new_max_y)

    def _apply_matrix(self, x: float, y: float, matrix: List[float]) -> Tuple[float, float]:
        """应用变换矩阵到单个坐标点

        Args:
            x: 点的x坐标
            y: 点的y坐标
            matrix: 变换矩阵 [a, b, c, d, e, f]

        Returns:
            Tuple[float, float]: 变换后的坐标点(x, y)
        """

        return (
            matrix[0] * x + matrix[2] * y + matrix[4],
            matrix[1] * x + matrix[3] * y + matrix[5]
        )

    @bounding_box.setter
    def bounding_box(self, value: BoundingBox):
        self._bounding_box = value

    @property
    def padding(self) -> Padding:
        return self._padding

    @padding.setter
    def padding(self, value: Padding):
        self._padding = value

    def dump(self, indent: int = 0) -> str:
        """输出元素信息

        Args:
            indent: 缩进层级

        Returns:
            str: 格式化的元素信息
        """
        prefix = "  " * indent
        class_name = self.__class__.__name__

        # 基本信息
        info = [f"{prefix}{class_name}:"]

        # id
        if self.id:
            info.append(f"{prefix}  id: {self.id}")

        # 边界框信息
        if self._bounding_box:
            bbox = self._bounding_box
            info.append(f"{prefix}  BoundingBox:")
            info.append(f"{prefix}    width: {bbox.width:.2f}")
            info.append(f"{prefix}    height: {bbox.height:.2f}")
            info.append(f"{prefix}    position: ({bbox.minx:.2f}, {bbox.miny:.2f}) -> ({bbox.maxx:.2f}, {bbox.maxy:.2f})")

        # 内边距信息
        if any([self._padding.top, self._padding.right, self._padding.bottom, self._padding.left]):
            info.append(f"{prefix}  Padding:")
            info.append(f"{prefix}    top: {self._padding.top}")
            info.append(f"{prefix}    right: {self._padding.right}")
            info.append(f"{prefix}    bottom: {self._padding.bottom}")
            info.append(f"{prefix}    left: {self._padding.left}")


        # 添加attributes
        if self.attributes:
            info.append(f"{prefix}  Attributes:")
            for key, value in self.attributes.items():
                if key == 'xlink:href':continue
                info.append(f"{prefix}    {key}: {value}")

        # 特定元素的额外属性
        extra_info = self._dump_extra_info()
        if extra_info:
            info.extend([f"{prefix}  {line}" for line in extra_info])

        return "\n".join(info)

    def _dump_extra_info(self) -> List[str]:
        """输出额外的元素特定信息"""
        info = []
        if self.attributes:
            info.append("Attributes:")
            for key, value in self.attributes.items():
                info.append(f"  {key}: {value}")
        return info

class GroupElement(LayoutElement):
    """组元素类"""
    def __init__(self):
        super().__init__()
        self.children: List[LayoutElement] = []
        self.layout_strategy = None  # 可以是垂直布局、水平布局等
        self.size_constraint = None
        self.tag = 'g'
        self.reference_id = None

    def update_pos(self, old_min_x: float, old_min_y: float):
        current_transform = self.attributes.get('transform', '')
        new_transform = f"translate({self._bounding_box.minx - old_min_x}, {self._bounding_box.miny - old_min_y})"
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform}"
        else:
            self.attributes['transform'] = new_transform


    def get_element_by_id(self, id: str) -> LayoutElement:
        for child in self.children:
            if child.id == id:
                return child
        return None


    def get_bounding_box(self) -> BoundingBox:
        """获取组元素的边界框

        Returns:
            BoundingBox: 包含minX, minY, maxX, maxY的边界框
        """
        # 获取当前组的变换矩阵
        transform = self.get_transform_matrix

        # 获取所有子元素的边界框
        child_bboxes = []
        for child in self.children:
            child_bbox = child.get_bounding_box()
            child._bounding_box = child_bbox
            if child_bbox and child_bbox.width > 0 and child_bbox.height > 0:
                if transform:
                    if isinstance(transform, list) and len(transform) == 2:
                        # 如果是两个矩阵,进行两次变换
                        bbox1 = self._apply_transform(
                            child_bbox.minx, child_bbox.miny,
                            child_bbox.maxx, child_bbox.maxy,
                            transform[0]
                        )
                        child_bbox = self._apply_transform(
                            bbox1.maxx, bbox1.maxy,
                            bbox1.maxx, bbox1.maxy,
                            transform[1]
                        )
                    else:
                        # 单个矩阵变换
                        child_bbox = self._apply_transform(
                            child_bbox.minx, child_bbox.miny,
                            child_bbox.maxx, child_bbox.maxy,
                            transform
                        )
                child_bboxes.append(child_bbox)

        # 如果没有子元素,返回空边界框
        if not child_bboxes:
            return BoundingBox(0, 0, 0, 0, 0, 0)

        # 计算所有子元素边界框的并集
        minX = min(bbox.minx for bbox in child_bboxes)
        minY = min(bbox.miny for bbox in child_bboxes)
        maxX = max(bbox.maxx for bbox in child_bboxes)
        maxY = max(bbox.maxy for bbox in child_bboxes)

        return BoundingBox(maxX - minX, maxY - minY, minX, maxX, minY, maxY)

    def get_children_boundingboxes(self) -> List[BoundingBox]:
        """获取所有子元素的边界框"""
        children_boundingboxes = []
        for child in self.children:
            # print("child.tag: ", child.tag,"child.attributes: ", child.attributes)
            if child._bounding_box:
               children_boundingboxes.append(child._bounding_box)
            else:
                child._bounding_box = child.get_bounding_box()
                children_boundingboxes.append(child._bounding_box)
        # 加上self._bounding_box的minx, miny作为偏移量
        # children_boundingboxes = [BoundingBox(bbox.width, bbox.height, bbox.minx + self._bounding_box.minx, bbox.maxx + self._bounding_box.minx, bbox.miny + self._bounding_box.miny, bbox.maxy + self._bounding_box.miny) for bbox in children_boundingboxes]
        return children_boundingboxes

    def layout(self, children: List[LayoutElement]) -> None:
        """布局子元素"""
        if self.layout_strategy:
            self.layout_strategy.layout(children)

    def _dump_extra_info(self) -> List[str]:
        info = []
        print("self.tag: ", self.tag)
        print("self.children: ", self.children)
        print("self.layout_strategy: ", self.layout_strategy)
        if self.layout_strategy:
            info.append(f"Layout Strategy: {self.layout_strategy.__class__.__name__}")
        if self.children:
            info.append(f"Children Count: {len(self.children)}")
            for child in self.children:
                child_dump = child.dump(indent=1)
                info.extend(child_dump.split('\n'))
        return info

class AtomElement(LayoutElement):
    """原子元素基类"""
    pass

class Image(AtomElement):
    """图片元素"""
    def __init__(self, base64: str=None):
        super().__init__()
        self.base64 = base64
        self.tag = 'image'
        self.original_width = 0
        self.original_height = 0
        if base64:
            self.attributes['xlink:href'] = "data:" + base64
        
    @staticmethod
    def _getImageAsBase64(image_url: str) -> Optional[str]:
        """将图片转换为base64编码

        Args:
            image_url: 图片URL或本地文件路径

        Returns:
            Tuple[Optional[str], int, int]: base64编码的图片数据(包含MIME类型)、原始宽度、原始高度
        """
        try:
            if isinstance(image_url, dict):
                image_url = image_url['file_path']
                # print("image_url: ", image_url)
            # 检查是否已经是base64编码
            if image_url.startswith('data:'):
                return image_url

            # 判断是URL还是本地文件
            parsed = urlparse(image_url)
            is_url = bool(parsed.scheme and parsed.netloc)

            # 获取图片数据
            if is_url:
                response = requests.get(image_url)
                image_data = response.content
                # 从URL或Content-Type获取MIME类型
                content_type = response.headers.get('content-type')
                if not content_type:
                    content_type = mimetypes.guess_type(image_url)[0] or 'image/png'
            else:
                # 处理本地文件
                with open(image_url, 'rb') as f:
                    image_data = f.read()
                content_type = mimetypes.guess_type(image_url)[0] or 'image/png'

            # 转换为base64
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return f"{content_type};base64,{base64_data}"

        except Exception as e:
            print(f"Error processing image {image_url}: {str(e)}")
            return None

    @staticmethod
    def get_image_size(image_url: str) -> Tuple[int, int]:
        # print(f"image_url: {image_url}")
        """获取图片尺寸"""
        # try:
        # 检查是否已经是base64编码
        if image_url.startswith('data:') or image_url.startswith('image/'):
            # 从base64编码中提取图片数据
            image_data = base64.b64decode(image_url.split(',')[1])
            # 使用PIL获取图片尺寸
            img = PILImage.open(BytesIO(image_data))
            width, height = img.size
            # print(f"width: {width}, height: {height}")
            return width, height
        # 判断是URL还是本地文件
        parsed = urlparse(image_url)
        is_url = bool(parsed.scheme and parsed.netloc)
        
        # 获取图片数据
        if is_url:
            response = requests.get(image_url)
            image_data = response.content
            # 从URL或Content-Type获取MIME类型
            content_type = response.headers.get('content-type')
            if not content_type:
                content_type = mimetypes.guess_type(image_url)[0] or 'image/png'
        else:
            # 处理本地文件
            with open(image_url, 'rb') as f:
                image_data = f.read()
            content_type = mimetypes.guess_type(image_url)[0] or 'image/png'
        
        img = PILImage.open(BytesIO(image_data))
        width, height = img.size
        return width, height
        # except Exception as e:
        #     print(f"Error processing image {image_url}: {str(e)}")
        #     return None
        
    def get_bounding_box(self) -> BoundingBox:
        if self.base64:
            if self.original_width == 0 and self.original_height == 0:
                img = PILImage.open(BytesIO(base64.b64decode(self.base64.split(',')[1])))
                self.original_width, self.original_height = img.size
            self.aspect_ratio = self.original_width / self.original_height
            # print(f"self.aspect_ratio: {self.aspect_ratio}")
        if self.attributes.get('preserveAspectRatio', 'None') == 'None':
            width = float(self.attributes.get('width', 20))
            height = float(self.attributes.get('height', 20))
        else:
            set_width = float(self.attributes.get('width', 20))
            set_height = float(self.attributes.get('height', 20))
            # 计算缩放比例,取较小值以保持横纵比
            scale = min(set_width / self.original_width, set_height / self.original_height)
            # 按比例计算实际宽高
            width = self.original_width * scale
            height = self.original_height * scale

        transform = self.get_transform_matrix
        x = float(self.attributes.get('x', 0))
        y = float(self.attributes.get('y', 0))
        min_x = x
        min_y = y
        max_x = x + width
        max_y = y + height
        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                # 如果是两个矩阵,进行两次变换
                bbox1 = self._apply_transform(min_x, min_y, max_x, max_y, transform[0])
                bbox2 = self._apply_transform(bbox1.minx, bbox1.miny, bbox1.maxx, bbox1.maxy, transform[1])
                return BoundingBox(bbox2.maxx - bbox2.minx, bbox2.maxy - bbox2.miny, bbox2.minx, bbox2.maxx, bbox2.miny, bbox2.maxy)
            else:
                bbox = self._apply_transform(min_x, min_y, max_x, max_y, transform)
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        else:
            return BoundingBox(max_x - min_x, max_y - min_y, min_x, max_x, min_y, max_y)

    def update_scale(self, scale_x: float, scale_y: float):
        # old_bounding_box = self.get_bounding_box()
        if self._bounding_box:
            old_bounding_box = self._bounding_box
        else:
            old_bounding_box = self.get_bounding_box()
        if scale_x >= 1 and scale_y >= 1:
            scale = max(scale_x, scale_y)
        else:
            scale = min(scale_x, scale_y)
        new_transform = f"scale({scale})"
        current_transform = self.attributes.get('transform', '')
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform}"
        else:
            self.attributes['transform'] = new_transform
        new_bounding_box = self.get_bounding_box()
        # 通过添加translate使得新的bounding box与旧的bounding box的中心重合
        translate_x = (old_bounding_box.minx + old_bounding_box.maxx) / 2 - (new_bounding_box.minx + new_bounding_box.maxx) / 2
        translate_y = (old_bounding_box.miny + old_bounding_box.maxy) / 2 - (new_bounding_box.miny + new_bounding_box.maxy) / 2
        self._bounding_box.minx += translate_x
        self._bounding_box.maxx += translate_x
        self._bounding_box.miny += translate_y
        self._bounding_box.maxy += translate_y
        self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"

    def update_pos(self, old_min_x: float, old_min_y: float):
        current_transform = self.attributes.get('transform', '')
        new_transform = f"translate({self._bounding_box.minx - old_min_x}, {self._bounding_box.miny - old_min_y})"
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform}"
        else:
            self.attributes['transform'] = new_transform

    def _dump_extra_info(self) -> List[str]:
        return [""]

class Text(AtomElement):
    """文本元素"""
    def __init__(self, content: str=None):
        super().__init__()
        self.content = content
        self.tag = 'text'

    @staticmethod
    def _measure_text(text: str, font_size: float, anchor: str = 'left top') -> Dict[str, float]:

        def merge_bounding_boxes(bounding_boxes):
            """合并所有有实际文字内容的boundingbox"""
            min_x = min(box['x'] for box in bounding_boxes)
            min_y = min(box['y'] for box in bounding_boxes)
            max_x = max(box['x'] + box['width'] for box in bounding_boxes)
            max_y = max(box['y'] + box['height'] for box in bounding_boxes)
            ascent = max(box['ascent'] for box in bounding_boxes)
            descent = min(box['descent'] for box in bounding_boxes)
            return {
                'x': min_x,
                'y': min_y,
                'width': max_x - min_x,
                'height': max_y - min_y,
                'ascent': ascent,
                'descent': descent
            }
        # try:
        #     # 创建SVG内容
        #     svg_content = f"""
        #     <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        #         <text x="0" y="{font_size}" font-size="{font_size}">{text}</text>
        #     </svg>
        #     """
        #     # print(f"text: {text}, font_size: {font_size}")
        #     time_stamp = time.time()
        #     svg_path = f'text_{time_stamp}.svg'
        #     with open(svg_path, 'w') as f:
        #         f.write(svg_content)
        #     # 转换为PNG
        #     png_path = svg_path.replace('.svg', '.png')
        #     cairosvg.svg2png(url=svg_path, write_to=png_path)

        #     # OCR识别
        #     img = PILImage.open(png_path)
        #     result = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        #     # print("result: ", result)
        #     # 删除临时文件
        #     os.remove(svg_path)
        #     os.remove(png_path)

        #     # print(f"result: {result}")
        #     # 把所有有实际文字内容的boundingbox合并
        #     bounding_boxes = []
        #     for i in range(len(result['text'])):
        #         if result['text'][i]:
        #             bounding_boxes.append({
        #                 'x': result['left'][i],
        #                 'y': result['top'][i],
        #                 'width': result['width'][i],
        #                 'height': result['height'][i],
        #                 'ascent': result['height'][i],
        #                 'descent': result['height'][i]
        #             })
        #     # 合并boundingbox
        #     merged_bounding_box = merge_bounding_boxes(bounding_boxes)
        #     width = merged_bounding_box['width']
        #     height = merged_bounding_box['height']
        #     ascent = merged_bounding_box['ascent']
        #     descent = merged_bounding_box['descent']
        #     return {
        #         'width': width,
        #         'height': height,
        #         'ascent': ascent,
        #         'descent': descent
        #     }
        # except Exception as e:
        # print(f"测量文本时出错: {e}")
        # char_sizes_dict = json.load(open('/data1/liduan/generation/chart/chart_pipeline/src/processors/svg_processor_modules/text_tool/char_sizes_dict.json'))
        file_path = os.path.join(project_dir, 'src/processors/svg_processor_modules/text_tool/char_sizes_dict.json')
        char_sizes_dict = json.load(open(file_path, 'r'))
        width = 0
        height = 0
        ascent = 0
        descent = 0
        for char in text:
            if char in char_sizes_dict:
                width += char_sizes_dict[char]['width'] * font_size
                height = max(height, char_sizes_dict[char]['height'] * font_size)
                ascent = max(ascent, char_sizes_dict[char]['ascent'] * font_size)
                descent = min(descent, char_sizes_dict[char]['descent'] * font_size)
            else:
                width += char_sizes_dict['a']['width'] * font_size
                height = max(height, char_sizes_dict['a']['height'] * font_size)
                ascent = max(ascent, char_sizes_dict['a']['ascent'] * font_size)
                descent = min(descent, char_sizes_dict['a']['descent'] * font_size)
        return {
            'width': width,
            'height': height,
            'ascent': ascent,
            'descent': descent
        }
        #     print(f"测量文本时出错: {e}")
        #     return {
        #         'width': 0,
        #         'height': 0,
        #         'ascent': 0,
        #         'descent': 0
        #     }
        # data = {
        #     'text': text,
        #     'fontSize': font_size,
        #     'anchor': anchor
        # }
        # # 读取char_sizes_dict.json
        # char_sizes_dict = json.load(open('/data1/liduan/generation/chart/chart_pipeline/src/processors/svg_processor_modules/text_tool/char_sizes_dict.json'))
        # width = 0
        # height = 0
        # ascent = 0
        # descent = 0
        # for char in text:
        #     if char in char_sizes_dict:
        #         width += char_sizes_dict[char]['width'] * font_size
        #         height = max(height, char_sizes_dict[char]['height'] * font_size)
        #         ascent = max(ascent, char_sizes_dict[char]['ascent'] * font_size)
        #         descent = min(descent, char_sizes_dict[char]['descent'] * font_size)
        #     else:
        #         width += char_sizes_dict['a']['width'] * font_size
        #         height = max(height, char_sizes_dict['a']['height'] * font_size)
        #         ascent = max(ascent, char_sizes_dict['a']['ascent'] * font_size)
        #         descent = min(descent, char_sizes_dict['a']['descent'] * font_size)
        # return {
        #     'width': width,
        #     'height': height,
        #     'ascent': ascent,
        #     'descent': descent
        # }

        # """使用Node.js的TextToSVG库测量文本尺寸"""
        # try:
        #     data = {
        #         'text': text,
        #         'fontSize': font_size,
        #         'anchor': anchor
        #     }
        #     # print('data: ', data)
        #     measure_script_path = os.path.join(os.path.dirname(__file__), 'text_tool', 'measure_text.js')
        #     result = node_bridge.execute_node_script(
        #         measure_script_path,
        #         data
        #     )
        #     metrics = json.loads(result)
        #     return metrics
        # except Exception as e:
        #     print(f"测量文本时出错: {e}")
        #     # 回退到估算方法
        #     return {
        #         'width': len(text) * font_size * 0.6,
        #         'height': font_size * 1.2,
        #         'ascent': font_size,
        #         'descent': 0
        #     }

    def update_pos(self, old_min_x: float, old_min_y: float):
        current_transform = self.attributes.get('transform', '')
        new_transform = f"translate({self._bounding_box.minx - old_min_x}, {self._bounding_box.miny - old_min_y})"
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform} "
        else:
            self.attributes['transform'] = new_transform
        # if 'x' in self.attributes:
        #     self.attributes['x'] += self._bounding_box.minx - old_min_x
        # else:
        #     self.attributes['x'] = self._bounding_box.minx - old_min_x
        # if 'y' in self.attributes:
        #     self.attributes['y'] += self._bounding_box.miny - old_min_y
        # else:
        #     self.attributes['y'] = self._bounding_box.miny - old_min_y
    def update_scale(self, scale_x: float, scale_y: float):
        print("update_scale: ", scale_x, scale_y)
        # old_bounding_box = self.get_bounding_box()
        if self._bounding_box:
            old_bounding_box = self._bounding_box
        else:
            old_bounding_box = self.get_bounding_box()
        if scale_x >= 1 and scale_y >= 1:
            scale = max(scale_x, scale_y)
        else:
            scale = min(scale_x, scale_y)
        new_transform = f"scale({scale})"
        current_transform = self.attributes.get('transform', '')
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform}"
        else:
            self.attributes['transform'] = new_transform
        new_bounding_box = self.get_bounding_box()
        # 通过添加translate使得新的bounding box与旧的bounding box的中心重合
        translate_x = (old_bounding_box.minx + old_bounding_box.maxx) / 2 - (new_bounding_box.minx + new_bounding_box.maxx) / 2
        translate_y = (old_bounding_box.miny + old_bounding_box.maxy) / 2 - (new_bounding_box.miny + new_bounding_box.maxy) / 2
        self._bounding_box.minx += translate_x
        self._bounding_box.maxx += translate_x
        self._bounding_box.miny += translate_y
        self._bounding_box.maxy += translate_y
        self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"

        return scale

    def get_bounding_box(self) -> BoundingBox:
        transform = self.get_transform_matrix
        text = self.content
        # if len(text) <= 2:
        #     text = "Lj"
        # else:
        #     text = text[:-2] + "ly"
        x = float(self.attributes.get('x', 0))
        y = float(self.attributes.get('y', 0))
        dx = float(self.attributes.get('dx', 0))
        dy = float(self.attributes.get('dy', 0))
        # font_size = float(self.attributes.get('font-size', 16))
        raw_font_size = self.attributes.get('font-size')
        text_anchor = self.attributes.get('text-anchor', 'start')
        if raw_font_size and type(raw_font_size) == str:
            font_size = self._parse_length(raw_font_size)
        elif raw_font_size and (type(raw_font_size) == int or type(raw_font_size) == float):
            font_size = raw_font_size
        else:
            font_size = parent_font_size if parent_font_size else 16

        metrics = self._measure_text(text, font_size, text_anchor)
        width = metrics['width']
        height = metrics['height']

        if text_anchor == 'middle':
            x -= width / 2
        elif text_anchor == 'end':
            x -= width
        # print("metrics: ", metrics)
        x += dx
        y += dy - metrics['ascent']

        min_x = x
        min_y = y
        max_x = x + width
        max_y = y + height
        # print('text: ', self.content)
        # print('bounding_box: ', height, width)
        # print("min_x: ", min_x, "min_y: ", min_y, "max_x: ", max_x, "max_y: ", max_y)
        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                # 如果是两个矩阵,进行两次变换
                bbox1 = self._apply_transform(min_x, min_y, max_x, max_y, transform[0])
                bbox2 = self._apply_transform(bbox1.minx, bbox1.miny, bbox1.maxx, bbox1.maxy, transform[1])
                return BoundingBox(bbox2.maxx - bbox2.minx, bbox2.maxy - bbox2.miny, bbox2.minx, bbox2.maxx, bbox2.miny, bbox2.maxy)
            else:
                bbox = self._apply_transform(min_x, min_y, max_x, max_y, transform)
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        else:
            return BoundingBox(max_x - min_x, max_y - min_y, min_x, max_x, min_y, max_y)

    def rotate_to_fit(self, direction: str = 'top'):
        old_bounding_box = self.get_bounding_box()
        # 先rotate270度
        new_transform = f"rotate(270)"
        current_transform = self.attributes.get('transform', '')
        if current_transform:
            self.attributes['transform'] = f"{new_transform} {current_transform}"
        else:
            self.attributes['transform'] = new_transform
        new_bounding_box = self.get_bounding_box()
        # 通过添加translate使得新的bounding box与旧的bounding box的中心重合
        if direction == 'top':
            baseline_y = old_bounding_box.miny
            baseline_x = (old_bounding_box.minx+old_bounding_box.maxx)/2
            translate_y = baseline_y - new_bounding_box.miny
            translate_x = baseline_x - (new_bounding_box.minx+new_bounding_box.maxx)/2
            self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"
        elif direction == 'bottom':
            baseline_y = old_bounding_box.maxy
            baseline_x = (old_bounding_box.minx+old_bounding_box.maxx)/2
            translate_y = baseline_y - new_bounding_box.maxy
            translate_x = baseline_x - (new_bounding_box.minx+new_bounding_box.maxx)/2
            self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"

    def scale_to_fit(self, scale: float):
        old_bounding_box = self.get_bounding_box()
        # if self._bounding_box:
        #     old_bounding_box = self._bounding_box
        # else:
        #     old_bounding_box = self.get_bounding_box()
        current_transform = self.attributes.get('transform', '')
        # 检查rotate是否在transform中
        rotate_flag = False
        if 'rotate' in current_transform:
            rotate_flag = True
        self.update_scale(scale, scale)
        # new_bounding_box = self.get_bounding_box()
        new_bounding_box = self._bounding_box
        text_anchor = self.attributes.get('text-anchor', 'start')
        if rotate_flag and text_anchor == 'end':
            baseline_y = old_bounding_box.miny
            baseline_x = (old_bounding_box.minx+old_bounding_box.maxx)/2
            translate_y = baseline_y - new_bounding_box.miny
            translate_x = baseline_x - (new_bounding_box.minx+new_bounding_box.maxx)/2
            self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"
        elif rotate_flag and (text_anchor == 'start' or text_anchor == 'middle'):
            baseline_y = old_bounding_box.maxy
            baseline_x = (old_bounding_box.minx+old_bounding_box.maxx)/2
            translate_y = baseline_y - new_bounding_box.maxy
            translate_x = baseline_x - (new_bounding_box.minx+new_bounding_box.maxx)/2
            self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"
        elif not rotate_flag and text_anchor == 'end':
            baseline_y = (old_bounding_box.miny+old_bounding_box.maxy)/2
            baseline_x = old_bounding_box.maxx
            translate_y = baseline_y - (new_bounding_box.miny+new_bounding_box.maxy)/2
            translate_x = baseline_x - new_bounding_box.maxx
            self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"
        elif not rotate_flag and (text_anchor == 'start' or text_anchor == 'middle'):
            baseline_y = (old_bounding_box.miny+old_bounding_box.maxy)/2
            baseline_x = old_bounding_box.minx
            translate_y = baseline_y - (new_bounding_box.miny+new_bounding_box.maxy)/2
            translate_x = baseline_x - new_bounding_box.minx
            self.attributes['transform'] = f"translate({translate_x}, {translate_y}) {self.attributes['transform']}"


    def _parse_length(self, value: str) -> float:
        """解析单位的长度值"""
        if not value:
            return 0

        # 移除所有空白字符
        value = value.strip()

        # 处理带px单位的值
        if value.endswith('px'):
            return float(value[:-2])
        # 处理带em单位的值
        elif value.endswith('em'):
            if font_size is None:
                font_size = 16
            return float(value[:-2]) * font_size
        # 尝试直接转换为浮点数
        try:
            return float(value)
        except ValueError:
            return 0


    def _dump_extra_info(self) -> List[str]:
        return [f"Content: {self.content}"]

class Graphical(AtomElement):
    """图形元素基类"""
    pass

class Rect(Graphical):
    """矩形元素"""
    def __init__(self):
        super().__init__()
        self.tag = 'rect'

    def get_bounding_box(self) -> BoundingBox:
        transform = self.get_transform_matrix
        x = float(self.attributes.get('x', 0))
        y = float(self.attributes.get('y', 0))
        width = float(self.attributes.get('width', 0))
        height = float(self.attributes.get('height', 0))
        # print("attributes: ", self.attributes)

        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                # 如果是两个矩阵,进行两次变换
                bbox1 = self._apply_transform(x, y, width, height, transform[0])
                bbox2 = self._apply_transform(bbox1.maxx, bbox1.maxy, width, height, transform[1])
                return BoundingBox(bbox2.maxx - bbox2.minx, bbox2.maxy - bbox2.miny, bbox2.minx, bbox2.maxx, bbox2.miny, bbox2.maxy)
            else:
                bbox = self._apply_transform(x, y, width, height, transform)
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        else:
            return BoundingBox(width, height, x, x + width, y, y + height)


    def _dump_extra_info(self) -> List[str]:
        return []

class Line(Graphical):
    """线段元素"""
    def __init__(self, x1: float, x2: float, y1: float, y2: float):
        super().__init__()
        self.x1 = x1
        self.x2 = x2
        self.y1 = y1
        self.y2 = y2
        self.tag = 'line'

    def get_bounding_box(self) -> BoundingBox:
        transform = self.get_transform_matrix
        x1 = float(self.attributes.get('x1', 0))
        y1 = float(self.attributes.get('y1', 0))
        x2 = float(self.attributes.get('x2', 0))
        y2 = float(self.attributes.get('y2', 0))
        stroke_width = float(self.attributes.get('stroke-width', 1))

        if x1==x2:
            x1 -= stroke_width / 2
            x2 += stroke_width / 2
        if y1==y2:
            y1 -= stroke_width / 2
            y2 += stroke_width / 2

        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                # 如果是两个矩阵,进行两次变换
                bbox1 = self._apply_transform(x1, y1, x2, y2, transform[0])
                bbox2 = self._apply_transform(bbox1.maxx, bbox1.maxy, x2, y2, transform[1])
                return BoundingBox(bbox2.maxx - bbox2.minx, bbox2.maxy - bbox2.miny, bbox2.minx, bbox2.maxx, bbox2.miny, bbox2.maxy)
            else:
                bbox = self._apply_transform(x1, y1, x2, y2, transform)
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        else:
            return BoundingBox(abs(x2 - x1), abs(y2 - y1), min(x1, x2), max(x1, x2), min(y1, y2), max(y1, y2))

    def _dump_extra_info(self) -> List[str]:
        return [f"Line: ({self.x1:.2f}, {self.y1:.2f}) -> ({self.x2:.2f}, {self.y2:.2f})"]

class Path(Graphical):
    """路径元素"""
    def __init__(self, params: str):
        super().__init__()
        self.params = params
        self.tag = 'path'
        self.anchor_points = {}
        self.arcs = {}
        self.cx = None
        self.cy = None
        self.r = None
    def _parse_path(self, d: str) -> List[Dict]:
        """解析SVG路径的'd'属性"""
        commands = []
        # 匹配命令字母和后面的数字
        pattern = r'([a-zA-Z])([^a-zA-Z]*)'
        matches = re.finditer(pattern, d)

        for match in matches:
            command = match.group(1)
            # 将数字字符串分割并转换为浮点数
            points_str = match.group(2).strip()
            # 同时处理空格和逗号作为分隔符
            points = [float(p) for p in re.split(r'[\s,]+', points_str) if p]
            commands.append({
                'command': command,
                'points': points
            })

        return commands

    def _get_path_coordinates(self) -> List[float]:
        """获取路径的坐标点"""
        attrs = self.attributes
        d = attrs.get('d', '')
        commands = self._parse_path(d)
        transform = self.get_transform_matrix

        coordinates = []
        # 遍历所有路径命令
        for cmd in commands:
            command = cmd['command']
            points = cmd['points']

            if command in ['M', 'm']:  # 移动命令
                if command == 'm':  # 相对坐标
                    current_x += points[0]
                    current_y += points[1]
                else:  # 绝对坐标
                    current_x = points[0]
                    current_y = points[1]

                # 应用变换
                if transform:
                    transformed_point = self._apply_matrix(current_x, current_y, transform)
                    current_x, current_y = transformed_point

                last_move_x = current_x
                last_move_y = current_y

                coordinates.append((current_x, current_y))
            elif command in ['L', 'l']:  # 直线命令
                end_x = points[0] if command == 'L' else current_x + points[0]
                end_y = points[1] if command == 'L' else current_y + points[1]

                # 应用变换
                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                current_x = end_x
                current_y = end_y
                coordinates.append((current_x, current_y))
            elif command in ['H', 'h']:  # 水平线命令
                end_x = points[0] if command == 'H' else current_x + points[0]
                end_y = current_y

                # 应用变换
                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                current_x = end_x
                current_y = end_y
                coordinates.append((current_x, current_y))
            elif command in ['V', 'v']:  # 垂直线命令
                end_x = current_x
                end_y = points[0] if command == 'V' else current_y + points[0]

                # 应用变换
                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                current_x = end_x
                current_y = end_y
                coordinates.append((current_x, current_y))
            elif command in ['Z', 'z']:  # 闭合路径命令

                current_x = last_move_x
                current_y = last_move_y
                coordinates.append((current_x, current_y))
            elif command in ['C', 'c']:  # 三次贝塞尔曲线
                # 对于贝塞尔曲线，我们使用简化的检查方法
                # 将曲线分解为多个线段进行近似检查
                if command == 'c':  # 相对坐标转换为绝对坐标
                    points = [
                        current_x + points[0], current_y + points[1],  # 控制点1
                        current_x + points[2], current_y + points[3],  # 控制点2
                        current_x + points[4], current_y + points[5]   # 终点
                    ]
                else:
                    points = points.copy()  # 复制一份以免修改原始数据

                # 应用变换到所有控制点
                if transform:
                    for i in range(0, len(points), 2):
                        transformed_point = self._apply_matrix(points[i], points[i+1], transform)
                        points[i], points[i+1] = transformed_point
                    transformed_start = self._apply_matrix(current_x, current_y, transform)
                    current_x, current_y = transformed_start

                # 使用德卡斯特里奥算法将曲线分成多个点
                curve_points = self._get_bezier_points(
                    (current_x, current_y),
                    (points[0], points[1]),
                    (points[2], points[3]),
                    (points[4], points[5]),
                    50  # 分段数
                )
                coordinates.extend(curve_points)

                current_x = points[4]
                current_y = points[5]
            elif command == 'A':  # 弧形命令
                # A命令的参数: rx ry x-axis-rotation large-arc-flag sweep-flag x y
                rx, ry = points[0], points[1]
                x_axis_rotation = points[2]
                large_arc_flag = points[3]
                sweep_flag = points[4]
                end_x, end_y = points[5], points[6]



                # 计算圆心
                cos_angle = math.cos(-x_axis_rotation * math.pi / 180)
                sin_angle = math.sin(-x_axis_rotation * math.pi / 180)

                # 将终点坐标转换到起点坐标系
                rel_x = end_x - current_x
                rel_y = end_y - current_y
                # 应用旋转
                x1 = rel_x * cos_angle - rel_y * sin_angle
                y1 = rel_x * sin_angle + rel_y * cos_angle

                # 确保半径足够大
                rx = abs(rx)
                ry = abs(ry)
                x1_prime = x1 / 2
                y1_prime = y1 / 2

                # 确保半径满足要求
                radius_check = (x1_prime * x1_prime) / (rx * rx) + (y1_prime * y1_prime) / (ry * ry)
                if radius_check > 1:
                    rx *= math.sqrt(radius_check)
                    ry *= math.sqrt(radius_check)

                # 计算圆心
                sign = -1 if large_arc_flag == sweep_flag else 1
                numerator = (rx * rx) * (ry * ry) - (rx * rx) * (y1_prime * y1_prime) - (ry * ry) * (x1_prime * x1_prime)
                denominator = (rx * rx) * (y1_prime * y1_prime) + (ry * ry) * (x1_prime * x1_prime)
                c = sign * math.sqrt(max(0, numerator / denominator))

                cx1 = c * ((rx * y1_prime) / ry)
                cy1 = c * (-(ry * x1_prime) / rx)

                # 将圆心转回原始坐标系
                cx = (cos_angle * cx1 - sin_angle * cy1) + current_x
                cy = (sin_angle * cx1 + cos_angle * cy1) + current_y
                


                # 计算起始角度和结束角度
                start_angle = math.atan2((current_y - cy) / ry, (current_x - cx) / rx)
                end_angle = math.atan2((end_y - cy) / ry, (end_x - cx) / rx)

                # 考虑 sweep_flag 的方向
                if sweep_flag == 0 and end_angle > start_angle:
                    end_angle -= 2 * math.pi
                elif sweep_flag == 1 and end_angle < start_angle:
                    end_angle += 2 * math.pi

                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                # 处理large_arc_flag为1的情况
                if large_arc_flag == 1:
                    # 如果角度差小于π,需要加上2π
                    if end_angle - start_angle < math.pi:
                        end_angle += 2 * math.pi
                    # 如果角度差大于-π,需要减去2π
                    elif end_angle - start_angle > -math.pi:
                        start_angle += 2 * math.pi
                # 采样点
                num_samples = 20
                samples = []
                for i in range(num_samples + 1):
                    theta = start_angle + (end_angle - start_angle) * (i / num_samples)
                    sample_x = cx + rx * math.cos(theta)
                    sample_y = cy + ry * math.sin(theta)
                    samples.append((sample_x, sample_y))

                if transform:
                    for i in range(len(samples)):
                        transformed_sample = self._apply_matrix(samples[i][0], samples[i][1], transform)
                        samples[i] = transformed_sample

                # return samples
                coordinates.extend(samples)
                current_x = end_x
                current_y = end_y

        return coordinates
    def get_bounding_box(self) -> BoundingBox:
        attrs = self.attributes
        d = attrs.get('d', '')
        if not d:
            return BoundingBox(0, 0, 0, 0, 0, 0)
        # print("d: ", d)

        commands = self._parse_path(d)
        minX = float('inf')
        minY = float('inf')
        maxX = float('-inf')
        maxY = float('-inf')

        current_x = 0
        current_y = 0

        for cmd in commands:
            command = cmd['command']
            points = cmd['points']
            if command == 'M' or command == 'm':
                current_x = points[0]
                current_y = points[1]
                minX = min(minX, current_x)
                minY = min(minY, current_y)
                maxX = max(maxX, current_x)
                maxY = max(maxY, current_y)
            elif command == 'L' or command == 'l':
                current_x = points[0]
                current_y = points[1]
                minX = min(minX, current_x)
                minY = min(minY, current_y)
                maxX = max(maxX, current_x)
                maxY = max(maxY, current_y)
            elif command == 'H' or command == 'h':
                current_x += points[0]
                minX = min(minX, current_x)
                maxX = max(maxX, current_x)
            elif command == 'V' or command == 'v':
                current_y += points[0]
                minY = min(minY, current_y)
                maxY = max(maxY, current_y)
            elif command == 'C':  # 三次贝塞尔曲线
                # 控制点和终点都可能影响边界框
                for i in range(0, len(points), 2):
                    x, y = points[i], points[i+1]
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                current_x = points[-2]
                current_y = points[-1]
            elif command == 'A':
                # A命令的参数: rx ry x-axis-rotation large-arc-flag sweep-flag x y
                # print("d: ", d)
                print("points: ", points)
                rx, ry = points[0], points[1]
                x_axis_rotation = points[2]
                large_arc_flag = points[3]
                sweep_flag = points[4]
                end_x, end_y = points[5], points[6]

                self.arcs[(current_x, current_y)] = {
                    'rx': rx,
                    'ry': ry,
                    'x_axis_rotation': x_axis_rotation,
                    'large_arc_flag': large_arc_flag,
                    'sweep_flag': sweep_flag,
                }

                # 计算圆心
                # 步骤1: 将终点相对于起点进行旋转，使x轴旋转角度为0
                cos_angle = math.cos(-x_axis_rotation * math.pi / 180)
                sin_angle = math.sin(-x_axis_rotation * math.pi / 180)

                # 将终点坐标转换到起点坐标系
                rel_x = end_x - current_x
                rel_y = end_y - current_y
                # 应用旋转
                x1 = rel_x * cos_angle - rel_y * sin_angle
                y1 = rel_x * sin_angle + rel_y * cos_angle

                # 确保半径足够大
                rx = abs(rx)
                ry = abs(ry)
                x1_prime = x1 / 2
                y1_prime = y1 / 2

                # 确保半径满足要求
                radius_check = (x1_prime * x1_prime) / (rx * rx) + (y1_prime * y1_prime) / (ry * ry)
                if radius_check > 1:
                    rx *= math.sqrt(radius_check)
                    ry *= math.sqrt(radius_check)



                # # 计算 sq
                # sq = ((rx*rx*ry*ry) - (rx*rx*y1_prime*y1_prime) - (ry*ry*x1_prime*x1_prime)) / ((rx*y1_prime) + (ry*x1_prime))**2
                # sq = max(0, sq)  # 确保 sq 不为负数
                # print("sq: ", sq)

                # 计算系数
                sign = -1 if large_arc_flag == sweep_flag else 1
                # coef = sign * math.sqrt(sq)
                # print("coef: ", coef)

                # 计算 c
                numerator = (rx * rx) * (ry * ry) - (rx * rx) * (y1_prime * y1_prime) - (ry * ry) * (x1_prime * x1_prime)
                denominator = (rx * rx) * (y1_prime * y1_prime) + (ry * ry) * (x1_prime * x1_prime)
                c = sign * math.sqrt(max(0, numerator / denominator))

                # 计算圆心在旋转后的坐标系中的坐标
                cx1 = c * ((rx * y1_prime) / ry)
                cy1 = c * (-(ry * x1_prime) / rx)

                # 步骤3: 将圆心转回原始坐标系
                cx = (cos_angle * cx1 - sin_angle * cy1) - current_x - x1_prime
                cy = (sin_angle * cx1 + cos_angle * cy1) - current_y - y1_prime
                # 计算起始角度和结束角度
                start_angle = math.atan2((current_y - cy) / ry, (current_x - cx) / rx)
                end_angle = math.atan2((end_y - cy) / ry, (end_x - cx) / rx)


                if self.cx is None:
                    self.cx = cx
                else:
                    self.cx = (self.cx+cx)/2
                if self.cy is None:
                    self.cy = cy
                else:
                    self.cy = (self.cy+cy)/2
                # if self.r is None:
                #     self.r = rx
                # else:
                #     self.r = min(self.r, rx)
                print("rx: ", rx)
                print("ry: ", ry)
                print("self.cx: ", self.cx)
                print("self.cy: ", self.cy)
                print("start_angle: ", start_angle)
                print("end_angle: ", end_angle)
                # 处理large_arc_flag为1的情况
                if large_arc_flag == 1:
                    # 如果角度差小于π,需要加上2π
                    if end_angle - start_angle < math.pi:
                        end_angle += 2 * math.pi
                    # 如果角度差大于-π,需要减去2π
                    elif end_angle - start_angle > -math.pi:
                        start_angle += 2 * math.pi
                elif large_arc_flag == 0:
                    # 如果角度差大于π,需要减去2π
                    if end_angle - start_angle > math.pi:
                        start_angle -= 2 * math.pi
                    # 如果角度差小于-π,需要加上2π
                    elif end_angle - start_angle < -math.pi:
                        end_angle += 2 * math.pi
                print("large_arc_flag: ", large_arc_flag)
                print("start_angle: ", start_angle)
                print("end_angle: ", end_angle)
                # 采样点
                num_samples = 20
                for i in range(num_samples + 1):
                    theta = start_angle + (end_angle - start_angle) * (i / num_samples)
                    sample_x = cx + rx * math.cos(theta)
                    sample_y = cy + ry * math.sin(theta)
                    print("theta: ", theta)
                    if i == num_samples//2:
                        self.arcs[(current_x, current_y)]['center'] = (sample_x, sample_y)
                        # outer是沿着圆心到(sample_x, sample_y)再走过25的距离
                        self.arcs[(current_x, current_y)]['outer'] = (sample_x + 25 * math.cos(theta), sample_y + 25 * math.sin(theta))
                        # print("self.arcs[(current_x, current_y)]['center']: ", self.arcs[(current_x, current_y)]['center'])
                    minX = min(minX, sample_x)
                    minY = min(minY, sample_y)
                    maxX = max(maxX, sample_x)
                    maxY = max(maxY, sample_y)
                    print("sample_x, sample_y: ", sample_x, sample_y)
                    print("minX, minY, maxX, maxY: ", minX, minY, maxX, maxY)
                    # if rx > 70:
                    #     print("sample_x, sample_y: ", sample_x, sample_y)
                # 确保起点和终点也包含在边界框内
                minX = min(minX, current_x, end_x)
                minY = min(minY, current_y, end_y)
                maxX = max(maxX, current_x, end_x)
                maxY = max(maxY, current_y, end_y)
                transform = self.get_transform_matrix

                if transform:
                    self.arcs[(current_x, current_y)]['center'] = self._apply_matrix(self.arcs[(current_x, current_y)]['center'][0], self.arcs[(current_x, current_y)]['center'][1], transform)
                    self.arcs[(current_x, current_y)]['outer'] = self._apply_matrix(self.arcs[(current_x, current_y)]['outer'][0], self.arcs[(current_x, current_y)]['outer'][1], transform)
                current_x = end_x
                current_y = end_y

        # 处理变换
        transform = self.get_transform_matrix

        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                bbox = self._apply_transform(minX, minY, maxX, maxY, transform[0])
                bbox = self._apply_transform(bbox.maxx, bbox.maxy, maxX, maxY, transform[1])
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
            bbox = self._apply_transform(minX, minY, maxX, maxY, transform)
            if self.attributes.get('stroke-width', None) is not None:
                stroke_width = float(self.attributes['stroke-width'])
                bbox.minx -= stroke_width/2
                bbox.miny -= stroke_width/2
                bbox.maxx += stroke_width/2
                bbox.maxy += stroke_width/2
            return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        if self.attributes.get('stroke-width', None) is not None:
            stroke_width = float(self.attributes['stroke-width'])
            bbox.minx -= stroke_width/2
            bbox.miny -= stroke_width/2
            bbox.maxx += stroke_width/2
            bbox.maxy += stroke_width/2
        return BoundingBox(maxX - minX, maxY - minY, minX, maxX, minY, maxY)

    def is_intersect(self, other: BoundingBox) -> bool:
        """判断路径是否与给定的边界框相交

        Args:
            other: 要检查的边界框

        Returns:
            bool: 如果路径与边界框相交返回True，否则返回False
        """
        # 首先进行快速边界框检查
        path_bbox = self.get_bounding_box()
        if not path_bbox.is_overlapping(other):
            return False

        # 解析路径命令
        d = self.attributes.get('d', '')
        if not d:
            return False

        # 获取变换矩阵
        transform = self.get_transform_matrix

        commands = self._parse_path(d)
        current_x = 0
        current_y = 0
        last_move_x = 0  # 记录上一个M命令的位置
        last_move_y = 0

        # 遍历所有路径命令
        for cmd in commands:
            command = cmd['command']
            points = cmd['points']

            if command in ['M', 'm']:  # 移动命令
                if command == 'm':  # 相对坐标
                    current_x += points[0]
                    current_y += points[1]
                else:  # 绝对坐标
                    current_x = points[0]
                    current_y = points[1]

                # 应用变换
                if transform:
                    transformed_point = self._apply_matrix(current_x, current_y, transform)
                    current_x, current_y = transformed_point

                last_move_x = current_x
                last_move_y = current_y

            elif command in ['L', 'l']:  # 直线命令
                end_x = points[0] if command == 'L' else current_x + points[0]
                end_y = points[1] if command == 'L' else current_y + points[1]

                # 应用变换
                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                # 检查线段是否与边界框相交
                if self._line_intersects_box(current_x, current_y, end_x, end_y, other):
                    return True

                current_x = end_x
                current_y = end_y

            elif command in ['H', 'h']:  # 水平线命令
                end_x = points[0] if command == 'H' else current_x + points[0]
                end_y = current_y

                # 应用变换
                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                # 检查水平线是否与边界框相交
                if self._line_intersects_box(current_x, current_y, end_x, end_y, other):
                    return True

                current_x = end_x
                current_y = end_y

            elif command in ['V', 'v']:  # 垂直线命令
                end_x = current_x
                end_y = points[0] if command == 'V' else current_y + points[0]

                # 应用变换
                if transform:
                    transformed_end = self._apply_matrix(end_x, end_y, transform)
                    end_x, end_y = transformed_end

                # 检查垂直线是否与边界框相交
                if self._line_intersects_box(current_x, current_y, end_x, end_y, other):
                    return True

                current_x = end_x
                current_y = end_y

            elif command in ['Z', 'z']:  # 闭合路径命令
                # 检查到起始点的连线是否与边界框相交
                if self._line_intersects_box(current_x, current_y, last_move_x, last_move_y, other):
                    return True

                current_x = last_move_x
                current_y = last_move_y

            elif command in ['C', 'c']:  # 三次贝塞尔曲线
                # 对于贝塞尔曲线，我们使用简化的检查方法
                # 将曲线分解为多个线段进行近似检查
                if command == 'c':  # 相对坐标转换为绝对坐标
                    points = [
                        current_x + points[0], current_y + points[1],  # 控制点1
                        current_x + points[2], current_y + points[3],  # 控制点2
                        current_x + points[4], current_y + points[5]   # 终点
                    ]
                else:
                    points = points.copy()  # 复制一份以免修改原始数据

                # 应用变换到所有控制点
                if transform:
                    for i in range(0, len(points), 2):
                        transformed_point = self._apply_matrix(points[i], points[i+1], transform)
                        points[i], points[i+1] = transformed_point
                    transformed_start = self._apply_matrix(current_x, current_y, transform)
                    current_x, current_y = transformed_start

                # 使用德卡斯特里奥算法将曲线分成多个点
                curve_points = self._get_bezier_points(
                    (current_x, current_y),
                    (points[0], points[1]),
                    (points[2], points[3]),
                    (points[4], points[5]),
                    10  # 分段数
                )

                # 检查曲线的每个线段是否与边界框相交
                for i in range(len(curve_points) - 1):
                    if self._line_intersects_box(
                        curve_points[i][0], curve_points[i][1],
                        curve_points[i+1][0], curve_points[i+1][1],
                        other
                    ):
                        return True

                current_x = points[4]
                current_y = points[5]

        return False

    def _line_intersects_box(self, x1: float, y1: float, x2: float, y2: float, box: BoundingBox) -> bool:
        """检查线段是否与边界框相交

        Args:
            x1, y1: 线段起点坐标
            x2, y2: 线段终点坐标
            box: 边界框

        Returns:
            bool: 如果线段与边界框相交返回True，否则返回False
        """
        # Cohen-Sutherland算法的区域编码
        def compute_code(x: float, y: float) -> int:
            code = 0
            if x < box.minx:
                code |= 1  # 左
            elif x > box.maxx:
                code |= 2  # 右
            if y < box.miny:
                code |= 4  # 下
            elif y > box.maxy:
                code |= 8  # 上
            return code

        # 获取端点的区域编码
        code1 = compute_code(x1, y1)
        code2 = compute_code(x2, y2)

        while True:
            # 如果两个端点都在边界框内
            if code1 == 0 and code2 == 0:
                return True

            # 如果线段完全在边界框的一侧
            if code1 & code2:
                return False

            # 选择在边界框外的一个端点
            code = code1 if code1 else code2

            # 计算与边界框的交点
            if code & 1:  # 左边界
                y = y1 + (y2 - y1) * (box.minx - x1) / (x2 - x1)
                x = box.minx
            elif code & 2:  # 右边界
                y = y1 + (y2 - y1) * (box.maxx - x1) / (x2 - x1)
                x = box.maxx
            elif code & 4:  # 下边界
                x = x1 + (x2 - x1) * (box.miny - y1) / (y2 - y1)
                y = box.miny
            else:  # 上边界
                x = x1 + (x2 - x1) * (box.maxy - y1) / (y2 - y1)
                y = box.maxy

            # 更新端点
            if code == code1:
                x1, y1 = x, y
                code1 = compute_code(x1, y1)
            else:
                x2, y2 = x, y
                code2 = compute_code(x2, y2)

    def _get_bezier_points(self, p0: tuple, p1: tuple, p2: tuple, p3: tuple, num_points: int) -> list:
        """计算三次贝塞尔曲线上的点

        Args:
            p0: 起点坐标
            p1, p2: 控制点坐标
            p3: 终点坐标
            num_points: 采样点数量

        Returns:
            list: 曲线上的点列表
        """
        points = []
        for i in range(num_points):
            t = i / (num_points - 1)
            # 三次贝塞尔曲线公式
            x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
            y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
            points.append((x, y))
        return points

    def _is_rect(self) -> bool:
        """判断是否为矩形"""
        # 如果 params里只有M/m, H/h, V/v, Z/z则返回True
        # 如果 params里有L/l 或者 C/c 则返回False
        print("self.params: ", self.params)
        print("self.attributes['d']: ", self.attributes['d'])
        if re.match(r'^L.*C.*$', self.params) or 'A' in self.attributes['d']:
            return False
        return True


    def _dump_extra_info(self) -> List[str]:
        return [f"Path params: {self.params[:30]}..." if self.params else "Path params: <empty>"]

class Circle(Graphical):
    """圆形元素"""
    def __init__(self, cx: float, cy: float, r: float):
        super().__init__()
        self.cx = cx
        self.cy = cy
        self.r = r
        self.tag = 'circle'
        self.attributes = {
            'cx': cx,
            'cy': cy,
            'r': r
        }
    def get_bounding_box(self) -> BoundingBox:
        transform = self.get_transform_matrix
        cx = float(self.attributes.get('cx', 0))
        cy = float(self.attributes.get('cy', 0))
        r = float(self.attributes.get('r', 0))

        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                bbox = self._apply_transform(cx - r, cy - r, cx + r, cy + r, transform[0])
                bbox = self._apply_transform(bbox.maxx, bbox.maxy, cx + r, cy + r, transform[1])
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
            bbox = self._apply_transform(cx - r, cy - r, cx + r, cy + r, transform)
            return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)

        return BoundingBox(2 * r, 2 * r, cx - r, cx + r, cy - r, cy + r)

    def _dump_extra_info(self) -> List[str]:
        return [f"Center: ({self.cx:.2f}, {self.cy:.2f})", f"Radius: {self.r:.2f}"]


class RectEmbellish(GroupElement):
    """矩形装饰元素"""
    def __init__(self, type = 0, colors = ['#ff0000', '#0000ff']):
        super().__init__()
        print("type: ", type)
        self.type = type
        self.colors = colors
        self.attributes = {
            'width': 15,
            'height': 150
        }
        if type == 0:
            rect = Rect()
            rect.attributes = {
                'x': 0,
                'y': 0,
                'width': 15,
                'height': 150,
                'fill': colors[0]
            }
            self.children.append(rect)

        elif type == 1:
            rect1 = Rect()
            rect1.attributes = {
                'x': 0,
                'y': 0,
                'width': 10,
                'height': 150,
                'fill': colors[0]
            }
            self.children.append(rect1)
            rect2 = Rect()
            rect2.attributes = {
                'x': 10,
                'y': 0,
                'width': 10,
                'height': 150,
                'fill': colors[1]
            }
            self.children.append(rect2)

        elif type == 2:
            params = 'M0,0 L15,0 L15,50 L0,40 Z'
            path1 = Path(params)
            path1.attributes = {
                'd': params,
                'fill': colors[0]
            }
            self.children.append(path1)

            params = 'M0,150 L15,150 L15,110 L0,100 Z'
            path2 = Path(params)
            path2.attributes = {
                'd': params,
                'fill': colors[1]
            }
            self.children.append(path2)


class Infographics(GroupElement):
    """信息图元素"""
    def __init__(self):
        super().__init__()
        self.attributes['class'] = 'infographics'
        self.children = []
        
class Title(GroupElement):
    """标题元素"""
    def __init__(self):
        super().__init__()
        self.attributes['class'] = 'title'
        self.children = []
        
class Description(GroupElement):
    """描述元素"""
    def __init__(self):
        super().__init__()
        self.attributes['class'] = 'description'
        self.children = []
        
class UseImage(Image):
    """使用图片元素"""
    def __init__(self, base64: str=None):
        super().__init__(base64)
        self.attributes['class'] = 'use-image'
    def _dump_extra_info(self) -> List[str]:
        return [f"UseImage: {self.base64[:10]}..." if self.base64 else "UseImage: <empty>"]
        
class Chart(GroupElement):
    """图表元素"""
    def __init__(self):
        super().__init__()
        self.attributes['class'] = 'chart'
        self.children = []

class Background(GroupElement):
    """背景元素"""
    def __init__(self):
        super().__init__()
        self.attributes['class'] = 'background'
        self.children = []

class Axis(GroupElement):
    """轴元素"""
    def __init__(self, xory: str):
        super().__init__()
        self.xory = xory
        self.attributes['class'] = f'axis {xory}'
        self.children = []

class AxisLabel(GroupElement):
    """轴标签元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__()
        self.attributes['class'] = 'axis-label'
        self.data_attributes = DataAttribute({})
        self.axis_orient = None
        self.children.append(basic_element)
class AxisTick(GroupElement):
    """轴刻度元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__()
        self.attributes['class'] = 'axis-tick'
        self.data_attributes = DataAttribute({})
        self.children.append(basic_element)

class AxisDomain(GroupElement):
    """轴域元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__()
        self.attributes['class'] = 'axis-domain'
        self.data_attributes = DataAttribute({})
        self.children.append(basic_element)

class AxisTitle(GroupElement):
    """轴标题元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__()
        self.attributes['class'] = 'axis-title'
        self.data_attributes = DataAttribute({})
        self.children.append(basic_element)

class Mark(GroupElement):
    """标记元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__()
        self.attributes['class'] = 'mark'
        self.data_attributes = DataAttribute({})
        self.children.append(basic_element)
    
    def _dump_extra_info(self) -> List[str]:
        return [f"Mark type: {self.tag}"]
    
class BarMark(Mark):
    """柱状元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__(basic_element)
        self.attributes['class'] = 'bar'
        self.orient = 'vertical'
        self.data_attributes = DataAttribute({})

class PathMark(Mark):
    """折线元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__(basic_element)
        self.attributes['class'] = 'line'
        self.data_attributes = DataAttribute({})

class ArcMark(Mark):
    """弧元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__(basic_element)
        self.attributes['class'] = 'arc'
        self.data_attributes = DataAttribute({})

class AreaMark(Mark):
    """区域元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__(basic_element)
        self.attributes['class'] = 'area'
        self.data_attributes = DataAttribute({})

class PointMark(Mark):
    """点元素"""
    def __init__(self, basic_element: LayoutElement):
        super().__init__(basic_element)
        self.attributes['class'] = 'point'
        self.data_attributes = DataAttribute({})


def copy_attributes(source: LayoutElement, target: LayoutElement):
    for key, value in source.attributes.items():
        # 不拷贝class
        if key == 'class':
            continue
        target.attributes[key] = value

def copy_children(source: LayoutElement, target: LayoutElement):
    for child in source.children:
        target.children.append(child)
