from ..color_template import ColorDesign
from ..style_template.base import ColorTemplate, StrokeTemplate, LabelFontTemplate
from typing import Dict
import random

class MarkTemplate:
    def __init__(self, color_template: ColorDesign=None, config: Dict=None):
        # 基本属性
        self.mark_type = None # 标记类型
        self.point = None
        self.interpolate = None
        self.line = None
        mark_color = None

        # 样式属性
        self.opacity = 1.0
        self.fill_color_style = ColorTemplate()
        self.fill_color_style.color = mark_color
        self.stroke_color_style = ColorTemplate()
        self.stroke_color_style.color = mark_color
        self.stroke_style = StrokeTemplate()
        
        self.annotation_font_style = LabelFontTemplate()
        self.annotation_color_style = ColorTemplate()
        # self.annotation_side = None
        # # 从inner和outer之间随机取一个值
        # # self.annotation_side = random.choice(["inner", "outer"])
        # # print("self.annotation_side: ", self.annotation_side)
        # self.annotation_side = "outer"
        
        # if self.annotation_side == "inner":
        #     seed_text = random.randint(1, 100)
        #     self.annotation_color_style.color = color_template.get_color('text', 1, seed_text=seed_text, reverse=True)
        # else:
        #     self.annotation_color_style.color = mark_color
        
    def dump(self):
        return {
            "mark_type": self.mark_type,
            "fill_color_style": self.fill_color_style.dump(),
            "stroke_color_style": self.stroke_color_style.dump(),
            "stroke_style": self.stroke_style.dump(),
        }
    def dump_possible_values(self):
        fill_color_possible_values = self.fill_color_style.dump_possible_values()
        stroke_color_possible_values = self.stroke_color_style.dump_possible_values()
        stroke_style_possible_values = self.stroke_style.dump_possible_values()
        return {
            "fill_color_style": fill_color_possible_values,
            "stroke_color_style": stroke_color_possible_values,
            "stroke_style": stroke_style_possible_values,
            "mark_type": {
                "type": "enum",
                "options": ["arc", "path", "area", "bar", "point"],
                "default": "bar",
                "note": "mark type"
            }
        }