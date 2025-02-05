from .base import MarkTemplate
from ..color_template import ColorDesign
import random

class LineTemplate(MarkTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.type = "line"
        self.orientation = None
        self.height = None
        self.width = None
        self.fill_color_style.color = None
            # 样式属性
        self.corner_radiuses = {
            "top_left": None,
            "top_right": None,
            "bottom_left": None,
            "bottom_right": None
        }

        self.apply_point_styles()
        self.apply_interpolate()
    def apply_point_styles(self):
        candidate_styles = [
            True,
            {
                "filled": False,
                "fill": "white"
            },
            None
        ]
        self.point = random.choice(candidate_styles)
    def apply_interpolate(self):
        candidate_interpolates = [
            # "basis",
            # "cardinal",
            # "catmull-rom",
            # "linear",
            "monotone",
            # "natural",
            # "step",
            # "step-after",
            # "step-before"
        ]
        self.interpolate = random.choice(candidate_interpolates)
    
    def dump(self):
        return {
            "type": self.type,
            "orientation": self.orientation
        }