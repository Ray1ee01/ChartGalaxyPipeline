from typing import Optional, Dict, List, Tuple, Union
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .elements import *

class VegaLiteElementParser:
    def __init__(self, elements_tree: LayoutElement):
        self.elements_tree = elements_tree
        # self.root = etree.fromstring(svg_data)
        self.converter = SVGTreeConverter()
        self.context_stack = []  # 用于管理上下文状态
        self.element_dict = {}
        self.marks = []
        self.axis_labels = []
        self.axes = []
        self.legend_group = None
        # 仅用于bar相关的chart type
        self.orient = 'vertical'
        self.chart_template = None

    def parse(self, element: LayoutElement):
        """递归遍历元素树，识别并设置各种图表组件组"""
        current_context = self.context_stack[-1] if self.context_stack else None

        # 如果当前已在某个组的上下文中,不再处理其他组
        if current_context:
            if element.tag == 'g':
                for i, child in enumerate(element.children):
                    element.children[i] = self.parse(child)
            return element

        # 根据当前的元素类型调用对应的处理逻辑
        if self.if_legend_group(element):
            self.legend_group = self._handle_group("legend_group", element, "legend_group")
            return self.legend_group
        elif self.if_mark_group(element):
            return self._handle_group("mark_group", element, "mark_groups", is_list=True)
        elif self.if_x_axis_group(element):
            return self._handle_group("x_axis_group", element, "x_axis_group")
        elif self.if_y_axis_group(element):
            return self._handle_group("y_axis_group", element, "y_axis_group")

        # 递归处理所有子元素
        if hasattr(element, "children"):
            for i, child in enumerate(element.children):
                element.children[i] = self.parse(child)
        
        return element

    def _handle_group(self, context_name, element, attribute_name, is_list=False):
        """
        通用的组处理逻辑

        Args:
            context_name: 当前组的上下文标识（如 "legend_group"）
            element: 当前组的元素对象
            attribute_name: 保存该组的属性名（如 "legend_group", "mark_groups"）
            is_list: 是否将组保存为列表（如 mark_groups 是一个列表）
        
        Returns:
            处理后的元素对象
        """
        element.attributes['class'] = context_name
        self.context_stack.append(context_name)

        processed_element = element
        if context_name == "x_axis_group":
            print(f"Found x_axis_group: {element}")
            processed_element = self._handle_axis_group(element, "X")
        elif context_name == "y_axis_group":
            print(f"Found y_axis_group: {element}")
            processed_element = self._handle_axis_group(element, "Y")
        elif context_name == "mark_group":
            print(f"Found mark_group: {element}")
            processed_element = self._handle_mark(element)
        else:
            # 递归处理子元素
            if element.tag == 'g':
                for i, child in enumerate(element.children):
                    element.children[i] = self.parse(child)
                processed_element = element

        # 保存处理后的element
        if is_list:
            if context_name not in self.element_dict:
                self.element_dict[context_name] = []
            self.element_dict[context_name].append(processed_element)
        else:
            self.element_dict[context_name] = processed_element

        # 弹出上下文
        self.context_stack.pop()
        
        return processed_element

    def _handle_mark(self, element):
        """处理 mark 元素"""
        # 添加chart_type属性
        # self.chart_type = element.attributes.get('aria-roledescription', '').lower()
        # self.chart_type = self.chart_template.chart_type
        self.chart_type = "stackedbar"
        if "bar" in self.chart_type:
            mark_group = self._handle_bar(element)
            self.marks.extend(mark_group.children)
        if "bump" in self.chart_type:
            mark_group = self._handle_bump(element)
            self.marks.extend(mark_group.children)
        if "line" in self.chart_type or "slope" in self.chart_type:
            mark_group = self._handle_line(element)
            self.marks.extend(mark_group.children)
        if "stream" in self.chart_type or "area" in self.chart_type:
            mark_group = self._handle_area(element)
            self.marks.extend(mark_group.children)
        if "pie" in self.chart_type or "donut" in self.chart_type:
            mark_group = self._handle_pie(element)
            self.marks.extend(mark_group.children)
        if "connectedscatter" in self.chart_type:
            mark_group = self._handle_connectedscatter(element)
            self.marks.extend(mark_group.children)
        if "scatter" in self.chart_type or "bubble" in self.chart_type:
            mark_group = self._handle_scatter(element)
            self.marks.extend(mark_group.children)
        return mark_group
            
    def _handle_bar(self, element):
        for i, child in enumerate(element.children):
            if child.tag=='g' and 'clip-path' in child.attributes:
                bar_mark = BarMark(child.children[0].children[0])
                bar_mark.attributes['transform'] = child.attributes['transform'] + bar_mark.attributes.get('transform', '')
                bar_mark.attributes['clip-path'] = child.attributes['clip-path']
                bar_mark.orient = self.orient
                element.children[i] = bar_mark
            elif child.tag=='g':
                bar_mark = BarMark(child.children[0])
                bar_mark.orient = self.orient
                element.children[i] = bar_mark
            else:
                bar_mark = BarMark(child)
                bar_mark.orient = self.orient
                element.children[i] = bar_mark
        return element
    
    def _handle_bump(self, element):
        print(f"Found bump: {element}")
        print("aria-roledescription: ", element.attributes.get('aria-roledescription', ''))
        if 'point' in element.attributes.get('aria-roledescription', '') or 'symbol' in element.attributes.get('aria-roledescription', ''):
            print("point")
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    point_mark = PointMark(child.children[0])
                    element.children[i] = point_mark
                else:
                    element.children[i] = PointMark(child)
        elif 'group' in element.attributes.get('aria-roledescription', ''):
            print("group")
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    line_mark = PathMark(child.children[0])
                    element.children[i] = line_mark
                else:
                    element.children[i] = PathMark(child)
        return element
    
    def _handle_line(self, element):
        if "line" in element.attributes.get("aria-roledescription", '') or "group" in element.attributes.get("aria-roledescription", ''):
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    line_mark = PathMark(child.children[0])
                    element.children[i] = line_mark
                else:
                    element.children[i] = PathMark(child)
        return element
    
    def _handle_area(self, element):
        if "area" in element.attributes.get("aria-roledescription", ''):
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    area_mark = AreaMark(child.children[0])
                    element.children[i] = area_mark
                else:
                    element.children[i] = AreaMark(child)
        elif "line" in element.attributes.get("aria-roledescription", ''):
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    area_mark = PathMark(child.children[0])
                    element.children[i] = area_mark
                else:
                    element.children[i] = PathMark(child)
        return element

    def _handle_pie(self, element):
        for i, child in enumerate(element.children):
            if child.tag=='g':
                pie_mark = ArcMark(child.children[0])
                element.children[i] = pie_mark
            else:
                element.children[i] = ArcMark(child)
        return element
    
    def _handle_connectedscatter(self, element):
        if 'point' in element.attributes.get('aria-roledescription', '') or 'symbol' in element.attributes.get('aria-roledescription', ''):
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    connectedscatter_mark = PointMark(child.children[0])
                    element.children[i] = connectedscatter_mark
                else:
                    element.children[i] = PointMark(child)
        elif 'line' in element.attributes.get('aria-roledescription', ''):
            for i, child in enumerate(element.children):
                if child.tag=='g':
                    connectedscatter_mark = PathMark(child.children[0])
                    element.children[i] = connectedscatter_mark
                else:
                    element.children[i] = PathMark(child)
        return element
    
    def _handle_scatter(self, element):
        for i, child in enumerate(element.children):
            if child.tag=='g':
                scatter_mark = PointMark(child.children[0])
                element.children[i] = scatter_mark
            else:
                element.children[i] = PointMark(child)
        return element

    def if_mark_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            ('role-mark' in group.attributes.get('class', '') or \
             'role-scope' in group.attributes.get('class', '')) and \
            'graphics-object' in group.attributes.get('role', '') and \
            'mark container' in group.attributes.get('aria-roledescription', '') \
            and 'text' not in group.attributes.get('aria-roledescription', '') \
            and 'role-legend' not in group.attributes.get('class', '')
        # return False
    
    def if_mark_annotation_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'role-mark' in group.attributes.get('class', '') and \
            'graphics-object' in group.attributes.get('role', '') and \
            'mark container' in group.attributes.get('aria-roledescription', '') and \
            'text' in group.attributes.get('aria-roledescription', '')
    
    def if_axis_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'mark-group role-axis' in group.attributes.get('class', '') and \
            'axis' in group.attributes.get('aria-roledescription', '')

    def if_x_axis_group(self, group: LayoutElement) -> bool:
        return self.if_axis_group(group) and 'X-axis' in group.attributes.get('aria-label', '')

    def if_y_axis_group(self, group: LayoutElement) -> bool:
        return self.if_axis_group(group) and 'Y-axis' in group.attributes.get('aria-label', '')
    
    
    def if_legend_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            ('role-legend' in group.attributes.get('class', '') or \
             'legend' in group.attributes.get('aria-roledescription', '') or \
             'legend' in group.attributes.get('aria-label', ''))
    
    def if_axis_title_group(self, element: LayoutElement) -> bool:
        return element.tag == 'g' and \
            'role-axis-title' in element.attributes.get('class', '')

    def if_axis_label_group(self, element: LayoutElement) -> bool:
        return element.tag == 'g' and \
            'role-axis-label' in element.attributes.get('class', '')

    def if_axis_tick_group(self, element: LayoutElement) -> bool:
        return element.tag == 'g' and \
            'role-axis-tick' in element.attributes.get('class', '')

    def if_axis_domain_group(self, element: LayoutElement) -> bool:
        return element.tag == 'g' and \
            'role-axis-domain' in element.attributes.get('class', '')
    
    def _handle_axis_conmponent_group(self, group_name, element):
        new_element = GroupElement()
        new_element.attributes['class'] = f"{group_name}-group"
        copy_attributes(element, new_element)
        copy_children(element, new_element)
        return new_element
    
    def _handle_axis_label_group(self, element):
        current_context = self.context_stack[-1]
        for i, child in enumerate(element.children):
            new_element = AxisLabel(child)
            element.children[i] = new_element
            self.axis_labels.append(new_element)
            if current_context == 'x_axis_group':
                new_element.axis_orient = "bottom"
                new_element.axis_type = "x"
            elif current_context == 'y_axis_group':
                new_element.axis_orient = "left"
                new_element.axis_type = "y"
            # print("new_element.axis_orient: ", new_element.axis_orient)
        return element
    
    def _handle_axis_tick_group(self, element):
        for i, child in enumerate(element.children):
            new_element = AxisTick(child)
            element.children[i] = new_element
        return element
    
    def _handle_axis_title_group(self, element):
        for i, child in enumerate(element.children):
            new_element = AxisTitle(child)
            element.children[i] = new_element
        return element
    
    def _handle_axis_domain_group(self, element):
        for i, child in enumerate(element.children):
            new_element = AxisDomain(child)
            element.children[i] = new_element
        return element
    
    def _handle_axis_group(self, element, xory: str):
        new_element = Axis(xory)
        copy_attributes(element, new_element)
        copy_children(element, new_element)
        self._process_axis_componenet(new_element)
        self.axes.append(new_element)
        return new_element
    
    def _process_axis_componenet(self, element):
        for i, child in enumerate(element.children):
            if self.if_axis_title_group(child):
                new_element = self._handle_axis_conmponent_group("axis_title", child)
                element.children[i] = self._handle_axis_title_group(new_element)
            elif self.if_axis_label_group(child):
                new_element = self._handle_axis_conmponent_group("axis_label", child)
                # print("new_element: ", new_element)
                element.children[i] = self._handle_axis_label_group(new_element)
            elif self.if_axis_tick_group(child):
                new_element = self._handle_axis_conmponent_group("axis_tick", child)
                element.children[i] = self._handle_axis_tick_group(new_element)
            elif self.if_axis_domain_group(child):
                new_element = self._handle_axis_conmponent_group("axis_domain", child)
                element.children[i] = self._handle_axis_domain_group(new_element)
