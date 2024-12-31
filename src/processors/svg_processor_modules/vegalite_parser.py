from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .layout import LayoutElement
class VegaLiteParser():
    def __init__(self, svg: str):
        self.svg = svg
        self.mark_group = None
        self.mark_annotation_group = None
        self.x_axis_group = None
        self.y_axis_group = None
        self.x_axis_label_group = None
        self.y_axis_label_group = None
        self.in_x_axis_flag = False
        self.in_y_axis_flag = False
        
    def parse(self) -> dict:
        # 解析SVG为树结构
        svg_tree = self.parseTree(self.svg)
        
        self.svg_root = {
            'tag': 'svg',
            'attributes': svg_tree['attributes'],
        }
        
        # 转换为Elements树
        elements_tree = SVGTreeConverter.convert(svg_tree)
        
        # 遍历Elements树，找到mark_group, mark_annotation_group, axis_group, x_axis_group, y_axis_group, x_axis_label_group, y_axis_label_group
        self._traverse_elements_tree(elements_tree)
        
        group_to_flatten = {
            'mark_group': self.mark_group,
            'mark_annotation_group': self.mark_annotation_group,
            'x_axis_group': self.x_axis_group,
            'y_axis_group': self.y_axis_group,
            'x_axis_label_group': self.x_axis_label_group,
            'y_axis_label_group': self.y_axis_label_group,
        }
        # elements_list = SVGTreeConverter.flatten_tree(elements_tree)
        
        flattened_elements_tree = SVGTreeConverter.partial_flatten_tree(elements_tree, group_to_flatten)
        # print(flattened_elements_tree.dump())
        # 将Elements树转换为SVG字符串
        attrs_list = []
        for key, value in self.svg_root['attributes'].items():
            attrs_list.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs_list)
        svg_left = f"<svg {attrs_str} xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
        svg_right = f"</svg>"
        svg_str = SVGTreeConverter.element_tree_to_svg(flattened_elements_tree)
        svg_str = svg_left + svg_str + svg_right
        
        return svg_str
    
    
    def if_mark_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'graphics-object' in group.attributes.get('role', '') and \
            'mark container' in group.attributes.get('aria-roledescription', '') and \
            'text' not in group.attributes.get('aria-roledescription', '')

    def if_mark_annotation_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
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
    
    def if_axis_label_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'mark-text role-axis-label' == group.attributes.get('class', '')
    
    
    def parseTree(self, svg: str) -> dict:
        # 创建解析器
        parser = etree.XMLParser(remove_comments=True, remove_blank_text=True)
        # 将SVG字符串解析为XML树
        tree = etree.parse(StringIO(svg), parser)
        root = tree.getroot()
        
        # 递归解析节点
        return self._parse_node(root)

    def _parse_node(self, node) -> dict:
        # 创建基本节点信息
        result = {
            'tag': node.tag.split('}')[-1],  # 移除命名空间
            'attributes': dict(node.attrib),
            'children': []
        }
        
        # 如果节点有文本内容，添加到结果中
        if node.text and node.text.strip():
            result['text'] = node.text.strip()
            
        # 递归处理所有子节点
        for child in node:
            result['children'].append(self._parse_node(child))
            
        return result

    def _traverse_elements_tree(self, element):
        """递归遍历元素树，识别并设置各种图表组件组"""
        # 如果是轴标签组，需要判断是属于x轴还是y轴
        if self.if_axis_label_group(element):
            if self.in_x_axis_flag:
                self.x_axis_label_group = element
            elif self.in_y_axis_flag:
                self.y_axis_label_group = element
        # 检查当前元素是否匹配任何特定组
        if self.if_mark_group(element):
            self.mark_group = element
        elif self.if_mark_annotation_group(element):
            self.mark_annotation_group = element
        elif self.if_x_axis_group(element):
            self.x_axis_group = element
            self.in_x_axis_flag = True
            if hasattr(element, 'children'):
                for child in element.children:
                    self._traverse_elements_tree(child)
            self.in_x_axis_flag = False
            return 
        elif self.if_y_axis_group(element):
            self.y_axis_group = element
            self.in_y_axis_flag = True
            if hasattr(element, 'children'):
                for child in element.children:
                    self._traverse_elements_tree(child)
            self.in_y_axis_flag = False
            return
            
        # 递归处理所有子元素
        if hasattr(element, 'children'):
            for child in element.children:
                self._traverse_elements_tree(child)