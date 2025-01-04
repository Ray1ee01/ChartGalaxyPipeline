from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .elements import *
from .layout import *

topic_icon_config = {
    "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm2.png"
}

topic_icon2_config = {
    "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm2.png"
}
title_config = {
    "text": ["The Countries With The Highest","Density Of Robot Workers"],
    "fontSize": 12,
    "fontFamily": "sans-serif",
    "fontWeight": "bold",
    "color": "#000000",
    "textAnchor": "middle",
}
subtitle_config = {
    "text": ["Installed industrial robots per 10,000 employees in ", "the manufacturing industry in 2019*"],
    "fontSize": 12,
    "fontFamily": "sans-serif",
    "fontWeight": "normal",
    "color": "#808080",
    "textAnchor": "middle"
}

layout_tree = {
    "tag": "g",
    "layoutStrategy": {
        "name": "vertical",
        "padding": 10,
        "direction": "down"
    },
    "children": [
        {
            "tag": "g",
            "id": "global_title_group",
            "layoutStrategy": {
                "name": "horizontal",
                "padding": 0,
                "direction": "right",
            },
            "children": [
                {
                    "tag": "g",
                    "id": "title_group",
                    "layoutStrategy": {
                        "name": "vertical",
                        "padding": 10,
                        "direction": "down",
                        "alignment": ["left","left"]
                    },
                    "children": [
                        {
                            "tag": "g",
                            "id": "title_text",
                            "children": []
                        },
                        {
                            "tag": "g",
                            "id": "subtitle_text",
                            "children": []
                        }
                    ]
                },
                {
                    "tag": "image",
                    "id": "topic_icon",
                }
            ]
        },
        {
            "tag": "g",
            "id": "chart",
        },
    ]
}

# layout_tree = {
#     "tag": "g",
#     "layoutStrategy": {
#         "name": "vertical",
#         "padding": 5,
#         "direction": "down"
#     },
#     "children": [
#         # {
#         #     "tag":"image",
#         #     "id": "topic_icon",
#         # },
#         {
#             "tag": "g",
#             "id": "title_text",
#             "children": []
#         },
#         {
#             "tag": "g",
#             "id": "subtitle_text",
#             "children": []
#         },
#         {
#             "tag": "g",
#             "id": "chart",
#         },
#     ]
# }

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
#                 "name": "vertical",
#                 "padding": 5,
#                 "direction": "down",
#                 "alignment": ["middle","middle"]
#             },
#             "children": [
#                 {
#                     "tag": "g",
#                     "id": "title_group",
#                     "layoutStrategy": {
#                         "name": "horizontal",
#                         "padding": 10,
#                         "direction": "right",
#                         "alignment": ["middle","middle"]
#                     },
#                     "children": [
#                         {
#                             "tag": "image",
#                             "id": "topic_icon",
#                         },
#                         {
#                             "tag": "g",
#                             "id": "title_text",
#                             "children": []
#                         },
#                         {
#                             "tag": "image",
#                             "id": "topic_icon2",
#                         },

#                     ]
#                 },
#                 {
#                     "tag": "g",
#                     "id": "subtitle_text",
#                     "children": []
#                 }
#             ]
#         },
#         {
#             "tag": "g",
#             "id": "chart",
#         },
#     ]
# }

layout_tree = {
    "tag": "g",
    "layoutStrategy": {
        "name": "horizontal",
        "padding": 10,
        "direction": "right"
    },
    "children": [
        {
            "tag": "g",
            "id": "global_title_group",
            "layoutStrategy": {
                "name": "vertical",
                "padding": 10,
                "direction": "down",
                "alignment": ["middle","middle"]
            },
            "children": [
                {
                    "tag": "g",
                    "id": "title_group",
                    "layoutStrategy": {
                        "name": "vertical",
                        "padding": 10,
                        "direction": "down",
                        "alignment": ["left","left"]
                    },
                    "children": [
                        {
                            "tag": "g",
                            "id": "title_text",
                            "children": []
                        },
                    ]
                },
                {
                    "tag": "g",
                    "id": "chart",
                },
                {
                    "tag": "g",
                    "id": "subtitle_text",
                    "children": []
                }
            ]
        },
        {
            "tag": "image",
            "id": "topic_icon"
        },
    ]
}


