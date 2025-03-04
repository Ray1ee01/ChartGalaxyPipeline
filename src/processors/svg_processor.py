from ..interfaces.base import SVGProcessor
from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
import random
from ..utils.node_bridge import NodeBridge
import os
import json
import base64
import requests
from urllib.parse import urlparse
import mimetypes
from .svg_processor_modules.vegalite_parser import SVGParser
from .svg_processor_modules.layout_processor import LayoutProcessor
from .svg_processor_modules.tree_converter import SVGTreeConverter
from .svg_processor_modules.elements import *
from ..template.template import LayoutTemplate
import time
from .svg_processor_modules.variation import ImageChart

default_additional_configs = {
    "iconAttachConfig": {
        "method": "juxtaposition",
        "attachTo": "y-axis",
        "iconUrls": [],
        "attachToMark": {
            "sizeRatio": 1,
            "padding": 0,
            "relative": ["start", "inner"] # 相对于mark的位置 可能的取值有 ["start", "inner"], ["end", "inner"], ["end", "outer"], ["middle", "inner"]
        },
        "attachToAxis": {
            "padding": 0
        }
    },
    "titleConfig": {
        "title": {
            "text": ["The Countries With The Highest","Density Of Robot Workers"],
            "fontSize": 12,
            "fontFamily": "sans-serif",
            "fontWeight": "bold",
            "color": "#000000",
            "textAnchor": "left",
        },
        "subtitle": {
            "text": ["Installed industrial robots per 10,000 employees in","the manufacturing industry in 2019*"],
            "fontSize": 12,
            "fontFamily": "sans-serif",
            "fontWeight": "normal",
            "color": "#808080",
            "textAnchor": "left"
        }
    },
    "topicIconConfig": {
        "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm.png"
    },
    "floatIconConfig": {
        "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm.png",
        "size": 50,  # 图标大小
        "padding": 10,  # 与其他元素的最小间距
        "preferredArea": "bottom-right"  # 优先查找区域: top-right, top-left, bottom-right, bottom-left
    },
    # there are three elements to be layout: chart, title->{title, subtitle} and topicIcon
    "layoutConfig": {
        # first the global layout is defined by a layout tree, and nodes in the same level are specified by layout rules
        "layoutTree": {
            "tag": "root",
            "layoutRules": {
                "layoutType": "vertical",
                "padding": 10,
                "verticalAlign": "middle", # middle, top, bottom
                "horizontalAlign": "middle" # middle, left, right
            },
            "children": [
                {
                    "tag": "chart",
                    "children": []
                },
                {
                    "tag": "global_title_group",
                    "layoutRules": {
                        "layoutType": "horizontal",
                        "padding": 0,
                        "verticalAlign": "top", # top, middle, bottom
                        "horizontalAlign": "middle" # left, middle, right
                    },
                    "children": [
                        {
                            "tag": "title_group",
                            "layoutRules": {
                                "layoutType": "vertical",
                                "padding": 10,
                                "verticalAlign": "middle", # top, middle, bottom
                                "horizontalAlign": "left" # left, middle, right
                            },
                            "children": [
                                {
                                    "tag": "title_text",
                                    "children": []
                                },
                                {
                                    "tag": "subtitle_text",
                                    "children": []
                                }
                            ]
                        },
                    ]
                },
            ]
        }
    }
}

