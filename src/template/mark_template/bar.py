from .base import MarkTemplate
from ..color_template import ColorDesign
import random

class BarTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.type = "bar"
        self.height = None
        self.width = None
        self.orientation = None # 这个不用自己设定，而是应该根据轴的配置推理得到
        
        # 样式属性
        
        random_number = 5
        self.corner_radius = random_number
    def dump(self):
        return {
            "type": self.type,
            "height": self.height,
            "width": self.width,
            "orientation": self.orientation,
            "corner_radiuses": self.corner_radiuses
        }
