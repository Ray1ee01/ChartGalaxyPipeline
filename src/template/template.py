import os
import json
from ..processors.svg_processor_modules.elements import *
from ..processors.svg_processor_modules.layout import *
from typing import List
from .color_template import ColorDesign
import random
import copy
from sentence_transformers import SentenceTransformer, util
from .chart_template.base import *
from .chart_template.bar_chart import *
from .chart_template.line_chart import *
from .chart_template.pie_chart import *
from .chart_template.donut_chart import *
from .chart_template.bump_chart import *
from .chart_template.slope_chart import *
from .chart_template.scatterplot import *
from .chart_template.connected_scatterplot import *
from .chart_template.bubble_plot import *


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



# 创建组合模板的工厂类
class TemplateFactory:
    @staticmethod
    def create_vertical_bar_chart_template(
        data: list,
        meta_data: dict,
        color_template: ColorDesign,
        config: dict,
    ):
        """创建垂直柱状图模板
        """
        
        annotation_config = config.get('annotation', None)
        sort_config = config.get('sort', None)
        axis_config = {
            "x_axis": config.get('x_axis', {}),
            "y_axis": config.get('y_axis', {})
        }
        print(config)
        layout_tree = config.get('layout', {}).get('layout_tree', None)
        
        chart_template = BarChartTemplate()
        chart_template.create_template(data, meta_data, color_template, config)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(VerticalBarChartConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'y'),
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)
        
        print(layout_tree)
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        print("axis_config: ", axis_config)
        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_title = axis_config.get('x_axis', {}).get('has_title', True)
            chart_template.x_axis.has_grid = axis_config.get('x_axis', {}).get('has_grid', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
            chart_template.y_axis.has_title = axis_config.get('y_axis', {}).get('has_title', True)
            chart_template.y_axis.has_grid = axis_config.get('y_axis', {}).get('has_grid', True)
        return chart_template, layout_template
    
    @staticmethod
    def create_horizontal_bar_chart_template(
        data: list,
        meta_data: dict,
        color_template: ColorDesign,
        config: dict
    ):
        """创建水平柱状图模板
        """
        
        annotation_config = config.get('annotation', None)
        sort_config = config.get('sort', None)
        axis_config = {
            "x_axis": config.get('x_axis', {}),
            "y_axis": config.get('y_axis', {})
        }
        layout_tree = config.get('layout', {}).get('layout_tree', None)
        
        chart_template = BarChartTemplate()
        chart_template.create_template(data, meta_data, color_template, config)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(HorizontalBarChartConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'x'),
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.x_axis.has_title = axis_config.get('x_axis', {}).get('has_title', True)
            chart_template.x_axis.has_grid = axis_config.get('x_axis', {}).get('has_grid', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
            chart_template.y_axis.has_title = axis_config.get('y_axis', {}).get('has_title', True)
            chart_template.y_axis.has_grid = axis_config.get('y_axis', {}).get('has_grid', True)
        return chart_template, layout_template

    @staticmethod
    def create_group_bar_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None, 
        color_template: ColorDesign = None,
        sort_config: dict = None,
        axis_config: dict = None
    ):
        chart_template = GroupBarChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        layout_template.add_constraint(GroupBarChartConstraint())
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        layout_template.apply_constraints(chart_template)
        return chart_template, layout_template

    @staticmethod
    def create_stacked_bar_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        color_template: ColorDesign = None,
        sort_config: dict = None,
        axis_config: dict = None
    ):
        chart_template = StackedBarChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        layout_template.add_constraint(StackedBarChartConstraint())
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        layout_template.apply_constraints(chart_template)
        return chart_template, layout_template

    @staticmethod
    def create_line_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        """创建折线图模板"""
        chart_template = LineChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(LineChartConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'y'),
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
        
        return chart_template, layout_template
        
    @staticmethod
    def create_pie_chart_template(
        data: List[Dict],
        meta_data: Dict,
        layout_tree: Dict,
        annotation_config: Dict,
        sort_config: Dict,
        color_template: ColorDesign,
        axis_config: Dict
    ) -> Tuple[ChartTemplate, Dict]:
        # 创建饼图模板
        chart_template = PieChartTemplate(color_template)
        layout_template = LayoutTemplate()
        
        # 使用create_template方法设置模板
        chart_template.create_template(data, meta_data, color_template)

        # 设置基本mark属性
        chart_template.mark.radius = 100
        chart_template.mark.innerRadius = 0

        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)

        return chart_template, layout_template
    
    @staticmethod
    def create_donut_chart_template(
        data: List[Dict],
        meta_data: Dict,
        layout_tree: Dict,
        annotation_config: Dict,
        sort_config: Dict,
        color_template: ColorDesign,
        axis_config: Dict
    ) -> Tuple[ChartTemplate, Dict]:
        # 创建甜甜圈图模板
        chart_template = DonutChartTemplate(color_template)
        layout_template = LayoutTemplate()
        
        # 使用create_template方法设置模板
        chart_template.create_template(data, meta_data, color_template)

        # 设置基本mark属性
        chart_template.mark.radius = 100
        chart_template.mark.innerRadius = 50

        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        return chart_template, layout_template
    
    @staticmethod
    def create_bump_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        """创建 bump chart 模板"""
        chart_template = BumpChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()

        # 添加方向约束
        layout_template.add_constraint(BumpChartConstraint())

        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'y'),
                    ascending=sort_config.get("ascending", True)
                )
            )

        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)

        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)

        # 应用约束
        layout_template.apply_constraints(chart_template)

        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)

        return chart_template, layout_template
               
    @staticmethod
    def create_scatterplot_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):

        """创建散点图模板"""
        chart_template = ScatterPlotTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(ScatterPlotConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'y'),
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
        
        return chart_template, layout_template
    
    @staticmethod
    def create_connected_scatterplot_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        """创建连接散点图模板"""
        chart_template = ConnectedScatterPlotTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(LineChartConstraint())
        
        # # 添加排序约束
        # if sort_config:
        #     layout_template.add_constraint(
        #         SortConstraint(
        #             sort_by=sort_config.get('by', 'y'),
        #             ascending=sort_config.get("ascending", True)
        #         )
        #     )
        
        if annotation_config:
            if "mark_annotation" in annotation_config['sequence']:
                chart_template.has_annotation = True
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
                
        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
        
        return chart_template, layout_template
    
    @staticmethod
    def create_bubble_plot_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        """创建气泡图模板"""
        chart_template = BubblePlotTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(BubblePlotConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'y'),
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)
        
        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)
        
        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
        
        return chart_template, layout_template
      
    @staticmethod
    def create_radial_bar_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None,
    ):
        chart_template = RadialBarChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        # layout_template.add_constraint(RadialBarChartConstraint())
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        # layout_template.apply_constraints(chart_template)
        return chart_template, layout_template

    @staticmethod
    def create_slope_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        """创建 slope chart 模板"""
        chart_template = SlopeChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        
        # 添加方向约束
        layout_template.add_constraint(SlopeChartConstraint())
        
        # 添加排序约束
        if sort_config:
            layout_template.add_constraint(
                SortConstraint(
                    sort_by=sort_config.get('by', 'y'),
                    ascending=sort_config.get("ascending", True)
                )
            )
        
        if annotation_config:
            chart_template.has_annotation = annotation_config.get('has_annotation', False)

        # 构建布局树
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        
        # 应用约束
        layout_template.apply_constraints(chart_template)

        if axis_config:
            chart_template.x_axis.has_domain = axis_config.get('x_axis', {}).get('has_domain', True)
            chart_template.x_axis.has_tick = axis_config.get('x_axis', {}).get('has_tick', True)
            chart_template.x_axis.has_label = axis_config.get('x_axis', {}).get('has_label', True)
            chart_template.y_axis.has_domain = axis_config.get('y_axis', {}).get('has_domain', True)
            chart_template.y_axis.has_tick = axis_config.get('y_axis', {}).get('has_tick', True)
            chart_template.y_axis.has_label = axis_config.get('y_axis', {}).get('has_label', True)
        
        return chart_template, layout_template
    
    @staticmethod
    def create_bullet_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        chart_template = BulletChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        layout_template.add_constraint(BulletChartConstraint())
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        layout_template.apply_constraints(chart_template)
        return chart_template, layout_template

    @staticmethod
    def create_waterfall_chart_template(
        data: list,
        meta_data: dict,
        layout_tree: dict,
        annotation_config: dict = None,
        sort_config: dict = None,
        color_template: ColorDesign = None,
        axis_config: dict = None
    ):
        chart_template = WaterfallChartTemplate()
        chart_template.create_template(data, meta_data, color_template)
        layout_template = LayoutTemplate()
        layout_template.add_constraint(WaterfallChartConstraint())
        layout_template.root = layout_template.build_template_from_tree(layout_tree)
        layout_template.apply_constraints(chart_template)
        return chart_template, layout_template
