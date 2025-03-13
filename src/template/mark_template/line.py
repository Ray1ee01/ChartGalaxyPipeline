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
            "basis",
            # "cardinal",
            # "catmull-rom",
            "linear",
            "monotone",
            # "natural",
            "step",
            # "step-after",
            # "step-before"
        ]
        self.interpolate = random.choice(candidate_interpolates)
    
    def dump(self):
        base_dict = super().dump()
        return {
            **base_dict,
            "type": self.type,
            "orientation": self.orientation,
            "interpolate": self.interpolate,
            "fill_color_style": self.fill_color_style.dump(),
            "stroke_color_style": self.stroke_color_style.dump(),
            "stroke_style": self.stroke_style.dump(),
        }
    def dump_possible_values(self):
        base_possible_values = super().dump_possible_values()
        return {
            **base_possible_values,
            "orientation": {
                "type": "enum",
                "options": ["horizontal", "vertical"],
                "default": "horizontal",
                "note": "orientation"
            },
            "interpolate": {
                "type": "enum",
                "options": ["basis", "linear", "monotone", "step"],
                "default": "linear",
                "note": "interpolate"
            }
        }
