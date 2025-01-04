import os
import json



class Template

class FontTemplate:
    def __init__(self):
        self.font = None
        self.font_size = None
        self.font_weight = None

class ColorTemplate:
    def __init__(self):
        self.color = None
        self.opacity = None

class StrokeTemplate:
    def __init__(self):
        self.stroke_width = None


class AxisTemplate:
    def __init__(self):
        # 基本属性
        self.type = None # 轴类型
        self.orientation = None # 轴方向
        self.field = None # field 名称
        self.field_type = None # 类型

        # 样式属性
        ## domain 样式
        self.has_domain = True
        self.domain_color_style = ColorTemplate()
        self.domain_stroke_style = StrokeTemplate()
        
        ## label 样式
        self.has_label = True
        self.label_color_style = ColorTemplate()
        self.label_font_style = FontTemplate()
        
        ## tick 样式
        self.has_tick = True
        self.tick_color_style = ColorTemplate()
        self.tick_stroke_style = StrokeTemplate()
        
        ## title 样式
        self.has_title = True
        self.title_text = None
        self.title_color_style = ColorTemplate()
        self.title_font_style = FontTemplate()
        ## grid 样式: 暂时不支持
        
        
class ColorEncodingTemplate:
    def __init__(self):
        self.field = None
        self.field_type = None
        self.domain = None
        self.range = None

class MarkTemplate:
    def __init__(self):
        # 基本属性
        self.mark_type = None # 标记类型
        
        # 样式属性
        self.fill_color_style = ColorTemplate()
        self.stroke_color_style = ColorTemplate()
        
        self.stroke_style = StrokeTemplate()

class BarTemplate(MarkTemplate):
    def __init__(self):
        super().__init__()
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



class ChartTemplate:
    # 首先需要确定chartTemplate有哪些属性，以及每种属性可能的取值
    def __init__(self, template_path: str):
        self.chart_type = None # 图表类型
        
        
