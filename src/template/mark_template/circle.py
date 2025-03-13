from .base import MarkTemplate
from ..color_template import ColorDesign
import random

class CircleTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.type = "circle"
        
        self.height = None # 占位
        self.width = None # 占位
        
        self.shape = None  # 点的形状（arrow, circle, square等）
        self.angle = None
        self.size = None  # 点的大小
        self.stroke_width = None  # 描边宽度
        
        # 样式属性
        self.opacity = None  # 透明度
        self.fill = None  # 填充颜色
        
    def dump(self):
        base_dict = super().dump()
        return {
            **base_dict,
            "type": self.type,
            "size": self.size,
            "shape": self.shape,
            "angle": self.angle,
        }
        
    def dump_possible_values(self):
        base_possible_values = super().dump_possible_values()
        return {
            **base_possible_values,
            "size": {
                "type": "number",
                "range": [0, 100],
                "default": 10,
                "note": "size"
            },
            "shape": {
                "type": "enum",
                "options": ["arrow", "circle", "square"],
                "default": "circle",
                "note": "shape"
            },
            "angle": {
                "type": "number",
                "range": [0, 360],
                "default": 0,
                "note": "angle"
            }
        }
