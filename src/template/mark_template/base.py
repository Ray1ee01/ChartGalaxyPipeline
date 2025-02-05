from ..color_template import ColorDesign
from ..style_template.base import ColorTemplate, StrokeTemplate, LabelFontTemplate

class MarkTemplate:
    def __init__(self, color_template: ColorDesign=None):
        # 基本属性
        self.mark_type = None # 标记类型
        self.point = None
        self.interpolate = None
        mark_color = None
        # if color_template is not None and color_template.mode == 'monochromatic':
        #     # seed_mark = random.randint(1, 100)
        #     seed_mark = 1
        #     mark_color = color_template.get_color('marks', 1, seed_mark=seed_mark)[0]

        # 样式属性
        self.fill_color_style = ColorTemplate()
        self.fill_color_style.color = mark_color
        self.stroke_color_style = ColorTemplate()
        self.stroke_color_style.color = mark_color
        
        self.stroke_style = StrokeTemplate()
        
        self.annotation_font_style = LabelFontTemplate()
        self.annotation_color_style = ColorTemplate()
        self.annotation_side = None
        # 从inner和outer之间随机取一个值
        # self.annotation_side = random.choice(["inner", "outer"])
        # print("self.annotation_side: ", self.annotation_side)
        self.annotation_side = "outer"
        
        if self.annotation_side == "inner":
            seed_text = random.randint(1, 100)
            self.annotation_color_style.color = color_template.get_color('text', 1, seed_text=seed_text, reverse=True)
        else:
            self.annotation_color_style.color = mark_color
        
    def dump(self):
        return {
            "mark_type": self.mark_type,
            "fill_color_style": self.fill_color_style.dump(),
            "stroke_color_style": self.stroke_color_style.dump(),
            "stroke_style": self.stroke_style.dump()
        }
