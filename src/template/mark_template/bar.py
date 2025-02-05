from .base import MarkTemplate
from ..color_template import ColorDesign

class BarTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.type = "bar"
        self.height = None
        self.width = None
        self.orientation = None # 这个不用自己设定，而是应该根据轴的配置推理得到
        
        # 样式属性
        self.corner_radiuses = {
            "top_left": None,
            "top_right": None,
            "bottom_left": None,
            "bottom_right": None
        }
    def dump(self):
        return {
            "type": self.type,
            "height": self.height,
            "width": self.width,
            "orientation": self.orientation,
            "corner_radiuses": self.corner_radiuses
        }
