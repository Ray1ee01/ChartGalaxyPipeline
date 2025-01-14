import os
import json
from ..processors.svg_processor_modules.elements import *
from ..processors.svg_processor_modules.layout import *
from typing import List
from .color_template import ColorDesign
import random


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
    def __init__(self, color_template: ColorDesign=None):
        # 基本属性
        self.type = None # 轴类型
        self.orientation = None # 轴方向
        self.field = None # field 名称
        self.field_type = None # 类型

        # 样式属性
        ## domain 样式
        self.has_domain = True
        # 从1到100之间随机取一个值
        seed_axis = random.randint(1, 100)
        stroke_color = color_template.get_color('axis', 1, seed_axis=seed_axis)
        self.domain_color_style = ColorTemplate()
        self.domain_color_style.color = stroke_color
        self.domain_stroke_style = StrokeTemplate()
        
        ## label 样式
        self.has_label = True
        self.label_color_style = ColorTemplate()
        self.label_color_style.color = stroke_color
        # self.label_font_style = FontTemplate()
        self.label_font_style = LabelFontTemplate()
        
        ## tick 样式
        self.has_tick = True
        self.tick_color_style = ColorTemplate()
        self.tick_color_style.color = stroke_color
        self.tick_stroke_style = StrokeTemplate()
        
        ## title 样式
        self.has_title = True
        self.title_text = None
        self.title_color_style = ColorTemplate()
        self.title_color_style.color = stroke_color
        # self.title_font_style = FontTemplate()
        self.title_font_style = LabelFontTemplate()
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
    def __init__(self, color_template: ColorDesign=None):
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
    def __init__(self, color_template: ColorDesign=None):
        # 基本属性
        self.mark_type = None # 标记类型
        
        seed_mark = random.randint(1, 100)
        print("seed_mark: ", seed_mark)
        mark_color = color_template.get_color('marks', 1, seed_mark=seed_mark)
        # mark_color = color_template.get_color('marks', 1)
        
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
        self.annotation_side = random.choice(["inner", "outer"])
        print("self.annotation_side: ", self.annotation_side)
        
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


    
## TODO现在还没支持annotation
class ChartTemplate:
    def __init__(self, template_path: str=None):
        self.chart_type = None
        self.has_annotation = False

class LayoutConstraint:
    """布局约束基类"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        raise NotImplementedError
    
    def apply(self, chart_template: ChartTemplate) -> None:
        raise NotImplementedError

class VerticalBarChartConstraint(LayoutConstraint):
    """垂直柱状图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.y_axis.orientation = "left"