class SVGOptimizer(SVGProcessor):
    def __init__(self):
        self.node_bridge = NodeBridge()
        # 获取当前文件所在目录
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # 构建measure_text.js的路径
        self.measure_script_path = os.path.join(current_dir, 'svg_processor_modules', 'text_tool', 'measure_text.js')

    def process(self, svg: str, additional_configs: Dict, debug: bool = False) -> Union[dict, str]:
        """处理SVG
        
        Args:
            svg: SVG字符串
            additional_configs: 额外的配置信息
            debug: 是否返回中间结果用于调试
        
        Returns:
            Union[dict, str]: 如果debug为True，返回处理后的树结构；否则返回处理后的SVG字符串
        """
        # 丢弃svg中所有tag为rect且fill为#ffffff的rect
        # print('svg: ', svg)
        svg = re.sub(r"<rect[^>]*fill=\"#ffffff\"[^>]*>", '', svg)
        # return svg
        # print('additional_configs: ', additional_configs)
        time_start = time.time()
        parser = SVGParser(svg, additional_configs)
        parsed_svg, chart_element_tree, layout_graph, defs = parser.parse()
        
        chart_element = Chart()
        copy_children(chart_element_tree, chart_element)
        copy_attributes(chart_element_tree, chart_element)
        

        
        image_url = "D:/VIS/Infographics/data/svg/Netflix_2015_logo.svg.png"
        base64_image = Image._getImageAsBase64(image_url)
        image_element = UseImage(base64_image)
        image_chart = ImageChart(chart_element, image_element)
        config = {
            # "variation_type": "behind",
            "variation_type": "overlay",
        }
        chart_element, image_element = image_chart.process(config)
        
        infographics = Infographics()
        infographics.children = [chart_element, image_element]
        
        
        
        time_end = time.time()
        print(f'parser time cost: {time_end - time_start}s')
        
        element_tree = infographics

        # root_element = element_tree
        # # # return parsed_svg
        
        # if additional_configs.get('title_config').get('max_width_ratio'):
        #     additional_configs['title_config']['max_width'] = flattened_elements_tree.get_bounding_box().width * additional_configs['title_config']['max_width_ratio']
        # else:
        #     additional_configs['title_config']['max_width'] = flattened_elements_tree.get_bounding_box().width
        # if additional_configs.get('subtitle_config').get('max_width_ratio'):
        #     additional_configs['subtitle_config']['max_width'] = flattened_elements_tree.get_bounding_box().width * additional_configs['subtitle_config']['max_width_ratio']
        # else:
        #     additional_configs['subtitle_config']['max_width'] = flattened_elements_tree.get_bounding_box().width
        
        layout_template = LayoutTemplate()
        # print('additional_configs["layout_tree"]: ', additional_configs["layout_tree"])
        layout_template.root = layout_template.build_template_from_tree(additional_configs["layout_tree"])
        
        layout_template = additional_configs['layout_template']
        time_start = time.time()
        layout_processor = LayoutProcessor(element_tree, layout_graph, layout_template, additional_configs)
        time_end = time.time()
        print(f'layout_processor init time cost: {time_end - time_start}s')
        time_start = time.time()
        element_tree = layout_processor.process()
        time_end = time.time()
        print(f'layout_processor process time cost: {time_end - time_start}s')
        
        root_element = element_tree
        

        

        # element_list = SVGTreeConverter.flatten_tree(element_tree)
        # element_list = SVGTreeConverter.flatten_tree(flattened_elements_tree)
        # root_element = GroupElement()
        # root_element.children = element_list
        # # print('root_element.children: ', root_element.dump())
        
        # # 从element_tree中找到所有mark_group, legend_group, x_axis_group, y_axis_group
        # mark_group = []
        # legend_group = []
        # x_axis_group = []
        # y_axis_group = []
        # title_group = []
        # subtitle_group = []
        # description_group = []
        # for element in root_element.children:
        #     if self.if_in_mark_group(element):
        #         mark_group.append(element)
        #     elif self.if_in_legend_group(element):
        #         legend_group.append(element)
        #     elif self.if_in_x_axis_group(element):
        #         x_axis_group.append(element)
        #     elif self.if_in_y_axis_group(element):
        #         y_axis_group.append(element)
        #     elif self.if_in_title_group(element):
        #         title_group.append(element)
        #     elif self.if_in_subtitle_group(element):
        #         subtitle_group.append(element)
        #     elif self.if_description_group(element):
        #         description_group.append(element)
        # print('mark_group: ', mark_group)
        # print('legend_group: ', legend_group)
        # print('x_axis_group: ', x_axis_group)
        # print('y_axis_group: ', y_axis_group)
        # print('title_group: ', title_group)
        # print('subtitle_group: ', subtitle_group)
        
        
        

        
        
        # print('mark_group_element.bounding_box: ', mark_group_element.get_bounding_box())
        # print('legend_group_element.bounding_box: ', legend_group_element.get_bounding_box())
        # print('x_axis_group_element.bounding_box: ', x_axis_group_element.get_bounding_box())
        # print('y_axis_group_element.bounding_box: ', y_axis_group_element.get_bounding_box())
        # print('title_group_element.bounding_box: ', title_group_element.get_bounding_box())
        # print('subtitle_group_element.bounding_box: ', subtitle_group_element.get_bounding_box())
        
        
        # 在root_element中添加多个rect，用于显示这些group的bounding_box
        # rects = []
        # points = []
        # for element in root_element.children:
        #     # if not element.tag == 'path' or element.attributes.get('aria-roledescription') != 'area mark':
        #     #     continue
        #     # print('element: ', element.content, element._bounding_box)
        #     bounding_box = element.get_bounding_box()
        #     # print('bounding_box: ', bounding_box)
        #     rect = Rect()
        #     rect.attributes = {
        #         "stroke": "red",
        #         "stroke-width": 1,
        #         "fill": "none",
        #         "x": bounding_box.minx,
        #         "y": bounding_box.miny,
        #         "width": bounding_box.maxx - bounding_box.minx,
        #         "height": bounding_box.maxy - bounding_box.miny,
        #     }
        #     rects.append(rect)
        #     # if element.tag == 'path':
        #     #     points.extend(element._get_path_coordinates())
        # # for rect in rects:
        # #     root_element.children.append(rect)
        # # for point in points:
        # #     root_element.children.append(Circle(point[0], point[1], 5))
        # element_tree = root_element
        
        # 获取root的bounding_box
        root_bounding_box = root_element.get_bounding_box()
        
        shift_x = -root_bounding_box.minx
        shift_y = -root_bounding_box.miny
        # random_padding = 50 * random.random()
        # random_padding = 0
        random_padding = 50
        shift_x += random_padding
        shift_y += random_padding
        
        root_element.attributes['transform'] = f"translate({shift_x}, {shift_y})"
        
        
        bounding_boxes = {}
        
        # if len(mark_group) > 0:
        #     mark_group_element = GroupElement()
        #     mark_group_element.children = mark_group
        #     root_element.children.append(mark_group_element)
        #     # bounding_boxes['mark_group'] = mark_group_element.get_bounding_box().format()
        #     # bounding_boxes['mark_group']['minx'] += shift_x
        #     # bounding_boxes['mark_group']['miny'] += shift_y
        #     # bounding_boxes['mark_group']['maxx'] += shift_x
        #     # bounding_boxes['mark_group']['maxy'] += shift_y
        # if len(legend_group) > 0:
        #     legend_group_element = GroupElement()
        #     legend_group_element.children = legend_group
        #     root_element.children.append(legend_group_element)
        #     # bounding_boxes['legend_group'] = legend_group_element.get_bounding_box().format()
        #     # bounding_boxes['legend_group']['minx'] += shift_x
        #     # bounding_boxes['legend_group']['miny'] += shift_y
        #     # bounding_boxes['legend_group']['maxx'] += shift_x
        #     # bounding_boxes['legend_group']['maxy'] += shift_y
        # if len(x_axis_group) > 0:
        #     x_axis_group_element = GroupElement()
        #     x_axis_group_element.children = x_axis_group
        #     root_element.children.append(x_axis_group_element)
        #     # bounding_boxes['x_axis_group'] = x_axis_group_element.get_bounding_box().format()
        #     # bounding_boxes['x_axis_group']['minx'] += shift_x
        #     # bounding_boxes['x_axis_group']['miny'] += shift_y
        #     # bounding_boxes['x_axis_group']['maxx'] += shift_x
        #     # bounding_boxes['x_axis_group']['maxy'] += shift_y
        # if len(y_axis_group) > 0:
        #     y_axis_group_element = GroupElement()
        #     y_axis_group_element.children = y_axis_group
        #     root_element.children.append(y_axis_group_element)
        #     # bounding_boxes['y_axis_group'] = y_axis_group_element.get_bounding_box().format()
        #     # bounding_boxes['y_axis_group']['minx'] += shift_x
        #     # bounding_boxes['y_axis_group']['miny'] += shift_y
        #     # bounding_boxes['y_axis_group']['maxx'] += shift_x
        #     # bounding_boxes['y_axis_group']['maxy'] += shift_y
        # if len(title_group) > 0:
        #     title_group_element = GroupElement()
        #     title_group_element.children = title_group
        #     root_element.children.append(title_group_element)
        #     # bounding_boxes['title_group'] = title_group_element.get_bounding_box().format()
        #     # bounding_boxes['title_group']['minx'] += shift_x
        #     # bounding_boxes['title_group']['miny'] += shift_y
        #     # bounding_boxes['title_group']['maxx'] += shift_x
        #     # bounding_boxes['title_group']['maxy'] += shift_y
        # if len(subtitle_group) > 0:
        #     subtitle_group_element = GroupElement()
        #     subtitle_group_element.children = subtitle_group
        #     root_element.children.append(subtitle_group_element)
        #     # bounding_boxes['subtitle_group'] = subtitle_group_element.get_bounding_box().format()
        #     # bounding_boxes['subtitle_group']['minx'] += shift_x
        #     # bounding_boxes['subtitle_group']['miny'] += shift_y
        #     # bounding_boxes['subtitle_group']['maxx'] += shift_x
        #     # bounding_boxes['subtitle_group']['maxy'] += shift_y
        # if len(description_group) > 0:
        #     description_group_element = GroupElement()
        #     description_group_element.children = description_group
        #     root_element.children.append(description_group_element)
        #     # bounding_boxes['description_group'] = description_group_element.get_bounding_box().format()
        #     # bounding_boxes['description_group']['minx'] += shift_x
        #     # bounding_boxes['description_group']['miny'] += shift_y
        #     # bounding_boxes['description_group']['maxx'] += shift_x
        #     # bounding_boxes['description_group']['maxy'] += shift_y
        # # 把原先的mark_group, legend_group, x_axis_group, y_axis_group, title_group, subtitle_group删除
        # root_element.children = [child for child in root_element.children if child not in mark_group and child not in legend_group and child not in x_axis_group and child not in y_axis_group and child not in title_group and child not in subtitle_group and child not in description_group]
        
        # images = []
        # for element in root_element.children:
        #     if self.if_image(element):
        #         images.append(element)
        #     if element.tag == 'g':
        #         for child in element.children:
        #             if self.if_image(child):
        #                 images.append(child)
        # bounding_boxes['images'] = [image.get_bounding_box().format() for image in images]
        # for image in bounding_boxes['images']:
        #     image['minx'] += shift_x
        #     image['miny'] += shift_y
        #     image['maxx'] += shift_x
        #     image['maxy'] += shift_y
        
        
        
        # random_padding = 50 * random.random()
        
        # root_bounding_box.minx -= random_padding
        # root_bounding_box.miny -= random_padding
        # root_bounding_box.maxx += random_padding
        # root_bounding_box.maxy += random_padding
        
        
        
        attrs_list = []
        parser.svg_root['attributes']['width'] = root_bounding_box.maxx - root_bounding_box.minx
        parser.svg_root['attributes']['height'] = root_bounding_box.maxy - root_bounding_box.miny
        parser.svg_root['attributes']['viewBox'] = f"0 0 {root_bounding_box.maxx - root_bounding_box.minx + 2 * random_padding} {root_bounding_box.maxy - root_bounding_box.miny + 2 * random_padding}"
        # parser.svg_root['attributes']['viewBox'] = f"{root_bounding_box.minx} {root_bounding_box.miny} {root_bounding_box.maxx - root_bounding_box.minx} {root_bounding_box.maxy - root_bounding_box.miny}"
        for key, value in parser.svg_root['attributes'].items():
            attrs_list.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs_list)
        svg_left = f"<svg {attrs_str} xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
        svg_right = f"</svg>"
        # element_tree.attributes['transform'] = "translate(300,100)"
        # try:
        #     background_image = additional_configs['background_image']['url']
        #     background_image_element = Image()
        #     base64_image = Image._getImageAsBase64(background_image)
        #     background_image_element.attributes['xlink:href'] = f"data:{base64_image}"
        #     background_image_element.attributes['width'] = "100%"
        #     background_image_element.attributes['height'] = "100%"
        #     # root_element.children.append(background_image_element)
        #     # 把background_image_element插入到root_element的children的第一个位置
        #     element_tree.children.insert(0, background_image_element)
        # except:
        #     print("no background image")
        svg_str = SVGTreeConverter.element_tree_to_svg(element_tree)
        print("svg str")
        
        
        background_color = additional_configs['background_config']['color']
        svg_str = f"<rect width=\"100%\" height=\"100%\" fill=\"{background_color}\"/>\n" + svg_str
        if defs:
            svg_str = svg_str + defs
        svg_str = svg_left + svg_str + svg_right
        # print("bounding_boxes: ", bounding_boxes)
        return svg_str, bounding_boxes
        # # return svg
        # # 解析SVG为树结构
        # tree = self.parseTree(svg)
        # if not tree:
        #     return svg
        
        # # 添加边界框信息
        # self._addBBoxToTree(tree)
        
        # # 查找坐标轴和marks
        # axes = self._findAxes(tree)
        # marks = self._findMarks(tree)
        # total_configs = {**default_additional_configs, **additional_configs}
        
        # # 处理icon附加
        # if total_configs.get("iconAttachConfig"):
        #     self._processIconAttachment(tree, total_configs["iconAttachConfig"], axes, marks)
        
        
        # # 处理整体布局（包括标题、副标题、主题图标等）
        # if any(key in total_configs for key in ['titleConfig', 'topicIconConfig', 'layoutConfig']):
        #     self._processLayout(tree, total_configs)
        
        # # 添加浮动图标
        # if total_configs.get("floatIconConfig"):
        #     self._processFloatIcon(tree, total_configs["floatIconConfig"])
        
        # # print(tree)
        # # 返回结果
        # if debug:
        #     return tree
        # return self._treeToSVG(tree)

    def _treeToSVG(self, node: dict) -> str:
        """将树结构转换回SVG字符串
        
        Args:
            node: 树节点
            
        Returns:
            str: SVG字符串
        """
        # 获取标签名
        tag = node['tag']
        
        # 构建属性字符串
        attrs = []
        for key, value in node.get('attributes', {}).items():
            # 处理特殊字符
            value = str(value).replace('"', '&quot;')
            attrs.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs)
        
        # 处理文本内容
        text_content = node.get('text', '')
        
        # 处理子节点
        children_content = []
        for child in node.get('children', []):
            children_content.append(self._treeToSVG(child))
        children_str = '\n'.join(children_content)
        
        # 构建完整的标签
        if children_content or text_content:
            # 如果有子节点或文本内容，使用开闭标签
            content = text_content + '\n' + children_str if text_content else children_str
            return f"<{tag} {attrs_str}>{content}</{tag}>"
        else:
            # 如果是空标签，使用自闭合形式
            return f"<{tag} {attrs_str}/>"

    def _addBBoxToTree(self, node: dict, parent_transform: List[float] = None) -> None:
        """递归地为树中的每个节点添加边界框
        
        Args:
            node: 当前节点
            parent_transform: 父节点的变换矩阵
        """
        # 获取当前节点的变换
        current_transform = None
        if 'attributes' in node and 'transform' in node['attributes']:
            current_transform = self._parseTransform(node['attributes']['transform'])
        
        # 如果有父节点的变换，将其应用到当前节点
        if parent_transform:
            # 移除当前节点的transform属性，因为它已经被包含在计算中
            # if 'transform' in node['attributes']:
            #     del node['attributes']['transform']
            
            # 获取当前节点的边界框
            bbox = self.getBBox(node)
            if bbox:
                # 应用父节点的变换
                node['bbox'] = self._applyTransform(
                    bbox['minX'], bbox['minY'],
                    bbox['maxX'], bbox['maxY'],
                    parent_transform
                )
        else:
            # 如果没有父节点变换，直接获取边界框
            bbox = self.getBBox(node)
            if bbox:
                node['bbox'] = bbox
        
        # 计算传递给子节点的变换矩阵
        transform_for_children = None
        if current_transform and parent_transform:
            if isinstance(current_transform, list) and len(current_transform) == 2:
                # 如果是双矩阵变换，需要特殊处理
                transform_for_children = [
                    self._combineTransforms(parent_transform, current_transform[0]),
                    current_transform[1]
                ]
            else:
                # 组合当前变换和父节点变换
                transform_for_children = self._combineTransforms(parent_transform, current_transform)
        elif current_transform:
            transform_for_children = current_transform
        elif parent_transform:
            transform_for_children = parent_transform
        
        # 递归处理子节点
        if 'children' in node:
            for child in node['children']:
                self._addBBoxToTree(child, transform_for_children)

    def parseTree(self, svg: str) -> dict:
        # 创建解析器
        parser = etree.XMLParser(remove_comments=True, remove_blank_text=True)
        # 将SVG字符串解析为XML树
        tree = etree.parse(StringIO(svg), parser)
        root = tree.getroot()
        
        # 递归解析节点
        return self._parse_node(root)

    def if_in_mark_group(self, element: LayoutElement) -> bool:
        return ('role-mark' in element.attributes.get('class', '') or \
             'role-scope' in element.attributes.get('class', '')) and \
            ('graphics-object' in element.attributes.get('role', '')  or \
                'graphics-symbol' in element.attributes.get('role', '')) 
            
            # and \
            # 'mark container' in element.attributes.get('aria-roledescription', '')
            
    def if_in_legend_group(self, element: LayoutElement) -> bool:
        return 'role-legend' in element.attributes.get('class', '')
            # 'legend' in element.attributes.get('aria-roledescription', '')
    
    def if_in_x_axis_group(self, element: LayoutElement) -> bool:
        return 'X-axis' in element.attributes.get('aria-label', '')
    
    def if_in_y_axis_group(self, element: LayoutElement) -> bool:
        return 'Y-axis' in element.attributes.get('aria-label', '')
    
    def if_in_title_group(self, element: LayoutElement) -> bool:
        return 'chart-title' in element.attributes.get('class', '')
    
    def if_in_subtitle_group(self, element: LayoutElement) -> bool:
        return 'chart-subtitle' in element.attributes.get('class', '')
    
    def if_image(self, element: LayoutElement) -> bool:
        return element.tag == 'image'

    def if_description_group(self, element: LayoutElement) -> bool:
        return 'description' in element.attributes.get('class', '')
    