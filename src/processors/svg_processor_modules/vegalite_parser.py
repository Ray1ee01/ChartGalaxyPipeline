from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .elements import *
from .layout import *
import random

class VegaLiteParser():
    def __init__(self, svg: str, additional_configs: Dict):
        self.svg = svg
        self.additional_configs = additional_configs
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
        }
        
        # flattened_elements_tree = SVGTreeConverter.partial_flatten_tree(elements_tree, group_to_flatten)
        flattened_elements_tree, top_level_groups = SVGTreeConverter.move_groups_to_top(elements_tree, group_to_flatten)
        
        # 移除tree中所有class为background的元素

            
        flattened_elements_tree = SVGTreeConverter.remove_elements_by_class(flattened_elements_tree, 'background')
        flattened_elements_tree = SVGTreeConverter.remove_elements_by_class(flattened_elements_tree, 'foreground')
        
        
        # print("top_level_groups['y_axis_group']: ", top_level_groups['y_axis_group'])
        mark_group = top_level_groups['mark_group']
        x_axis_group = top_level_groups['x_axis_group']
        y_axis_group = top_level_groups['y_axis_group']
        # x_axis_label_group = top_level_groups['x_axis_label_group']
        # y_axis_label_group = top_level_groups['y_axis_label_group']
        x_axis_label_group = [element for element in top_level_groups['x_axis_group'] if element.tag == 'text' and "role-axis-label" in element.attributes.get('class', '')]
        y_axis_label_group = [element for element in top_level_groups['y_axis_group'] if element.tag == 'text' and "role-axis-label" in element.attributes.get('class', '')]
        mark_annotation_group = top_level_groups['mark_annotation_group']
        # debug: add rect to flattened_elements_tree
        
        layout_graph = LayoutGraph()
        
            
        orientation = self.additional_configs['chart_template'].mark.orientation
        direction = ""
        if orientation == "horizontal":
            axis_orientation = self.additional_configs['chart_template'].x_axis.orientation
        else:
            #交换 y_axis_label_group 和 x_axis_label_group
            # y_axis_label_group = x_axis_label_group
            # x_axis_label_group = y_axis_label_group
            x_axis_label_group, y_axis_label_group = y_axis_label_group, x_axis_label_group
            x_axis_group, y_axis_group = y_axis_group, x_axis_group
            axis_orientation = self.additional_configs['chart_template'].x_axis.orientation
        
        if axis_orientation == "left":
            direction = "right"
        elif axis_orientation == "right":
            direction = "left"
        elif axis_orientation == "top":
            direction = "down"
        else:
            direction = "up"
        
        sequence = self.additional_configs['chart_composition']['sequence']
        relative_to_mark = self.additional_configs['chart_composition']['relative_to_mark']
        
        print("mark_group: ", mark_group)
        # print("mark_annotation_group: ", mark_annotation_group)
        # print("y_axis_label_group: ", y_axis_label_group)
        # build inital layout graph
        if "mark_annotation" in sequence:
            if direction == "up" or direction == "down":
                min_mark_width = max([mark.get_bounding_box().width for mark in mark_group])
                max_annotation_width = max([mark_annotation.get_bounding_box().width for mark_annotation in mark_annotation_group])
                if min_mark_width < max_annotation_width:
                    for i in range(len(mark_annotation_group)):
                        if direction == "up":
                            if self.additional_configs['chart_template'].mark.annotation_side == "inner":
                                mark_annotation_group[i].rotate_to_fit("top")
                            else:
                                mark_annotation_group[i].rotate_to_fit("bottom")
                        else:
                            if self.additional_configs['chart_template'].mark.annotation_side == "inner":
                                mark_annotation_group[i].rotate_to_fit("bottom")
                            else:
                                mark_annotation_group[i].rotate_to_fit("top")
            
            
        for i in range(len(mark_group)):
            if "mark_annotation" in sequence:
                mark_group[i]._bounding_box = mark_group[i].get_bounding_box()
                mark_annotation_group[i]._bounding_box = mark_annotation_group[i].get_bounding_box()
                y_axis_label_group[i]._bounding_box = y_axis_label_group[i].get_bounding_box()
                layout_strategy_1 = parse_layout_strategy(mark_group[i], mark_annotation_group[i], orientation)
                layout_strategy_2 = parse_layout_strategy(mark_group[i], y_axis_label_group[i], orientation)
                layout_graph.add_edge_by_value(mark_group[i], mark_annotation_group[i], layout_strategy_1)
                layout_graph.add_edge_by_value(mark_group[i], y_axis_label_group[i], layout_strategy_2)
            else:
                mark_group[i]._bounding_box = mark_group[i].get_bounding_box()
                mark_annotation_group[i]._bounding_box = mark_annotation_group[i].get_bounding_box()
                layout_strategy_1 = parse_layout_strategy(mark_group[i], mark_annotation_group[i],orientation)
                layout_graph.add_edge_by_value(mark_group[i], mark_annotation_group[i], layout_strategy_1)
        
        temporal_group_element = GroupElement()
        temporal_group_element.tag = "g"
        temporal_group_element.id = "temporal_group"
        temporal_group_element.children = y_axis_label_group
        temporal_group_element._bounding_box = temporal_group_element.get_bounding_box()
        
        # y_axis_title_element = 
        # 从y_axis_group中找到title对应的element
        for element in y_axis_group:
            if element.tag == "text":
                # 如果class attribute中有"role-axis-title"
                if "role-axis-title" in element.attributes.get('class', ''):
                    y_axis_title_element = element
                    break
        layout_strategy_3 = parse_layout_strategy(temporal_group_element, y_axis_title_element, orientation)
        layout_graph.add_edge_by_value(temporal_group_element, y_axis_title_element, layout_strategy_3)
        # print("layout_strategy_3: ", layout_strategy_3.name, layout_strategy_3.direction, layout_strategy_3.padding, layout_strategy_3.offset, layout_strategy_3.alignment)
        # 把 paading的绝对值改成5，保证正负和之前不变
        if layout_strategy_3.padding < 0:
            layout_strategy_3.padding = -5
        else:
            layout_strategy_3.padding = 5
        nodemap = layout_graph.node_map
        node = nodemap[y_axis_title_element]
        temporal_edge = node.prevs_edges[0]
        
        # 从single和multi中随机取一个
        # icon_type = random.choice(["single", "multi"])
        icon_type = "multi"
        if icon_type == "multi":
            image_urls = self.additional_configs['x_data_multi_url']
        else:
            image_urls = [self.additional_configs['x_data_single_url']]*len(mark_group)
        # print("image_urls: ", image_urls)
        # image_urls = []
        for i in range(len(image_urls)):
            base64_image = Image._getImageAsBase64(image_urls[i])
            image_element = Image(base64_image)
            original_width, original_height = Image.get_image_size(image_urls[i])
            image_element.original_width = original_width
            image_element.original_height = original_height
            aspect_ratio = original_width / original_height
            
            # 计算新的width和height
            if orientation == "horizontal":
                height = mark_group[i].get_bounding_box().height * 1.1
                width = height * aspect_ratio
            else:
                width = mark_group[i].get_bounding_box().width * 1.1
                height = width / aspect_ratio
            image_element.attributes = {
                "xlink:href": f"data:{base64_image}",
                "width": width,
                "height": height,
            }
            boundingbox = image_element.get_bounding_box()
            image_element._bounding_box = boundingbox
            
            if orientation == "horizontal":
                if relative_to_mark and relative_to_mark[0] == "inside":
                    layout_strategy = InnerHorizontalLayoutStrategy()
                    if relative_to_mark[1] == "start" and direction == "right":
                        layout_strategy.direction = 'left'
                    elif relative_to_mark[1] == "end" and direction == "right":
                        layout_strategy.direction = 'right'
                    elif relative_to_mark[1] == "start" and direction == "left":
                        layout_strategy.direction = 'left'
                    elif relative_to_mark[1] == "end" and direction == "left":
                        layout_strategy.direction = 'right'
                    elif relative_to_mark[1] == "middle":
                        layout_strategy = MiddleHorizontalLayoutStrategy()
                else:
                    layout_strategy = HorizontalLayoutStrategy()
            else:
                if relative_to_mark and relative_to_mark[0] == "inside":
                    layout_strategy = InnerVerticalLayoutStrategy()
                    if relative_to_mark[1] == "start" and direction == "down":
                        layout_strategy.direction = 'up'
                    elif relative_to_mark[1] == "end" and direction == "down":
                        layout_strategy.direction = 'down'
                    elif relative_to_mark[1] == "start" and direction == "up":
                        layout_strategy.direction = 'up'
                    elif relative_to_mark[1] == "end" and direction == "up":
                        layout_strategy.direction = 'down'
                    elif relative_to_mark[1] == "middle":
                        layout_strategy = MiddleVerticalLayoutStrategy()
                else:
                    layout_strategy = VerticalLayoutStrategy()
            
            # 如果在sequence里,"axis_label"在"x_multiple_icon"之前
            if "axis_label" in sequence and "x_multiple_icon" in sequence and sequence.index("axis_label") < sequence.index("x_multiple_icon") and not relative_to_mark[0] == "inside" and sequence.index("x_multiple_icon") < sequence.index("mark"):
                print("chart-image-template: 2")
                print("direction: ", direction)
                # layout_strategy.direction与direction相反，如果direction是right，则layout_strategy.direction是left
                if direction == "right":
                    layout_strategy.direction = "left"
                elif direction == "left":
                    layout_strategy.direction = "right"
                elif direction == "down":
                    layout_strategy.direction = "up"
                else:
                    layout_strategy.direction = "down"
                layout_graph.add_node_with_edges(image_element, y_axis_label_group[i], layout_strategy)
                node = layout_graph.node_map[image_element]
                print("node: ", node.value.tag, node.value._bounding_box)
                for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
                    print("prev_layout_strategy: ", prev_layout_strategy.value.name, prev_layout_strategy.value.direction, prev_layout_strategy.value.padding, prev_layout_strategy.value.offset, prev_layout_strategy.value.alignment)
                    print("prev: ", prev.value.tag, prev.value._bounding_box)
                    prev_layout_strategy.process_layout()
                for next, next_layout_strategy in zip(node.nexts, node.nexts_edges):
                    print("next_layout_strategy: ", next_layout_strategy.value.name, next_layout_strategy.value.direction, next_layout_strategy.value.padding, next_layout_strategy.value.offset, next_layout_strategy.value.alignment)
                    print("next: ", next.value.tag, next.value._bounding_box)
                    next_layout_strategy.process_layout()

                flattened_elements_tree.children.append(image_element)
            elif "axis_label" in sequence and "x_multiple_icon" in sequence and sequence.index("axis_label") > sequence.index("x_multiple_icon"):
                print("chart-image-template: 1")
                if direction == "right":
                    layout_strategy.direction = "left"
                elif direction == "left":
                    layout_strategy.direction = "right"
                elif direction == "down":
                    layout_strategy.direction = "up"
                else:
                    layout_strategy.direction = "down"
                layout_graph.add_node_with_edges(y_axis_label_group[i], image_element, layout_strategy)
                node = layout_graph.node_map[image_element]
                for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
                    prev_layout_strategy.process_layout()
                flattened_elements_tree.children.append(image_element)
                
            elif "axis_label" in sequence and "x_multiple_icon" in sequence and sequence.index("axis_label") < sequence.index("x_multiple_icon") and relative_to_mark[0] == "inside" and relative_to_mark[1] == "start":
                print("chart-image-template: 3")
                if direction == "right":
                    layout_strategy.direction = "left"
                elif direction == "left":
                    layout_strategy.direction = "right"
                elif direction == "down":
                    layout_strategy.direction = "up"
                else:
                    layout_strategy.direction = "down"
                layout_graph.add_node_with_edges(mark_group[i], image_element, layout_strategy)
                node = layout_graph.node_map[image_element]
                for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
                    prev_layout_strategy.process_layout()
                flattened_elements_tree.children.append(image_element)
            # 如果在sequence里,"x_multiple_icon"在"mark_annotation"之后
            elif "x_multiple_icon" in sequence and "mark_annotation" in sequence and sequence.index("x_multiple_icon") > sequence.index("mark_annotation"):
                print("chart-image-template: 7")
                layout_strategy.direction = direction
                    
                layout_graph.add_node_with_edges(mark_annotation_group[i], image_element, layout_strategy)
                node = layout_graph.node_map[image_element]
                for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
                    prev_layout_strategy.process_layout()
                flattened_elements_tree.children.append(image_element)
            # 如果在sequence里,"x_multiple_icon"在"mark_annotation"之前，且在"mark"之后
            elif "x_multiple_icon" in sequence and "mark_annotation" in sequence and sequence.index("x_multiple_icon") < sequence.index("mark_annotation") and sequence.index("x_multiple_icon") > sequence.index("mark") and not relative_to_mark[0] == "inside":
                print("chart-image-template: 6")
                layout_strategy.direction = direction
                layout_graph.add_node_with_edges(image_element, mark_annotation_group[i], layout_strategy)
                node = layout_graph.node_map[image_element]
                for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
                    prev_layout_strategy.process_layout()
                for next, next_layout_strategy in zip(node.nexts, node.nexts_edges):
                    next_layout_strategy.process_layout()
                flattened_elements_tree.children.append(image_element)
            # 如果在sequence里,"x_multiple_icon"在"mark_annotation"之前，且在"mark"之后
            elif "x_multiple_icon" in sequence and "mark_annotation" in sequence and sequence.index("x_multiple_icon") < sequence.index("mark_annotation") and sequence.index("x_multiple_icon") > sequence.index("mark") and relative_to_mark[0] == "inside":
                print("chart-image-template: 4 or 5")
                if relative_to_mark[1] == "start":
                    if direction == "right":
                        layout_strategy.direction = "left"
                    elif direction == "left":
                        layout_strategy.direction = "right"
                    elif direction == "down":
                        layout_strategy.direction = "up"
                    else:
                        layout_strategy.direction = "down"
                else:
                    layout_strategy.direction = direction
                layout_graph.add_node_with_edges(mark_group[i], image_element, layout_strategy)
                node = layout_graph.node_map[image_element]
                for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
                    prev_layout_strategy.process_layout()
                flattened_elements_tree.children.append(image_element)
            else:
                # 报错
                raise ValueError(f"不支持的sequence: {sequence}")
            
        temporal_group_element._bounding_box = temporal_group_element.get_bounding_box()
        temporal_edge.process_layout()
        
        # layout_graph.visualize()
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
        
        return svg_str, flattened_elements_tree, layout_graph
    
    
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
    
    # def append_image(self, tree: LayoutElement, image_element: LayoutElement):
    #     tree.children.append(image_element)
        
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
    
    
    