class HorizontalBarChartConstraint(LayoutConstraint):
    """水平柱状图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "horizontal"
        chart_template.x_axis.orientation = "left"
        chart_template.y_axis.orientation = "top"

class SortConstraint(LayoutConstraint):
    """排序约束"""
    def __init__(self, sort_by: str = "y", ascending: bool = True):
        if sort_by not in ["x", "y"]:
            raise ValueError("sort_by 必须是 'x' 或 'y'")
        self.sort_by = sort_by
        self.ascending = ascending
    
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        
        # if self.sort_by == "x":
        #     sort_field = chart_template.x_axis.field
        # else:  # "y"
        #     sort_field = chart_template.y_axis.field
        
        chart_template.sort = {
            "by": self.sort_by,
            "ascending": self.ascending
        }

class LayoutTemplate:
    def __init__(self):
        self.root = GroupElement()
        self.root.children = []
        self.constraints: List[LayoutConstraint] = []
        
    def add_constraint(self, constraint: LayoutConstraint):
        self.constraints.append(constraint)
    
    def apply_constraints(self, chart_template: ChartTemplate):
        for constraint in self.constraints:
            if not constraint.validate(chart_template):
                raise ValueError(f"图表类型 {chart_template.chart_type} 与布局约束不兼容")
            constraint.apply(chart_template)
    
    def build_template_from_tree(self, layout_tree: dict):
        if layout_tree['tag'] == 'g':
            group = GroupElement()
            group.id = layout_tree.get('id', None)
            group.children = []
            for child in layout_tree.get('children', []):
                group.children.append(self.build_template_from_tree(child))
            layout_strategy_dict = layout_tree.get('layoutStrategy', None)
            if layout_strategy_dict is not None:
                if layout_strategy_dict['name'] == 'vertical':
                    group.layout_strategy = VerticalLayoutStrategy()
                elif layout_strategy_dict['name'] == 'horizontal':
                    group.layout_strategy = HorizontalLayoutStrategy()
                else:
                    raise ValueError(f"不支持的布局策略: {layout_strategy_dict['name']}")
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

            size_constraint_dict = layout_tree.get('sizeConstraint', None)
            if size_constraint_dict is not None:
                group.size_constraint = WidthHeightConstraint()
                reference_id = size_constraint_dict['reference']
                reference_element = group.get_element_by_id(reference_id)
                if size_constraint_dict.get('max_width', None) is not None:
                    group.size_constraint.max_width_ratio = size_constraint_dict['max_width']
                if size_constraint_dict.get('max_height', None) is not None:
                    group.size_constraint.max_height_ratio = size_constraint_dict['max_height']
                if size_constraint_dict.get('min_width', None) is not None:
                    group.size_constraint.min_width_ratio = size_constraint_dict['min_width']
                if size_constraint_dict.get('min_height', None) is not None:
                    group.size_constraint.min_height_ratio = size_constraint_dict['min_height']
                group.reference_id = reference_id
            return group
        elif layout_tree['tag'] == 'rect':
            rect = Rect()
            rect.id = layout_tree.get('id', None)
            return rect
        elif layout_tree['tag'] == 'text':
            text = Text()
            text.id = layout_tree.get('id', None)
            return text
        elif layout_tree['tag'] == 'line':
            line = Line()
            line.id = layout_tree.get('id', None)
            return line
        elif layout_tree['tag'] == 'circle':
            circle = Circle()
            circle.id = layout_tree.get('id', None)
            return circle
        elif layout_tree['tag'] == 'path':
            path = Path()
            path.id = layout_tree.get('id', None)
            return path
        elif layout_tree['tag'] == 'circle':
            circle = Circle()
            circle.id = layout_tree.get('id', None)
            return circle
        elif layout_tree['tag'] == 'image':
            image = Image()
            image.id = layout_tree.get('id', None)
            return image
        else:
            raise ValueError(f"不支持的布局元素: {layout_tree['tag']}")

class BarChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bar"
        self.sort = None
    
    def create_template(self, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.y_axis = AxisTemplate(color_template)
        
        self.mark = BarTemplate(color_template)
        
        self.color_encoding = ColorEncodingTemplate(color_template)
        

        if meta_data is None:
            # set default value
            self.x_axis.field = "category"
            self.x_axis.field_type = "nominal"
            
            self.y_axis.field = "value"
            self.y_axis.field_type = "quantitative"
        else:
            if meta_data['x_type'] == "categorical":
                meta_data['x_type'] = "nominal"
            elif meta_data['x_type'] == "numerical":
                meta_data['x_type'] = "quantitative"
            if meta_data['y_type'] == "categorical":
                meta_data['y_type'] = "nominal"
            elif meta_data['y_type'] == "numerical":
                meta_data['y_type'] = "quantitative"
                
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
            
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']
        
    def dump(self):
        result = {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }
        
        # 添加排序配置到输出
        if self.sort is not None:
            result["sort"] = self.sort
            
        return result

# 创建组合模板的工厂类
class TemplateFactory:
    @staticmethod
    def create_vertical_bar_chart_template(
        meta_data: dict,
        layout_tree: dict,
        chart_composition: dict = None,
        sort_config: dict = None,  # {"by": "y", "ascending": True}
        color_template: ColorDesign = None
    ):
        """创建垂直柱状图模板
        
        Args:
            layout_tree (dict): 布局树配置
            sort_config (dict, optional): 排序配置，包含 by ("x"/"y") 和 ascending
        """
        chart_template = BarChartTemplate()
        chart_template.create_template(meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(VerticalBarChartConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config["by"],
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if chart_composition:
            if "mark_annotation" in chart_composition['sequence']:
                chart_template.has_annotation = True
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
            
            
        
        return chart_template, layout_template
    
    @staticmethod
    def create_horizontal_bar_chart_template(
        meta_data: dict,
        layout_tree: dict,
        chart_composition: dict = None,
        sort_config: dict = None,  # {"by": "y", "ascending": True}
        color_template: ColorDesign = None
    ):
        """创建水平柱状图模板
        
        Args:
            layout_tree (dict): 布局树配置
            sort_config (dict, optional): 排序配置，包含 by ("x"/"y") 和 ascending
        """
        chart_template = BarChartTemplate()
        chart_template.create_template(meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(HorizontalBarChartConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config["by"],
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if chart_composition:
            if "mark_annotation" in chart_composition['sequence']:
                chart_template.has_annotation = True
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        return chart_template, layout_template

class FontTemplate:
    def __init__(self):
        self.font = None
        self.font_size = None
        self.font_weight = None
        self.line_height = None
        self.letter_spacing = None
    def dump(self):
        return {
            "font": self.font,
            "fontSize": self.font_size,
            "fontWeight": self.font_weight,
            "lineHeight": self.line_height,
            "letterSpacing": self.letter_spacing
        }


class TitleFontTemplate(FontTemplate):
    """用于标题的字体模板"""
    def __init__(self):
        super().__init__()
        self.font = "sans-serif"
        self.font_size = 22
        self.font_weight = 500
        self.line_height = 28
        self.letter_spacing = 0
    def large(self):
        self.font_size = 22
        self.font_weight = 600
        self.line_height = 28
        self.letter_spacing = 0
    def middle(self):
        self.font_size = 16
        self.font_weight = 600
        self.line_height = 24
        self.letter_spacing = 0.15
    def small(self):
        self.font_size = 14
        self.font_weight = 600
        self.line_height = 20
        self.letter_spacing = 0.1

class BodyFontTemplate(FontTemplate):
    """用于正文的字体模板"""
    def __init__(self):
        super().__init__()
        self.font = "sans-serif"
        self.font_size = 16
        self.font_weight = 400
        self.line_height = 24
        self.letter_spacing = 0.5
    def large(self):
        self.font_size = 16
        self.font_weight = 400
        self.line_height = 24
        self.letter_spacing = 0.5
    def middle(self):
        self.font_size = 14
        self.font_weight = 400
        self.line_height = 20
        self.letter_spacing = 0.25
    def small(self):
        self.font_size = 12
        self.font_weight = 400
        self.line_height = 16
        self.letter_spacing = 0.4

class LabelFontTemplate(FontTemplate):
    """用于标签的字体模板"""
    def __init__(self):
        super().__init__()
        self.font = "sans-serif"
        self.font_size = 14
        self.font_weight = 500
        self.line_height = 20
        self.letter_spacing = 0.1
    def large(self):
        self.font_size = 14
        self.font_weight = 500
        self.line_height = 20
        self.letter_spacing = 0.1
    def middle(self):
        self.font_size = 12
        self.font_weight = 500
        self.line_height = 16
        self.letter_spacing = 0.25
    def small(self):
        self.font_size = 10
        self.font_weight = 500
        self.line_height = 12
        self.letter_spacing = 0.4

