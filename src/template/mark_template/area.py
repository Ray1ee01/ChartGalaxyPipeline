from .base import MarkTemplate
from ..color_template import ColorDesign

class AreaTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.type = "area"  # 改用 type 而不是 mark_type
        self.opacity = 0.7
        self.interpolate = "linear"
        self.height = None
        self.width = None
        self.orientation = None  # 和 bar 一样，由轴配置推理得到
    
    def dump(self):
        return {
            "type": self.type,
            "opacity": self.opacity,
            "interpolate": self.interpolate,
            "orientation": self.orientation
        }