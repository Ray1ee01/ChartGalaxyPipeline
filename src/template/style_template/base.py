import os
import json
from typing import List
from ..color_template import ColorDesign
import random
import copy
from sentence_transformers import SentenceTransformer, util

model_path = "/data1/jiashu/models/models--sentence-transformers--all-MiniLM-L6-v2/snapshots/fa97f6e7cb1a59073dff9e6b13e2715cf7475ac9"

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
    def copy(self):
        return copy.deepcopy(self)
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


class PolarSetting():
    def __init__(self):
        self.inner_radius = None
        self.outer_radius = None
    
        # randomly inner_radius has 1/3 probability to be 0 and 2/3 probability to be a random value between 0 and 0.5
        if random.random() < 1/3:
            self.inner_radius = "0%"
        else:
            self.inner_radius = str(random.random() * 50) + "%"
        self.outer_radius = "80%"
    def dump(self):
        return {
            "inner_radius": self.inner_radius,
            "outer_radius": self.outer_radius
        }
        
        
        
class AngleAxisTemplate(AxisTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        self.start_angle = 90
        self.end_angle = None
        self.clockwise = True
        
class RadiusAxisTemplate(AxisTemplate):
    def __init__(self, color_template: ColorDesign=None):
        super().__init__(color_template)
        
        
class ColorEncodingTemplate:
    def __init__(self, color_template: ColorDesign=None, meta_data: dict=None, data: list=None):
        self.field = None
        self.field_type = None
        self.domain = None
        self.range = None
        self.meta_data = meta_data
        self.color_template = color_template
        self.embedding_model = SentenceTransformer(model_path)
        if len(data[0].keys()) == 3:
            self.field = 'group'
            self.field_type = 'nominal'
            # domain是data列表中每个item的['group']的值的unique值
            self.domain = list(set([item['group'] for item in data]))
            self.range = self.color_template.get_color('marks', len(self.domain), seed_mark=1)
            # self.apply_color_rules()
        else:
            if self.color_template is not None and not self.color_template.mode == 'monochromatic':
                if data is not None:
                    self.domain = list(set([row['x_data'] for row in data]))
                    self.field = meta_data['x_label']
                    seed_mark = 1
                    colors = self.color_template.get_color('marks', len(self.domain), seed_mark=seed_mark)
                    self.range = colors
    def apply_color_rules(self):
        text = self.meta_data['title'] + " " + self.meta_data['caption']
        text_embedding = self.embedding_model.encode(text)
        # domain是一个list，里面是字符串
        # 计算domain里每个字符串的embedding
        print("self.domain: ", self.domain)
        domain_embeddings = self.embedding_model.encode(self.domain)
        print("domain_embeddings: ", domain_embeddings)
        # 计算text_embedding和self.domain的相似度
        similarity = util.cos_sim(text_embedding, domain_embeddings).flatten()
        print("similarity: ", similarity)
        # 按相似度排序
        print("self.domain: ", self.domain)
        sorted_domain = sorted(self.domain, key=lambda x: similarity[self.domain.index(x)], reverse=True)
        sorted_colors = self.color_template.rank_color_by_contrast(self.range)
        print("sorted_colors: ", sorted_colors)
        print("sorted_domain: ", sorted_domain)
        self.range = sorted_colors
        self.domain = sorted_domain
        
    def dump(self):
        return {
            "field": self.field,
            "field_type": self.field_type,
            "domain": self.domain,
            "range": self.range
        }


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
        self.font_size = 12
        self.font_weight = 500
        self.line_height = 16
        self.letter_spacing = 0.25
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

