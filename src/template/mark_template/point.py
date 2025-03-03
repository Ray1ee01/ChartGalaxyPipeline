from .base import MarkTemplate
from ..color_template import ColorDesign
import random

class PointTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.type = "circle"
        
        self.height = None # 占位
        self.width = None # 占位
        
        self.shape = None  # 点的形状（arrow, circle, square等）
        self.angle = None
        self.size = 200
        self.stroke_width = None  # 描边宽度
        
        # 样式属性
        self.opacity = None  # 透明度
        self.fill = None  # 填充颜色
        
    def dump(self):
        return {
            "type": self.type,
            "size": self.size,
            "shape": self.shape,
            "stroke_style": {
                "stroke_width": self.stroke_width,
            },
        }