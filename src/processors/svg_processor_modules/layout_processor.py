from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .elements import *
from .layout import *
from ...template.template import *
topic_icon_config = {
    "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm2.png"
}

topic_icon2_config = {
    "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm2.png"
}
title_config = {
    "text": ["The Countries With The Highest","Density Of Robot Workers"],
    "fontSize": 16,
    "fontFamily": "sans-serif",
    "fontWeight": "bold",
    "color": "#000000",
    "textAnchor": "start"
}
subtitle_config = {
    "text": ["Installed industrial robots per 10,000 employees in ", "the manufacturing industry in 2019*"],
    "fontSize": 12,
    "fontFamily": "sans-serif",
    "fontWeight": "normal",
    "color": "#808080",
    "textAnchor": "start"
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

layout_tree = {
    "tag": "g",
    "layoutStrategy": {
        "name": "vertical",
        "padding": 5,
        "direction": "down"
    },
    "children": [
        # {
        #     "tag":"image",
        #     "id": "topic_icon",
        # },
        {
            "tag": "g",
            "id": "title_text",
            "children": []
        },
        {
            "tag": "g",
            "id": "subtitle_text",
            "children": []
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
    def __init__(self, element_tree: LayoutElement, layout_graph: LayoutGraph, layout_template: LayoutTemplate, additional_configs: dict):
        self.element_tree = element_tree
        self.layout_graph = layout_graph
        self.layout_template = layout_template
        self.title_config = title_config
        self.subtitle_config = subtitle_config
        self.topic_icon_config = topic_icon_config
        # 如果additional_configs中存在title_config, 则使用additional_configs中的title_config
        if 'title_config' in additional_configs:
            # update title_config
            self.title_config.update(additional_configs['title_config'])
        # 如果additional_configs中存在subtitle_config, 则使用additional_configs中的subtitle_config
        if 'subtitle_config' in additional_configs:
            # update subtitle_config
            self.subtitle_config.update(additional_configs['subtitle_config'])
        
        if 'topic_icon_config' in additional_configs:
            self.topic_icon_config.update(additional_configs['topic_icon_config'])
        
        if 'topic_icon_url' in additional_configs:
            self.topic_icon_config['iconUrl'] = additional_configs['topic_icon_url']
        # self.chart_element = GroupElement()
        # self.chart_element.children.append(self.element_tree)
        self.chart_element = self.element_tree
        self.element_id_map = {}
        self.element_id_map['chart'] = self.chart_element
        
    
    def process(self) -> LayoutElement:
        self.process_layout_template(self.layout_template.root)
        return self.layout_template.root
        # return self.process_node(self.layout_tree)
        
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
    
    def process_layout_template(self, element: LayoutElement):
        print("element: ", element.tag, element.id)
        if element.tag == 'g':
            if element.id == 'title':
                self._createTitleTextElement(self.title_config, element)
                element._bounding_box = element.get_bounding_box()
            elif element.id == 'subtitle':
                self._createSubtitleTextElement(self.subtitle_config, element)
                element._bounding_box = element.get_bounding_box()
            elif element.id == 'chart':
                # element = self.chart_element
                element.children = self.chart_element.children
                element.attributes = self.chart_element.attributes
                element._bounding_box = element.get_bounding_box()
            else:
                topic_icon_idx = -1
                boundingboxes = []
                for idx, child in enumerate(element.children):
                    self.process_layout_template(child)
                    if child.id == 'topic_icon':
                        topic_icon_idx = idx
                    boundingboxes.append(child._bounding_box)
                print("topic_icon_idx", topic_icon_idx)
                if topic_icon_idx != -1:
                    max_height = 0
                    max_width = 0
                    for boundingbox in boundingboxes:
                        if boundingbox.height > max_height:
                            max_height = boundingbox.height
                        if boundingbox.width > max_width:
                            max_width = boundingbox.width
                    topic_icon_height = max_height * self.topic_icon_config.get('relative_height_ratio', 0)
                    print("self.topic_icon_config", self.topic_icon_config)
                    print("max_height", max_height)
                    if topic_icon_height > 0:
                        original_height = boundingboxes[topic_icon_idx].height
                        original_width = boundingboxes[topic_icon_idx].width
                        aspect_ratio = original_width / original_height
                        topic_icon_height = max_height * self.topic_icon_config.get('relative_height_ratio', 0)
                        topic_icon_width = topic_icon_height * aspect_ratio
                        element.children[topic_icon_idx].attributes['height'] = topic_icon_height
                        element.children[topic_icon_idx].attributes['width'] = topic_icon_width
                        element.children[topic_icon_idx]._bounding_box = element.children[topic_icon_idx].get_bounding_box()
                        print("topic_icon_boundingbox", element.children[topic_icon_idx]._bounding_box)
                for i in range(1, len(element.children)):
                    self.layout_graph.add_node_with_edges(element.children[i], element.children[i-1], element.layout_strategy)
                    node_map = self.layout_graph.node_map
                    for edge in node_map[element.children[i-1]].prevs_edges:
                        edge.process_layout()
                element._bounding_box = element.get_bounding_box()
        elif element.tag == 'image':
            id = element.id
            if id == 'topic_icon':
                self._createTopicIconElement(self.topic_icon_config, element)
                
        
    def process_node(self, tree: dict):
        # 自顶向下递归地创建layout element, 并应用布局
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
            title_text_group = GroupElement()
            self._createTitleTextElement(title_config, title_text_group)
            return title_text_group

    def _createTitleTextElement(self, title_config: Dict, element: LayoutElement):
        """创建主标题文本元素
        
        Args:
            title_config: 主标题配置信息
            element: 要添加文本的元素
        """
        text_content = title_config.get('text')
        if not text_content:
            return None
        
        # 获取配置参数
        font_size = title_config.get('fontSize', 16)
        line_height = title_config.get('lineHeight', 1.5)  # 默认行高为字体大小的1.2倍
        text_anchor = title_config.get('textAnchor', 'middle')
        max_width = title_config.get('max_width', float('inf'))
        
        # 将文本内容统一转换为列表形式
        if isinstance(text_content, list):
            text_lines = text_content
        else:
            # 如果渲染宽度超过max_width,按空格分词并重组文本行
            words = text_content.split()
            text_lines = []
            current_line = []
            current_width = 0
            
            for word in words:
                word_metrics = Text._measure_text(word + ' ', font_size, text_anchor)
                word_width = word_metrics['width']
                
                if current_width + word_width <= max_width:
                    current_line.append(word)
                    current_width += word_width
                else:
                    text_lines.append(' '.join(current_line))
                    current_line = [word]
                    current_width = word_width
            
            if current_line:
                text_lines.append(' '.join(current_line))
        
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
    
        element.children = text_elements
        boundingbox = element.get_bounding_box()
        element._bounding_box = boundingbox

    def _createSubtitleTextGroup(self, subtitle_config: Dict) -> Optional[dict]:
        """创建副标题组，支持多行文本
        
        Args:
            subtitle_config: 副标题配置信息
        """
        subtitle_text_group = GroupElement()
        self._createSubtitleTextElement(subtitle_config, subtitle_text_group)
        return subtitle_text_group

    def _createSubtitleTextElement(self, subtitle_config: Dict, element: LayoutElement):
        """创建副标题文本元素
        
        Args:
            subtitle_config: 副标题配置信息
            element: 要添加文本的元素
        """
        text_content = subtitle_config.get('text')
        if not text_content:
            return None
        
        # 获取配置参数
        font_size = subtitle_config.get('fontSize', 12)
        line_height = subtitle_config.get('lineHeight', 1.5)
        text_anchor = subtitle_config.get('textAnchor', 'middle')
        max_width = subtitle_config.get('max_width', float('inf'))
        
        # 将文本内容统一转换为列表形式
        if isinstance(text_content, list):
            text_lines = text_content
        else:
            # 如果渲染宽度超过max_width,按空格分词并重组文本行
            words = text_content.split()
            text_lines = []
            current_line = []
            current_width = 0
            
            for word in words:
                word_metrics = Text._measure_text(word + ' ', font_size, text_anchor)
                word_width = word_metrics['width']
                
                if current_width + word_width <= max_width:
                    current_line.append(word)
                    current_width += word_width
                else:
                    text_lines.append(' '.join(current_line))
                    current_line = [word]
                    current_width = word_width
            
            if current_line:
                text_lines.append(' '.join(current_line))
        
        # 计算每行文本的度量和总体尺寸
        line_metrics = []
        total_height = 0
        max_width = 0
        
        for line in text_lines:
            metrics = Text._measure_text(line, font_size, text_anchor)
            line_metrics.append(metrics)
            max_width = max(max_width, metrics['width'])
            if total_height > 0:
                total_height += (line_height - 1) * font_size
            total_height += metrics['height']

        # 创建每行文本元素
        text_elements = []
        current_y = 0
        for i, (line, metrics) in enumerate(zip(text_lines, line_metrics)):
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
                'fill': subtitle_config.get('color', '#808080')
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

        element.children = text_elements
        boundingbox = element.get_bounding_box()
        element._bounding_box = boundingbox

    def _createTopicIcon(self, topic_icon_config: Dict) -> Optional[dict]:
        """创建主题图标组
        
        Args:
            topic_icon_config: 图标配置信息
        """
        image_element = Image()
        self._createTopicIconElement(topic_icon_config, image_element)
        return image_element

    def _createTopicIconElement(self, topic_icon_config: Dict, element: LayoutElement):
        """创建主题图标元素
        
        Args:
            topic_icon_config: 图标配置信息
            element: 要添加图标的元素
        """
        if not topic_icon_config.get('iconUrl'):
            return None
        
        image_data = Image._getImageAsBase64(topic_icon_config['iconUrl'])
        if not image_data:
            return None
        
        element.base64 = image_data
        element.attributes = {
            'class': 'topic-icon',
            'xlink:href': f"data:{image_data}",
            'preserveAspectRatio': 'xMidYMid meet',
            'width': element.attributes.get('width', 50),
            'height': element.attributes.get('height', 50),
        }
        boundingbox = element.get_bounding_box()
        element._bounding_box = boundingbox
