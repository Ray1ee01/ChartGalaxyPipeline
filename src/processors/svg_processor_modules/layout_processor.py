from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .elements import *
from .layout import *
from openai import OpenAI
from ...template.template import *
import time
from ...processors.image_processor import ImageProcessor

default_topic_icon_config = {
    "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm2.png"
}

default_topic_icon2_config = {
    "iconUrl": "/data1/liduan/generation/chart/chart_pipeline/testicon/robotarm2.png"
}
default_title_config = {
    "text": ["The Countries With The Highest","Density Of Robot Workers"],
    "fontSize": 16,
    "fontFamily": "sans-serif",
    "fontWeight": "bold",
    "color": "#000000",
    "textAnchor": "start"
}
default_subtitle_config = {
    "text": ["Installed industrial robots per 10,000 employees in ", "the manufacturing industry in 2019*"],
    "fontSize": 12,
    "fontFamily": "sans-serif",
    "fontWeight": "normal",
    "color": "#808080",
    "textAnchor": "start"
}

class LayoutProcessor:
    def __init__(self, element_tree: LayoutElement, layout_graph: LayoutGraph, layout_template: LayoutTemplate, additional_configs: dict):
        self.element_tree = element_tree
        self.layout_graph = layout_graph
        self.constraint_graph = LayoutGraph()
        self.layout_template = layout_template
        self.title_config = default_title_config
        self.subtitle_config = default_subtitle_config
        self.topic_icon_config = default_topic_icon_config
        self.additional_configs = additional_configs
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
        # self.chart_element._bounding_box = self.chart_element.get_bounding_box()
        self.element_id_map = {}
        self.element_id_map['chart'] = self.chart_element
        
    
    def process(self) -> LayoutElement:
        self.process_layout_template(self.layout_template.root)
        # group = self._createDescriptionGroup()
        # self.layout_template.root.children.append(group)
        return self.layout_template.root
        
    def _createDescriptionGroup(self) -> LayoutElement:
        description_group = GroupElement()
        description_group.attributes['class'] = 'description'
        # randomly generate a corpus of 100 different words
        corpus = [
            "data", "analysis", "visualization", "chart", "graph", "trend", "insight", "pattern",
            "statistics", "information", "research", "study", "report", "finding", "metric",
            "measure", "indicator", "value", "number", "quantity", "comparison", "correlation",
            "distribution", "variable", "factor", "dimension", "category", "group", "segment",
            "series", "time", "period", "interval", "range", "scale", "axis", "label", "title",
            "legend", "annotation", "description", "detail", "summary", "overview", "highlight",
            "focus", "emphasis", "key", "main", "primary", "secondary", "supplementary", "additional",
            "extra", "other", "alternative", "option", "choice", "selection", "filter", "subset",
            "sample", "population", "total", "sum", "average", "mean", "median", "mode", "variance",
            "deviation", "spread", "dispersion", "cluster", "group", "segment", "section", "part",
            "component", "element", "item", "unit", "piece", "fraction", "percentage", "ratio",
            "proportion", "rate", "frequency", "occurrence", "instance", "case", "example",
            "illustration", "demonstration", "proof", "evidence", "support", "basis", "foundation",
            "source", "reference", "citation", "quote", "excerpt", "extract", "fragment", "portion"
        ]
        # 从这些句子中随机选出30-50个词，组成多行句子，每行单词数6-10个
        text_sequence = []
        random.shuffle(corpus)
        words_count = random.randint(30, 50)
        text_sequence = corpus[:words_count]
        # for i in range(30, 50):
        #     text_sequence.append(corpus[:i])
        # 将text_sequence中的句子随机打乱
        # random.shuffle(text_sequence)
        sentences = []
        # 随机确定每行单词数
        while len(text_sequence) > 0:
            # 随机确定每行单词数
            line_length = random.randint(6, 10)
            line_length = min(line_length, len(text_sequence))
            # 从text_sequence中随机选出line_length个单词
            # line = text_sequence.pop(line_length)
            line = text_sequence[:line_length]
            # 合并成一个字符串，用空格分割
            sentence = ' '.join(line)
            sentences.append(sentence)
            text_sequence = text_sequence[line_length:]
        # 字体大小从8-16之间随机选择
        font_size = random.randint(8, 10)
        # 随机确定字体颜色
        color = random.choice(["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"])
        # 随机确定字体
        font = random.choice(["sans-serif", "serif", "monospace"])
        # 随机确定字体粗细
        font_weight = random.choice(["normal", "bold"])
        # 随机确定字体倾斜
        font_style = random.choice(["normal", "italic"])
        
        
        # 随机选择x,y
        x = random.randint(0, 300)
        y = random.randint(0, 300)
        for sentence in sentences:
            text = Text(sentence)
            text.attributes = {
                'font-size': font_size,
                'color': color,
                'font-family': font,
            }
            text.attributes['x'] = x
            text.attributes['y'] = y
            description_group.children.append(text)
            # x += text.get_bounding_box().width
            print("text: ", sentence)
            print("text: ", text.get_bounding_box().format())
            y += text.get_bounding_box().height
        return description_group
        
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
        # print("element: ", element.tag, element.id)
        time_start = time.time()
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
                # print("chart boundingbox: ", element._bounding_box)
            elif element.id == 'embellish':
                self._createEmbellishElement(element)
                element._bounding_box = element.get_bounding_box()
            else:
                time_start_child = time.time()
                topic_icon_idx = -1
                boundingboxes = []
                for idx, child in enumerate(element.children):
                    self.process_layout_template(child)
                    # print("child: ", child.id, child.tag, child._bounding_box)
                    if child.id == 'topic_icon':
                        topic_icon_idx = idx
                    boundingboxes.append(child._bounding_box)
                time_end_child = time.time()
                # print(f'process node {element.id} child time cost: {time_end_child - time_start_child}s')
                time_start_topic_icon = time.time()
                if topic_icon_idx != -1:
                    max_height = 0
                    max_width = 0
                    for boundingbox in boundingboxes:
                        if boundingbox.height > max_height:
                            max_height = boundingbox.height
                        if boundingbox.width > max_width:
                            max_width = boundingbox.width
                    topic_icon_height = max_height * self.topic_icon_config.get('relative_height_ratio', 0)
                    if topic_icon_height > 0:
                        original_height = boundingboxes[topic_icon_idx].height
                        original_width = boundingboxes[topic_icon_idx].width
                        aspect_ratio = original_width / original_height
                        topic_icon_height = max_height * self.topic_icon_config.get('relative_height_ratio', 0)
                        topic_icon_width = topic_icon_height * aspect_ratio
                        element.children[topic_icon_idx].attributes['height'] = topic_icon_height
                        element.children[topic_icon_idx].attributes['width'] = topic_icon_width
                        element.children[topic_icon_idx]._bounding_box = element.children[topic_icon_idx].get_bounding_box()
                time_end_topic_icon = time.time()
                # print(f'process node {element.id} topic_icon time cost: {time_end_topic_icon - time_start_topic_icon}s')
                time_start_size_constraint = time.time()
                if element.size_constraint is not None:
                    time_start_get_ref = time.time()
                    reference_element = element.get_element_by_id(element.reference_id)
                    time_end_get_ref = time.time()
                    # print(f'get reference element time: {time_end_get_ref - time_start_get_ref}s')

                    scales = []
                    time_start_constraint = time.time()
                    print("element.reference_id: ", element.reference_id)
                    for child in element.children:
                        if not element.reference_id == child.id:
                            self.constraint_graph.add_node_with_edges(reference_element, child, element.size_constraint)
                            print("child: ", child.id)
                            for edge in self.constraint_graph.node_map[child].prevs_edges:
                                time_start_process = time.time()
                                scale = edge.process_layout()
                                time_end_process = time.time()
                                # print(f'process constraint time: {time_end_process - time_start_process}s')
                                scales.append(scale)
                    time_end_constraint = time.time()
                    # print("processing element: ", element.id)
                    print(f'process constraints time: {time_end_constraint - time_start_constraint}s')

                    time_start_scale = time.time()
                    # min_scale = min(scales)
                    # max_scale = max(scales)
                    # chart_scale = 1
                    # if max_scale >= 1 and min_scale >= 1:
                    #     chart_scale = max_scale
                    # elif max_scale < 1 and min_scale < 1:
                    #     chart_scale = min_scale
                    # elif max_scale > 1 and min_scale < 1:
                    #     chart_scale = (max_scale + min_scale) / 2
                    time_end_scale = time.time()
                    print(f'calculate scale time: {time_end_scale - time_start_scale}s')

                    # if element.reference_id == 'chart':
                    #     time_start_rescale = time.time()
                    #     self.rescale_text_in_chart(chart_scale)
                    #     time_end_rescale = time.time()
                    #     print(f'rescale chart text time: {time_end_rescale - time_start_rescale}s')
                time_end_size_constraint = time.time()
                # print(f'process node {element.id} size_constraint time cost: {time_end_size_constraint - time_start_size_constraint}s')
                time_start_layout = time.time()
                for i in range(1, len(element.children)):
                    self.layout_graph.add_node_with_edges(element.children[i-1], element.children[i], element.layout_strategy)
                    node_map = self.layout_graph.node_map
                    for edge in node_map[element.children[i]].prevs_edges:
                        edge.process_layout()
                time_end_layout = time.time()
                # print(f'process node {element.id} layout time cost: {time_end_layout - time_start_layout}s')
                time_start_bounding_box = time.time()
                element._bounding_box = element.get_bounding_box()
                time_end_bounding_box = time.time()
                # print(f'process node {element.id} bounding_box time cost: {time_end_bounding_box - time_start_bounding_box}s')
        elif element.tag == 'image':
            id = element.id
            if id == 'topic_icon':
                self._createTopicIconElement(self.topic_icon_config, element)
        time_end = time.time()
        # print(f'process node {element.id} time cost: {time_end - time_start}s')
        
    def _createRectElement(self, rect_config: dict, element: LayoutElement):
        element.attributes['fill'] = '#3d85e0'
        element.attributes['width'] = 20
        element.attributes['height'] = 100
        element._bounding_box = element.get_bounding_box()
    
    
    def _createTitleTextGroup(self, title_config: Dict) -> Optional[dict]:
        """创建主标题组，支持多行文本
        
        Args:
            title_config: 主标题配置信息
        """
        title_text_group = GroupElement()
        self._createTitleTextElement(title_config, title_text_group)
        self.subtitle_config['max_width'] = title_text_group.get_bounding_box().width *1.5
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
        # max_lines = title_config.get('max_lines', 1)
        max_lines = 2
        text_lines = self._autolinebreak(text_content, max_lines)
        text_lines = self._avoidShortLine(text_lines)
        text_lines = self._avoidSingleWordLine(text_lines)
        
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

        max_width = 0
        
        # emphasis_phrases = title_config.get('emphasis_phrases', [])
        emphasis_phrases = []
        # print("emphasis_phrases: ", emphasis_phrases)
        # 创建每行文本元素
        line_groups = []  # 存储每行的group element
        current_y = 0
        for i, (line, metrics) in enumerate(zip(text_lines, line_metrics)):
            # 计算当前行的y位置（考虑行高）
            if i > 0:
                current_y += font_size * line_height
            
            # 处理强调短语
            text_parts = []
            current_pos = 0
            line_lower = line.lower()
            
            # 查找所有需要强调的短语
            for text_color_pair in emphasis_phrases:
                phrase = text_color_pair.get('text')
                color = text_color_pair.get('color')
                phrase_lower = phrase.lower()
                start = 0
                while True:
                    pos = line_lower.find(phrase_lower, start)
                    if pos == -1:
                        break
                        
                    # 添加强调短语前的普通文本
                    if pos > current_pos:
                        normal_text = Text(line[current_pos:pos])
                        normal_text.attributes = {
                            'class': 'chart-title-line',
                            'x': 0,
                            'y': 0,
                            'text-anchor': text_anchor,
                            'font-family': title_config.get('font', 'sans-serif'),
                            'font-size': font_size,
                            'font-weight': title_config.get('fontWeight', 'bolder'),
                            'fill': title_config.get('color', '#000000'),
                            'letter-spacing': title_config.get('letterSpacing', 0)
                        }
                        text_parts.append(normal_text)
                    
                    # 添加强调短语
                    emphasis_text = Text(line[pos:pos+len(phrase)])
                    emphasis_text.attributes = {
                        'class': 'chart-title-line emphasis',
                        'x': 0,
                        'y': 0,
                        'text-anchor': text_anchor,
                        'font-family': title_config.get('font', 'sans-serif'),
                        'font-size': font_size+4,
                        'font-weight': title_config.get('fontWeight', 'bolder'),
                        'fill': color,  # 强调文本使用红色
                        'letter-spacing': title_config.get('letterSpacing', 0)
                    }
                    text_parts.append(emphasis_text)
                    
                    current_pos = pos + len(phrase)
                    start = pos + 1
            
            # 添加剩余的普通文本
            if current_pos < len(line):
                normal_text = Text(line[current_pos:])
                normal_text.attributes = {
                    'class': 'chart-title-line',
                    'x': 0,
                    'y': 0,
                    'text-anchor': text_anchor,
                    'font-family': title_config.get('font', 'sans-serif'),
                    'font-size': font_size,
                    'font-weight': title_config.get('fontWeight', 'bolder'),
                    'fill': title_config.get('color', '#000000'),
                    'letter-spacing': title_config.get('letterSpacing', 0)
                }
                text_parts.append(normal_text)
            
            # 创建当前行的group element
            line_group = GroupElement()
            line_group.children = text_parts
            
            layout_strategy = HorizontalLayoutStrategy()
            layout_strategy.alignment = ["middle","middle"]
            layout_strategy.direction = "right"
            
            # 计算每个文本部分的位置
            # current_x = 0
            for text_part in text_parts:
                text_part._bounding_box = text_part.get_bounding_box()
                # text_part.attributes['x'] = current_x
                # current_x += text_part._bounding_box.width
            
            for i in range(1, len(text_parts)):
                node_map = self.layout_graph.node_map
                self.layout_graph.add_edge_by_value(text_parts[i-1], text_parts[i], layout_strategy)
                for edge in node_map[text_parts[i]].prevs_edges:
                    edge.process_layout()
                
            
            
            # 设置group的边界框
            line_width = sum(part._bounding_box.width for part in text_parts)
            line_group._bounding_box = line_group.get_bounding_box()
            
            line_groups.append(line_group)
            max_width = max(max_width, line_width)

        self.subtitle_config['max_width'] = max_width * 1.2
        element.children = line_groups
        
        # 应用布局 - 现在是对line groups应用
        for i in range(1, len(line_groups)):
            node_map = self.layout_graph.node_map
            self.layout_graph.add_edge_by_value(line_groups[i-1], line_groups[i], element.layout_strategy)
            for edge in node_map[line_groups[i]].prevs_edges:
                edge.process_layout()

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
        font_size = subtitle_config.get('fontSize', 16)
        line_height = subtitle_config.get('lineHeight', 1.5)
        text_anchor = subtitle_config.get('textAnchor', 'middle')
        max_width = subtitle_config.get('max_width', float('inf'))
        print("subtitle_config: ", subtitle_config)
        print('max_width: ', max_width)
        
        # max_lines = subtitle_config.get('max_lines', 4)
        
        # text_lines = self._autolinebreak(text_content, max_lines)
        # print("test_text_lines: ", text_lines)
        
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
        text_lines = self._avoidSingleWordLine(text_lines)
        n_lines = len(text_lines)
        print("n_lines: ", n_lines)
        # text_lines = self._autolinebreak(text_content, n_lines, n_lines)
        # print("test_text_lines: ", text_lines)
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
                'font-family': subtitle_config.get('font', 'sans-serif'),
                'font-size': font_size,
                'font-weight': subtitle_config.get('fontWeight', 400),
                'fill': subtitle_config.get('color', '#808080'),
                'letter-spacing': subtitle_config.get('letterSpacing', 0)
            }
            text_element = Text(line)
            text_element.attributes = attributes
            boundingbox = text_element.get_bounding_box()
            text_element._bounding_box = boundingbox
            text_elements.append(text_element)

        # for text_element in text_elements:
        #     self.layout_graph.add_node(Node(text_element))
        
        # for i in range(1, len(text_elements)):
        #     layout_strategy = VerticalLayoutStrategy()
        #     layout_strategy.alignment = ["left","left"]
        #     layout_strategy.direction = "down"
        #     layout_strategy.padding = subtitle_config.get('linePadding', 0)
        #     node_map = self.layout_graph.node_map
        #     self.layout_graph.add_edge(node_map[text_elements[i-1]], node_map[text_elements[i]], layout_strategy)
        #     old_node_min_x = float(node_map[text_elements[i]].value._bounding_box.minx)
        #     old_node_min_y = float(node_map[text_elements[i]].value._bounding_box.miny)
        #     layout_strategy.layout(node_map[text_elements[i-1]].value, node_map[text_elements[i]].value)
        #     node_map[text_elements[i]].value.update_pos(old_node_min_x, old_node_min_y)

        element.children = text_elements
        for i in range(1, len(text_elements)):
            node_map = self.layout_graph.node_map
            self.layout_graph.add_edge_by_value(text_elements[i-1], text_elements[i], element.layout_strategy)
            for edge in node_map[text_elements[i]].prevs_edges:
                edge.process_layout()
        boundingbox = element.get_bounding_box()
        element._bounding_box = boundingbox

    def _createEmbellishElement(self, element: LayoutElement):
        """创建装饰元素"""
        embellish_element = RectEmbellish(colors = [self.additional_configs.get('theme_color', '#0000ff')])
        # print("embellish_element: ", embellish_element.dump())
        # print("embellish_element.children: ", embellish_element.children)
        # element.children.append(embellish_element)
        for child in embellish_element.children:
            element.children.append(child)
        element._bounding_box = element.get_bounding_box()
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
        
        image_data = Image._getImageAsBase64(topic_icon_config['iconUrl']['file_path'])
        image_processor = ImageProcessor()
        # if config.get('crop', '') == 'circle':
        content_type = image_data.split(';base64,')[0]
        base64 = image_data.split(';base64,')[1]
        base64 = image_processor.crop_by_circle(base64)
        base64 = image_processor.apply_alpha(base64, 0.75)
        image_data = f"{content_type};base64,{base64}"
        if not image_data:
            return None
        
        element.base64 = image_data
        element.attributes = {
            'class': 'topic-icon',
            'xlink:href': f"data:{image_data}",
            'preserveAspectRatio': 'xMidYMid meet',
            'width': element.attributes.get('width',60),
            'height': element.attributes.get('height', 60),
        }
        boundingbox = element.get_bounding_box()
        print("boundingbox: ", boundingbox)
        element._bounding_box = boundingbox

    def _autolinebreak(self, text: str, max_lines: int=2, n_lines = 0) -> list[str]:
        """自动换行: 调用openai的api"""
        # prompt = f"""
        # 任务描述： 请根据以下规则，将给定的文本重新排版并插入换行符 \n,以实现符合语义和美观的换行效果:

        # 换行规则：
        # 1. 优先在短语边界处换行（如介词短语、动词短语之间）。
        # 2. 如果存在标点符号（如逗号、句号、冒号等），优先在标点符号后换行。
        # 3. 每行的字符数尽量接近 X 个字符（例如 20 个字符），但不得强行切割单词或破坏语义。
        # 4. 避免单词被分割(如"in-formation")，也不要让标点符号单独位于新行开头。
        # 5. 如果一行文字超出限制，请在符合规则的位置换行。
        # 6. 最终输出的行数不得超过 {max_lines if max_lines > 0 else "无限制"} 行。如果有行数限制，需要适当调整每行长度以确保内容在指定行数内完整展示。

        # 输入格式：
        # {text}

        # 输出格式： 将结果文字按照规则换行，输出换行后的文本，例如：
        # Line 1 of text
        # Line 2 of text
        # Line 3 of text

        # 输入示例：
        # Designing Infographics with Effective Layouts for Better Visual Communication

        # 输出示例：
        # Designing Infographics
        # with Effective Layouts
        # for Better Visual
        # Communication
        
        # 输入:
        # {text}
        
        # 请按照规则进行换行，并输出换行后的文本
        # """
        
        prompt = f"""
            Task Description:
            Please reformat the given text and insert line breaks (\n) according to the following rules to ensure both semantic clarity and visual balance.

            Line Break Rules:

            Prioritize line breaks at phrase boundaries (e.g., prepositional phrases or verb phrases).
            If punctuation marks (e.g., commas, periods, colons) are present, prioritize line breaks after the punctuation.
            Each line should be close to X characters (e.g., 20 characters), but avoid breaking words or disrupting sentence semantics.
            Do not split words (e.g., avoid breaking "in-formation" across two lines), and avoid placing punctuation marks alone at the start of a new line.
            If a line exceeds the character limit, break it at the nearest valid position according to the above rules.
            Ensure that the longest line is at least 23 characters.
            
            The total number of lines must not exceed {max_lines if max_lines > 0 else "unlimited"}. If there is a line limit, adjust line lengths accordingly to fit the content within the specified number of lines.
            Input Format:
            {text}

            Output Format:
            The text should be formatted with line breaks inserted according to the rules above. Output the result with each line separated by \n. For example:
            Line 1 of text
            Line 2 of text

            Input Example:
            Designing Infographics with Effective Layouts for Better Visual Communication

            Output Example:
            Designing Infographics with Effective Layouts
            for Better Visual Communication

            Input:
            {text}

            Please format the text according to the rules above and return the line-broken result.
            Note: be careful with the total number of lines must not exceed {max_lines if max_lines > 0 else "unlimited"}"""
        if not n_lines == 0:
            prompt += f"Note: the total number of lines must be {n_lines}."
        
        client = OpenAI(
            api_key="sk-yIje25vOt9QiTmKG4325C0A803A8400e973dEe4dC10e94C6",
            base_url="https://aihubmix.com/v1"
        )  # 初始化OpenAI客户端
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                    ]
                }
            ],
            max_tokens=300
        )
        result = response.choices[0].message.content.split('\n')
        # 移除每行末尾的空白字符
        result = [line.rstrip() for line in result]
        return result
    
    def rescale_text_in_chart(self, scale: float):
        # 遍历 self.chart_element的子树中的所有元素
        # time_start = time.time()
        def _rescale_text(element: LayoutElement):
            if element.tag == 'text':
                # element.update_scale(scale, scale)
                element.scale_to_fit(scale)
            elif element.tag == 'g':
                for child in element.children:
                    _rescale_text(child)
        _rescale_text(self.chart_element)
        # time_end = time.time()
        # print(f'rescale chart text time: {time_end - time_start}s')
        # time_start_bounding_box = time.time()
        self.chart_element._bounding_box = self.chart_element.get_bounding_box()
        # time_end_bounding_box = time.time()
        # print(f'rescale chart bounding_box time: {time_end_bounding_box - time_start_bounding_box}s')

    def _avoidSingleWordLine(self, text_lines: list[str]) -> list[str]:
        # 如果有单个单词的行，则将该行合并到上一行
        for i in range(len(text_lines)):
            if len(text_lines[i].split()) == 1:
                text_lines[i-1] += " " + text_lines[i]
                text_lines.pop(i)
        return text_lines

    def _avoidShortLine(self, text_lines: list[str], min_length: int = 23) -> list[str]:
        # 如果有某一行的字符数<min_length，则从下一行中取一个单词，合并到该行
        for i in range(len(text_lines)-1):
            line = text_lines[i]
            if len(line) < min_length:
                next_line = text_lines[i+1]
                next_line_words = next_line.split()
                if len(next_line_words) > 0:
                    line += " " + next_line_words[0]
                    next_line = next_line[len(next_line_words[0]):]
                    text_lines[i+1] = next_line
                    text_lines[i] = line
                else:
                    break
        # 有可能导致行数减少，检测是否存在空行
        for line in text_lines:
            if len(line) == 0:
                text_lines.pop(text_lines.index(line))
        return text_lines
