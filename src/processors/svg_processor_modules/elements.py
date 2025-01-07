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
    
@dataclass
class Padding:
    """内边距类"""
    top: float = 0
    right: float = 0
    bottom: float = 0
    left: float = 0

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
        if 'x' in self.attributes:
            self.attributes['x'] += self._bounding_box.minx - old_min_x
        else:
            self.attributes['x'] = self._bounding_box.minx - old_min_x
        if 'y' in self.attributes:
            self.attributes['y'] += self._bounding_box.miny - old_min_y
        else:
            self.attributes['y'] = self._bounding_box.miny - old_min_y
            
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
        transform_pattern = r'(translate|rotate)\(([-\d\s,.]+)\)'
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
                    matrix = self._multiply_matrices(matrix, translate1)
                    matrix = self._multiply_matrices(matrix, rotate)
                    matrix = self._multiply_matrices(matrix, translate2)
                else:  # 普通旋转
                    rotate = [cos_a, sin_a, -sin_a, cos_a, 0, 0]
                    matrix = self._multiply_matrices(matrix, rotate)

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
        self.tag = 'g'
    
    def update_pos(self, old_min_x: float, old_min_y: float):
        current_transform = self.attributes.get('transform', '')
        new_transform = f"translate({self._bounding_box.minx - old_min_x}, {self._bounding_box.miny - old_min_y})"
        if current_transform:
            self.attributes['transform'] = f"{current_transform} {new_transform}"
        else:
            self.attributes['transform'] = new_transform
    
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
            if child_bbox:
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
    
    @staticmethod
    def _getImageAsBase64(image_url: str) -> Optional[str]:
        """将图片转换为base64编码
        
        Args:
            image_url: 图片URL或本地文件路径
        
        Returns:
            Optional[str]: base64编码的图片数据，包含MIME类型
        """
        try:
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
    
    def get_bounding_box(self) -> BoundingBox:
        transform = self.get_transform_matrix
        x = float(self.attributes.get('x', 0))
        y = float(self.attributes.get('y', 0))
        width = float(self.attributes.get('width', 0))
        height = float(self.attributes.get('height', 0))
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
    
    def _dump_extra_info(self) -> List[str]:
        return [f"Base64: {self.base64[:30]}..." if self.base64 else "Base64: <empty>"]

class Text(AtomElement):
    """文本元素"""
    def __init__(self, content: str=None):
        super().__init__()
        self.content = content
        self.tag = 'text'
    
    @staticmethod
    def _measure_text(text: str, font_size: float, anchor: str = 'left top') -> Dict[str, float]:
        """使用Node.js的TextToSVG库测量文本尺寸"""
        try:
            data = {
                'text': text,
                'fontSize': font_size,
                'anchor': anchor
            }
            measure_script_path = os.path.join(os.path.dirname(__file__), 'text_tool', 'measure_text.js')
            result = node_bridge.execute_node_script(
                measure_script_path,
                data
            )
            metrics = json.loads(result)
            return metrics
        except Exception as e:
            print(f"测量文本时出错: {e}")
            # 回退到估算方法
            return {
                'width': len(text) * font_size * 0.6,
                'height': font_size * 1.2,
                'ascent': font_size,
                'descent': 0
            }
    
    def update_pos(self, old_min_x: float, old_min_y: float):
        if 'x' in self.attributes:
            self.attributes['x'] += self._bounding_box.minx - old_min_x
        else:
            self.attributes['x'] = self._bounding_box.minx - old_min_x
        if 'y' in self.attributes:
            self.attributes['y'] += self._bounding_box.miny - old_min_y
        else:
            self.attributes['y'] = self._bounding_box.miny - old_min_y
            
    
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
            
        x += dx
        y += dy - metrics['ascent']
        
        min_x = x
        min_y = y
        max_x = x + width
        max_y = y + height
        # print('text: ', self.content)
        # print('bounding_box: ', height, width)
        
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
    
    def get_bounding_box(self) -> BoundingBox:
        attrs = self.attributes
        d = attrs.get('d', '')
        if not d:
            return BoundingBox(0, 0, 0, 0, 0, 0)
        
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
        
        # 处理变换
        transform = self.get_transform_matrix
        if transform:
            if isinstance(transform, list) and len(transform) == 2:
                bbox = self._apply_transform(minX, minY, maxX, maxY, transform[0])
                bbox = self._apply_transform(bbox.maxx, bbox.maxy, maxX, maxY, transform[1])
                return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
            bbox = self._apply_transform(minX, minY, maxX, maxY, transform)
            return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        
        return BoundingBox(maxX - minX, maxY - minY, minX, maxX, minY, maxY)
    
    
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
            bbox = self._apply_transform(cx - r, cy - r, cx + r, cy + r, matrix)
            return BoundingBox(bbox.maxx - bbox.minx, bbox.maxy - bbox.miny, bbox.minx, bbox.maxx, bbox.miny, bbox.maxy)
        
        return BoundingBox(2 * r, 2 * r, cx - r, cx + r, cy - r, cy + r)
    
    def _dump_extra_info(self) -> List[str]:
        return [f"Center: ({self.cx:.2f}, {self.cy:.2f})", f"Radius: {self.r:.2f}"]