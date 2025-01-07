import os
import json
from ..processors.svg_processor_modules.elements import *
from ..processors.svg_processor_modules.layout import *

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
        
        # set default value
        self.x_axis.field = "category"
        self.x_axis.field_type = "nominal"
        
        self.y_axis.field = "value"
        self.y_axis.field_type = "quantitative"
        
    def dump(self):
        return {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }


# layout_tree = {
#     "tag": "g",
#     "layoutStrategy": {
#         "name": "vertical",
#         "padding": 10,
#         "direction": "down"
#     },
#     "children": [
#         {
#             "tag": "g",
#             "id": "global_title_group",
#             "layoutStrategy": {
#                 "name": "horizontal",
#                 "padding": 0,
#                 "direction": "right",
#             },
#             "children": [
#                 {
#                     "tag": "g",
#                     "id": "title_group",
#                     "layoutStrategy": {
#                         "name": "vertical",
#                         "padding": 10,
#                         "direction": "down",
#                         "alignment": ["left","left"]
#                     },
#                     "children": [
#                         {
#                             "tag": "g",
#                             "id": "title_text",
#                             "children": []
#                         },
#                         {
#                             "tag": "g",
#                             "id": "subtitle_text",
#                             "children": []
#                         }
#                     ]
#                 },
#                 {
#                     "tag": "image",
#                     "id": "topic_icon",
#                 }
#             ]
#         },
#         {
#             "tag": "g",
#             "id": "chart",
#         },
#     ]
# }


class LayoutTemplate:
    def __init__(self):
        self.root = GroupElement()
        self.root.children = []
        # self.build_template_from_tree(layout_tree)

    def build_template_from_tree(self, tree: dict):
        if tree['tag'] == 'g':
            group = GroupElement()
            group.id = tree.get('id', None)
            group.children = []
            layout_strategy_dict = tree.get('layoutStrategy', None)
            if layout_strategy_dict is not None:
                if layout_strategy_dict['name'] == 'vertical':
                    group.layout_strategy = VerticalLayoutStrategy()
                elif layout_strategy_dict['name'] == 'horizontal':
                    group.layout_strategy = HorizontalLayoutStrategy()
                else:
                    group.layout_strategy = VerticalLayoutStrategy()
                if layout_strategy_dict.get('direction', None) is not None:
                    group.layout_strategy.direction = layout_strategy_dict['direction']
                if layout_strategy_dict.get('padding', None) is not None:
                    group.layout_strategy.padding = layout_strategy_dict['padding']
                if layout_strategy_dict.get('offset', None) is not None:
                    group.layout_strategy.offset = layout_strategy_dict['offset']
                if layout_strategy_dict.get('alignment', None) is not None:
                    group.layout_strategy.alignment = layout_strategy_dict['alignment']
                if layout_strategy_dict.get('overlap', None) is not None:
                    group.layout_strategy.overlap = layout_strategy_dict['overlap']
            for child in tree.get('children', []):
                group.children.append(self.build_template_from_tree(child))
            return group
        elif tree['tag'] == 'image':
            image = Image()
            image.id = tree.get('id', None)
            return image
        elif tree['tag'] == 'text':
            text = Text()
            text.id = tree.get('id', None)
            return text
        elif tree['tag'] == 'rect':
            rect = Rect()
            rect.id = tree.get('id', None)
            return rect
        elif tree['tag'] == 'line':
            line = Line()
            line.id = tree.get('id', None)
            return line
        elif tree['tag'] == 'path':
            path = Path()
            path.id = tree.get('id', None)
            return path
        elif tree['tag'] == 'circle':
            circle = Circle()
            circle.id = tree.get('id', None)
            return circle
        else:
            return None