class LayoutProcessor:
    def __init__(self, element_tree: LayoutElement, layout_graph: LayoutGraph):
        self.element_tree = element_tree
        self.layout_graph = layout_graph
        self.layout_tree = layout_tree
        
        self.chart_element = GroupElement()
        self.chart_element.children.append(self.element_tree)
        self.element_id_map = {}
        self.element_id_map['chart'] = self.chart_element
        
    
    def process(self) -> LayoutElement:
        return self.process_node(self.layout_tree)
        
    # def process(self) -> LayoutElement:
    #     self._createTitleTextGroup(self.element_tree.layoutStrategy.title)
    #     self._createSubtitleTextGroup(self.element_tree.layoutStrategy.subtitle)
        
    def dict_to_layout_strategy(self, layout_strategy: dict) -> LayoutStrategy:
        ret_layout_strategy = None
        if layout_strategy.get('name') == 'vertical':
            ret_layout_strategy = VerticalLayoutStrategy()
        elif layout_strategy.get('name') == 'horizontal':
            ret_layout_strategy = HorizontalLayoutStrategy()
        ret_layout_strategy.padding = layout_strategy.get('padding', 0)
        ret_layout_strategy.direction = layout_strategy.get('direction', 'down')
        ret_layout_strategy.alignment = layout_strategy.get('alignment', ['middle','middle'])
        return ret_layout_strategy
    
    def process_node(self, tree: dict):
        # 自顶向下递归地创建layout element, 并应用布局
        print("tree", tree)
        if tree.get('tag') == 'g':
            if tree.get('id') == 'chart':
                self.chart_element._bounding_box = self.chart_element.get_bounding_box()
                return self.chart_element
            if tree.get('id') == 'title_text':
                title_text_group = self._createTitleTextGroup(title_config)
                self.element_id_map['title_text'] = title_text_group
                return title_text_group
            if tree.get('id') == 'subtitle_text':
                subtitle_text_group = self._createSubtitleTextGroup(subtitle_config)
                self.element_id_map['subtitle_text'] = subtitle_text_group
                return subtitle_text_group
            else:
                layout_element = GroupElement()
                layout_element.children = [self.process_node(child) for child in tree.get('children', [])]
                for child in layout_element.children:
                    self.layout_graph.add_node(Node(child))
                    child._bounding_box = child.get_bounding_box()
                layout_element.layoutStrategy = self.dict_to_layout_strategy(tree.get('layoutStrategy', {}))
                for i in range(1,len(layout_element.children)):
                    node_map = self.layout_graph.node_map
                    self.layout_graph.add_edge(node_map[layout_element.children[i-1]], node_map[layout_element.children[i]], layout_element.layoutStrategy)
                    old_node_min_x = float(node_map[layout_element.children[i]].value._bounding_box.minx)
                    old_node_min_y = float(node_map[layout_element.children[i]].value._bounding_box.miny)
                    layout_element.layoutStrategy.layout(node_map[layout_element.children[i-1]].value, node_map[layout_element.children[i]].value)
                    node_map[layout_element.children[i]].value.update_pos(old_node_min_x, old_node_min_y)
                layout_element._bounding_box = layout_element.get_bounding_box()
                self.element_id_map[tree.get('id')] = layout_element
                return layout_element
        elif tree.get('tag') == 'image' and tree.get('id') == 'topic_icon':
            topic_icon = self._createTopicIcon(topic_icon_config)
            self.element_id_map['topic_icon'] = topic_icon
            return topic_icon
        elif tree.get('tag') == 'image' and tree.get('id') == 'topic_icon2':
            topic_icon2 = self._createTopicIcon2(topic_icon2_config)
            self.element_id_map['topic_icon2'] = topic_icon2
            return topic_icon2
        else:
            # 其他情况，直接返回None
            return None
    
    def _createTitleTextGroup(self, title_config: Dict) -> Optional[dict]:
            """创建主标题组，支持多行文本
            
            Args:
                title_config: 主标题配置信息
            """
            text_content = title_config.get('text')
            if not text_content:
                return None
            
            # 将文本内容统一转换为列表形式
            text_lines = text_content if isinstance(text_content, list) else [text_content]
            
            # 获取配置参数
            font_size = title_config.get('fontSize', 16)
            line_height = title_config.get('lineHeight', 1.5)  # 默认行高为字体大小的1.2倍
            text_anchor = title_config.get('textAnchor', 'middle')
            
            # 计算每行文本的度量和总体尺寸
            line_metrics = []
            total_height = 0
            max_width = 0
            
            for line in text_lines:
                metrics = Text._measure_text(line, font_size, text_anchor)
                line_metrics.append(metrics)
                max_width = max(max_width, metrics['width'])
                if total_height > 0:
                    total_height += (line_height - 1) * font_size  # 添加行间距
                total_height += metrics['height']

            # 创建每行文本元素
            text_elements = []
            current_y = 0
            for i, (line, metrics) in enumerate(zip(text_lines, line_metrics)):
                # 计算当前行的y位置（考虑行高）
                if i > 0:
                    current_y += font_size * line_height
                
                attributes = {
                    'class': 'chart-title-line',
                    'x': 0,
                    'y': 0,
                    'text-anchor': text_anchor,
                    'font-family': title_config.get('fontFamily', 'sans-serif'),
                    'font-size': 20,
                    'font-weight': title_config.get('fontWeight', 'bolder'),
                    'fill': title_config.get('color', '#000000')
                }
                text_element = Text(line)
                text_element.attributes = attributes
                boundingbox = text_element.get_bounding_box()
                text_element._bounding_box = boundingbox
                text_elements.append(text_element)
            for text_element in text_elements:
                self.layout_graph.add_node(Node(text_element))
            for i in range(1, len(text_elements)):
                layout_strategy = VerticalLayoutStrategy()
                layout_strategy.alignment = ["left","left"]
                layout_direction = "down"
                layout_padding = 0
                node_map = self.layout_graph.node_map
                self.layout_graph.add_edge(node_map[text_elements[i-1]], node_map[text_elements[i]], layout_strategy)
                old_node_min_x = float(node_map[text_elements[i]].value._bounding_box.minx)
                old_node_min_y = float(node_map[text_elements[i]].value._bounding_box.miny)
                layout_strategy.layout(node_map[text_elements[i-1]].value, node_map[text_elements[i]].value)
                node_map[text_elements[i]].value.update_pos(old_node_min_x, old_node_min_y)
        
            title_text_group = GroupElement()
            title_text_group.children = text_elements
            boundingbox = title_text_group.get_bounding_box()
            title_text_group._bounding_box = boundingbox
            # layout_graph.add_node(Node(title_text_group))
            return title_text_group


    def _createSubtitleTextGroup(self, subtitle_config: Dict) -> Optional[dict]:
        """创建副标题组，支持多行文本
        
        Args:
            subtitle_config: 副标题配置信息
            
        Returns:
            GroupElement: 包含副标题文本元素的组
        """
        text_content = subtitle_config.get('text')
        if not text_content:
            return None
        
        # 将文本内容统一转换为列表形式
        text_lines = text_content if isinstance(text_content, list) else [text_content]
            
        text_anchor = subtitle_config.get('align', 'middle')
        font_size = subtitle_config.get('fontSize', 16)
        line_height = subtitle_config.get('lineHeight', 1.2)
        
        # 计算每行文本的度量
        line_metrics = []
        max_width = 0
        total_height = 0
        for line in text_lines:
            metrics = Text._measure_text(line, font_size, text_anchor)
            line_metrics.append(metrics)
            max_width = max(max_width, metrics['width'])
            if total_height > 0:
                total_height += (line_height - 1) * font_size  # 添加行间距
            total_height += metrics['height']

        # 创建每行文本元素
        text_elements = []
        current_y = 0
        for i, (line, metrics) in enumerate(zip(text_lines, line_metrics)):
            # 计算当前行的y位置（考虑行高）
            if i > 0:
                current_y += font_size * line_height
            
            attributes = {
                'class': 'chart-subtitle-line',
                'x': 0,
                'y': 0,
                'text-anchor': text_anchor,
                'font-family': subtitle_config.get('fontFamily', 'sans-serif'),
                'font-size': font_size,
                'font-weight': subtitle_config.get('fontWeight', 'normal'),
                'fill': subtitle_config.get('color', '#6E6E6E')
            }
            text_element = Text(line)
            text_element.attributes = attributes
            boundingbox = text_element.get_bounding_box()
            text_element._bounding_box = boundingbox
            text_elements.append(text_element)
        
        for text_element in text_elements:
            self.layout_graph.add_node(Node(text_element))
        
        for i in range(1, len(text_elements)):
            layout_strategy = VerticalLayoutStrategy()
            layout_strategy.alignment = ["left","left"]
            # layout_st
            layout_direction = "down"
            layout_padding = 0
            node_map = self.layout_graph.node_map
            self.layout_graph.add_edge(node_map[text_elements[i-1]], node_map[text_elements[i]], layout_strategy)
            old_node_min_x = float(node_map[text_elements[i]].value._bounding_box.minx)
            old_node_min_y = float(node_map[text_elements[i]].value._bounding_box.miny)
            layout_strategy.layout(node_map[text_elements[i-1]].value, node_map[text_elements[i]].value)
            node_map[text_elements[i]].value.update_pos(old_node_min_x, old_node_min_y)

        subtitle_text_group = GroupElement()
        subtitle_text_group.children = text_elements
        boundingbox = subtitle_text_group.get_bounding_box()
        subtitle_text_group._bounding_box = boundingbox
        # layout_graph.add_node(Node(subtitle_text_group))
        return subtitle_text_group


    def _createTopicIcon(self, topic_icon_config: Dict) -> Optional[dict]:
        if not topic_icon_config.get('iconUrl'):
            return None
        
        # 获取图标的base64数据
        image_data = Image._getImageAsBase64(topic_icon_config['iconUrl'])
        if not image_data:
            return None
        
        image_element = Image(image_data)
        image_element.attributes = {
            'class': 'topic-icon',
            'xlink:href': f"data:{image_data}",
            'preserveAspectRatio': 'xMidYMid meet',
            'width': 300,
            'height': 300,
        }
        boundingbox = image_element.get_bounding_box()
        image_element._bounding_box = boundingbox
        # layout_graph.add_node(Node(image_element))
        return image_element
    
    def _createTopicIcon2(self, topic_icon_config: Dict) -> Optional[dict]:
        if not topic_icon_config.get('iconUrl'):
            return None
        
        # 获取图标的base64数据
        image_data = Image._getImageAsBase64(topic_icon_config['iconUrl'])
        if not image_data:
            return None
        
        image_element = Image(topic_icon_config['iconUrl'])
        image_element.attributes = {
            'class': 'topic-icon',
            'xlink:href': f"data:{image_data}",
            'preserveAspectRatio': 'xMidYMid meet',
            'width': 200,
            'height': 200,
        }
        return image_element
