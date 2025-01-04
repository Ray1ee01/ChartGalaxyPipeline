import os
import json


class FontTemplate:
    def __init__(self):
        self.font = None
        self.font_size = None
        self.font_weight = None
    def dump(self):
        return {
            "font": self.font,
            "fontSize": self.font_size,
            "fontWeight": self.font_weight
        }

class ColorTemplate:
    def __init__(self):
        self.color = None
        self.opacity = None
    def dump(self):
        return {
            "color": self.color,
            "opacity": self.opacity
        }

class StrokeTemplate:
    def __init__(self):
        self.stroke_width = None
    def dump(self):
        return {
            "strokeWidth": self.stroke_width
        }

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
    def dump(self):
        return {
            "type": self.type,
            "orientation": self.orientation,
            "field": self.field,
            "field_type": self.field_type,
            "has_domain": self.has_domain,
            "domain_color_style": self.domain_color_style.dump(),
            "domain_stroke_style": self.domain_stroke_style.dump(),
            "has_label": self.has_label,
            "label_color_style": self.label_color_style.dump(),
            "label_font_style": self.label_font_style.dump(),
        }
        
class ColorEncodingTemplate:
    def __init__(self):
        self.field = None
        self.field_type = None
        self.domain = None
        self.range = None
    def dump(self):
        return {
            "field": self.field,
            "field_type": self.field_type,
            "domain": self.domain,
            "range": self.range
        }

class MarkTemplate:
    def __init__(self):
        # 基本属性
        self.mark_type = None # 标记类型
        
        # 样式属性
        self.fill_color_style = ColorTemplate()
        self.stroke_color_style = ColorTemplate()
        
        self.stroke_style = StrokeTemplate()
        
    def dump(self):
        return {
            "mark_type": self.mark_type,
            "fill_color_style": self.fill_color_style.dump(),
            "stroke_color_style": self.stroke_color_style.dump(),
            "stroke_style": self.stroke_style.dump()
        }

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
    def dump(self):
        return {
            "type": self.type,
            "height": self.height,
            "width": self.width,
            "orientation": self.orientation,
            "corner_radiuses": self.corner_radiuses
        }


class ChartTemplateFactory:
    def __init__(self):
        self.chart_type = None
        self.template = None
    
    def create_template(self, chart_type: str):
        self.chart_type = chart_type
        self.template = eval(f"{chart_type}Template()")
        self.template.create_template()
        return self.template
    
## TODO现在还没支持annotation
class ChartTemplate:
    # 首先需要确定chartTemplate有哪些属性，以及每种属性可能的取值
    def __init__(self, template_path: str=None):
        self.chart_type = None # 图表类型

class BarChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bar"
    
    def create_template(self):
        self.x_axis = AxisTemplate()
        self.y_axis = AxisTemplate()
        self.mark = BarTemplate()
        self.color_encoding = ColorEncodingTemplate()
        
    def dump(self):
        return {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }   