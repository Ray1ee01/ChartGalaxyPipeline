from .base import MarkTemplate
from ..color_template import ColorDesign
from typing import Dict
import random

class BarTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None, config: Dict=None):
        super().__init__(color_template, config)
        self.type = "bar"
        self.height = config
        self.width = config
        
        
        # self.height = config.get('height', None)
        # self.width = config.get('width', None)
        # self.orientation = config.get('orientation', None) # 这个不用自己设定，而是应该根据轴的配置推理得到
        
        # 样式属性
        # random_number = 5
        self.corner_radius = 0

    def dump(self):
        return {
            "type": self.type,
            "height": self.height,
            "width": self.width,
            "orientation": self.orientation,
            "corner_radiuses": self.corner_radiuses
        }
