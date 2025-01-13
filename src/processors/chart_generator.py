from typing import Dict, List
from ..interfaces.base import ChartGenerator
from ..utils.node_bridge import NodeBridge
from ..template.template import ChartTemplate
import os
import random
from typing import Tuple


class VegaLiteGenerator(ChartGenerator):
    def __init__(self):
        self.script_path = os.path.join(
            os.path.dirname(__file__),
            'chart_generator_modules/vega-lite/vega_spec.js'
        )

    def template_to_spec(self):
        """将ChartTemplate转换为Vega-Lite规范"""
        # 基础规范
        specification = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "config": {
                "view": {"stroke": None}
            },
            "data": {
                "values": self.data
            }
        }
        
        # 标记配置
        mark_specification = {
            "type": self.template.mark.type,
            "height": {"band": self.template.mark.height} if self.template.mark.height else None,
            "width": {"band": self.template.mark.width} if self.template.mark.width else None
        }
        corner_radiuses = {}
        for key, value in self.template.mark.corner_radiuses.items():
            if value is not None:
                corner_radiuses[key] = value
        if corner_radiuses:
            mark_specification["cornerRadius"] = corner_radiuses
        
        
        # 如果有填充颜色样式
        if self.template.mark.fill_color_style.color:
            mark_specification["fill"] = self.template.mark.fill_color_style.color
            mark_specification["fillOpacity"] = self.template.mark.fill_color_style.opacity
        
        # 如果有描边样式
        if self.template.mark.stroke_color_style.color:
            mark_specification["stroke"] = self.template.mark.stroke_color_style.color
            mark_specification["strokeOpacity"] = self.template.mark.stroke_color_style.opacity
            mark_specification["strokeWidth"] = self.template.mark.stroke_style.stroke_width
        
        
        # TODO configure color
        annotation_specification = {
            "mark": {
                "type": "text",
            },
            "encoding": {
                "text": {
                    "field": self.template.y_axis.field,
                    "type": self.template.y_axis.field_type
                }
            }
        }
        text_config = annotation_specification["mark"]
        if self.template.mark.annotation_font_style.font is not None:
            text_config["font"] = self.template.mark.annotation_font_style.font
        if self.template.mark.annotation_font_style.font_size is not None:
            text_config["fontSize"] = self.template.mark.annotation_font_style.font_size
        if self.template.mark.annotation_font_style.font_weight is not None:
            text_config["fontWeight"] = self.template.mark.annotation_font_style.font_weight
        # if self.template.mark.annotation_font_style.letter_spacing is not None:
        #     text_config["letterSpacing"] = self.template.mark.annotation_font_style.letter_spacing
        if self.template.mark.annotation_color_style.color is not None:
            text_config["fill"] = self.template.mark.annotation_color_style.color
        
        if self.template.mark.orientation == "horizontal":
            # side = self.template.mark.annotation_side
            # print('side: ', side)
            side = "inner"
            if self.template.x_axis.orientation == "left" and side == "outer":
                annotation_specification["mark"]["align"] = "left"
                annotation_specification["mark"]["dx"] = 5
            elif self.template.x_axis.orientation == "left" and side == "inner":
                annotation_specification["mark"]["align"] = "right"
                annotation_specification["mark"]["dx"] = -5
            elif self.template.x_axis.orientation == "right" and side == "outer":
                annotation_specification["mark"]["align"] = "right"
                annotation_specification["mark"]["dx"] = -5
            else:
                annotation_specification["mark"]["align"] = "left"
                annotation_specification["mark"]["dx"] = 5
        else:
            if self.template.y_axis.orientation == "top" and side == "outer":
                annotation_specification["mark"]["baseline"] = "top"
                annotation_specification["mark"]["dy"] = 5
            elif self.template.y_axis.orientation == "top" and side == "inner":
                annotation_specification["mark"]["baseline"] = "bottom"
                annotation_specification["mark"]["dy"] = -5
            elif self.template.y_axis.orientation == "bottom" and side == "outer":
                annotation_specification["mark"]["baseline"] = "bottom"
                annotation_specification["mark"]["dy"] = -5
            else:
                annotation_specification["mark"]["baseline"] = "top"
                annotation_specification["mark"]["dy"] = 5
        
        if self.template.has_annotation:
            specification["layer"] = [
                {"mark": mark_specification},
                annotation_specification
            ]
        else:
            specification["mark"] = mark_specification

        # 编码配置
        encoding = {}
        
        # X轴配置
        if self.template.x_axis:
            x_encoding = {
                "field": self.template.x_axis.field,
                "type": self.template.x_axis.field_type,
                "axis": {"orient": "top", "grid": False
                        #  , "maxExtent": 100, "labelLimit": 100
                        }
            }
            
            
            axis_config = x_encoding["axis"]
            if self.template.x_axis.has_domain is not None:
                axis_config["domain"] = self.template.x_axis.has_domain
            if self.template.x_axis.has_label is not None:
                axis_config["labels"] = self.template.x_axis.has_label
            if self.template.x_axis.has_tick is not None:
                axis_config["ticks"] = self.template.x_axis.has_tick
            if self.template.x_axis.title_text is not None:
                axis_config["title"] = self.template.x_axis.title_text
            if self.template.x_axis.title_color_style.color is not None:
                axis_config["titleColor"] = self.template.x_axis.title_color_style.color
            if self.template.x_axis.title_font_style.font_size is not None:
                axis_config["titleFontSize"] = self.template.x_axis.title_font_style.font_size
            if self.template.x_axis.title_font_style.font is not None:
                axis_config["titleFont"] = self.template.x_axis.title_font_style.font
            if self.template.x_axis.title_font_style.font_weight is not None:
                axis_config["titleFontWeight"] = self.template.x_axis.title_font_style.font_weight
            if self.template.x_axis.label_color_style.color is not None:
                axis_config["labelColor"] = self.template.x_axis.label_color_style.color
            if self.template.x_axis.label_font_style.font is not None:
                axis_config["labelFont"] = self.template.x_axis.label_font_style.font
            if self.template.x_axis.label_font_style.font_size is not None:
                axis_config["labelFontSize"] = self.template.x_axis.label_font_style.font_size
            if self.template.x_axis.domain_color_style.color is not None:
                axis_config["domainColor"] = self.template.x_axis.domain_color_style.color
            if self.template.x_axis.domain_stroke_style.stroke_width is not None:
                axis_config["domainWidth"] = self.template.x_axis.domain_stroke_style.stroke_width
            if self.template.x_axis.tick_color_style.color is not None:
                axis_config["tickColor"] = self.template.x_axis.tick_color_style.color
            if self.template.x_axis.tick_stroke_style.stroke_width is not None:
                axis_config["tickWidth"] = self.template.x_axis.tick_stroke_style.stroke_width
            if self.template.x_axis.orientation is not None:
                axis_config["orient"] = self.template.x_axis.orientation
                
                
            encoding["x"] = x_encoding

        # Y轴配置
        if self.template.y_axis:
            y_encoding = {
                "field": self.template.y_axis.field,
                "type": self.template.y_axis.field_type,
                "axis": {"grid": False
                        }
            }
            
            axis_config = y_encoding["axis"]
            if self.template.y_axis.has_domain is not None:
                axis_config["domain"] = self.template.y_axis.has_domain
            if self.template.y_axis.has_label is not None:
                axis_config["labels"] = self.template.y_axis.has_label
            if self.template.y_axis.has_tick is not None:
                axis_config["ticks"] = self.template.y_axis.has_tick
            if self.template.y_axis.title_text is not None:
                axis_config["title"] = self.template.y_axis.title_text
            if self.template.y_axis.title_color_style.color is not None:
                axis_config["titleColor"] = self.template.y_axis.title_color_style.color
            if self.template.y_axis.title_font_style.font_size is not None:
                axis_config["titleFontSize"] = self.template.y_axis.title_font_style.font_size
            if self.template.y_axis.title_font_style.font is not None:
                axis_config["titleFont"] = self.template.y_axis.title_font_style.font
            if self.template.y_axis.title_font_style.font_weight is not None:
                axis_config["titleFontWeight"] = self.template.y_axis.title_font_style.font_weight
            if self.template.y_axis.label_color_style.color is not None:
                axis_config["labelColor"] = self.template.y_axis.label_color_style.color
            if self.template.y_axis.label_font_style.font is not None:
                axis_config["labelFont"] = self.template.y_axis.label_font_style.font
            if self.template.y_axis.label_font_style.font_size is not None:
                axis_config["labelFontSize"] = self.template.y_axis.label_font_style.font_size
            if self.template.y_axis.domain_color_style.color is not None:
                axis_config["domainColor"] = self.template.y_axis.domain_color_style.color
            if self.template.y_axis.domain_stroke_style.stroke_width is not None:
                axis_config["domainWidth"] = self.template.y_axis.domain_stroke_style.stroke_width
            if self.template.y_axis.tick_color_style.color is not None:
                axis_config["tickColor"] = self.template.y_axis.tick_color_style.color
            if self.template.y_axis.tick_stroke_style.stroke_width is not None:
                axis_config["tickWidth"] = self.template.y_axis.tick_stroke_style.stroke_width
            if self.template.y_axis.orientation is not None:
                axis_config["orient"] = self.template.y_axis.orientation
            encoding["y"] = y_encoding

        # 颜色编码配置
        if self.template.color_encoding and self.template.color_encoding.field:
            color_encoding = {
                "field": self.template.color_encoding.field,
                "type": self.template.color_encoding.field_type,
            }
            
            if self.template.color_encoding.domain is not None or self.template.color_encoding.range is not None:
                scale = {}
                if self.template.color_encoding.domain is not None:
                    scale["domain"] = self.template.color_encoding.domain
                if self.template.color_encoding.range is not None:
                    scale["range"] = self.template.color_encoding.range
                color_encoding["scale"] = scale
                
            encoding["color"] = color_encoding
        
        
        # print('orientation: ', self.template.mark.orientation)
        if self.template.mark.orientation == "horizontal":
            # 交换encoding中的x和y
            encoding["x"], encoding["y"] = encoding["y"], encoding["x"]
        
        if self.template.sort:
            print('sort: ', self.template.sort)
            sort_config = {
                "by": self.template.sort["by"],
                "ascending": self.template.sort["ascending"]
            }
            if sort_config["by"] == "x":
                encoding["y"]["sort"] = "-x" if sort_config["ascending"] else "x"
            else:
                encoding["x"]["sort"] = "-y" if sort_config["ascending"] else "y"
        specification["encoding"] = encoding
        
        return specification

    def generate(self, data: dict, template: ChartTemplate) -> Tuple[str, Dict, Dict]:
        # 获取原始数据
        raw_data = data['data']
        self.meta_data = data['meta_data']
        
        # 转换数据格式
        x_label = self.meta_data['x_label']
        y_label = self.meta_data['y_label']
        x_type = self.meta_data['x_type']
        y_type = self.meta_data['y_type']
        transformed_data = []
        for item in raw_data:
            transformed_data.append({
                x_label: item['x_data'],
                y_label: item['y_data']
            })
        
        
        self.data = transformed_data
        self.template = template

        spec = self.template_to_spec()
        # print('spec: ', spec)
        result = NodeBridge.execute_node_script(self.script_path, {
            "spec": spec,
        })
        return result, {}
