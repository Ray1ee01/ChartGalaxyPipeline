from typing import Dict, List
from ..interfaces.base import ChartGenerator
from ..utils.node_bridge import NodeBridge
import os
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
            "cornerRadius": self.template.mark.corner_radiuses,
            "height": {"band": self.template.mark.height} if self.template.mark.height else None,
            "width": {"band": self.template.mark.width} if self.template.mark.width else None
        }
        
        # 如果有填充颜色样式
        if self.template.mark.fill_color_style.color:
            mark_specification["fill"] = self.template.mark.fill_color_style.color
            mark_specification["fillOpacity"] = self.template.mark.fill_color_style.opacity
        
        # 如果有描边样式
        if self.template.mark.stroke_color_style.color:
            mark_specification["stroke"] = self.template.mark.stroke_color_style.color
            mark_specification["strokeOpacity"] = self.template.mark.stroke_color_style.opacity
            mark_specification["strokeWidth"] = self.template.mark.stroke_style.stroke_width
        
        specification["mark"] = mark_specification
        
        # 编码配置
        encoding = {}
        
        # X轴配置
        if self.template.x_axis:
            encoding["x"] = {
                "field": self.template.x_axis.field,
                "type": self.template.x_axis.field_type,
                "axis": {
                    "domain": self.template.x_axis.has_domain,
                    "labels": self.template.x_axis.has_label,
                    "ticks": self.template.x_axis.has_tick,
                    "title": self.template.x_axis.title_text,
                    "titleColor": self.template.x_axis.title_color_style.color,
                    "titleFontSize": self.template.x_axis.title_font_style.font_size,
                    "titleFont": self.template.x_axis.title_font_style.font,
                    "titleFontWeight": self.template.x_axis.title_font_style.font_weight,
                    "labelColor": self.template.x_axis.label_color_style.color,
                    "labelFont": self.template.x_axis.label_font_style.font,
                    "labelFontSize": self.template.x_axis.label_font_style.font_size,
                    "domainColor": self.template.x_axis.domain_color_style.color,
                    "domainWidth": self.template.x_axis.domain_stroke_style.stroke_width,
                    "tickColor": self.template.x_axis.tick_color_style.color,
                    "tickWidth": self.template.x_axis.tick_stroke_style.stroke_width
                }
            }
        
        # Y轴配置
        if self.template.y_axis:
            encoding["y"] = {
                "field": self.template.y_axis.field,
                "type": self.template.y_axis.field_type,
                "axis": {
                    "domain": self.template.y_axis.has_domain,
                    "labels": self.template.y_axis.has_label,
                    "ticks": self.template.y_axis.has_tick,
                    "title": self.template.y_axis.title_text,
                    "titleColor": self.template.y_axis.title_color_style.color,
                    "titleFontSize": self.template.y_axis.title_font_style.font_size,
                    "titleFont": self.template.y_axis.title_font_style.font,
                    "titleFontWeight": self.template.y_axis.title_font_style.font_weight,
                    "labelColor": self.template.y_axis.label_color_style.color,
                    "labelFont": self.template.y_axis.label_font_style.font,
                    "labelFontSize": self.template.y_axis.label_font_style.font_size,
                    "domainColor": self.template.y_axis.domain_color_style.color,
                    "domainWidth": self.template.y_axis.domain_stroke_style.stroke_width,
                    "tickColor": self.template.y_axis.tick_color_style.color,
                    "tickWidth": self.template.y_axis.tick_stroke_style.stroke_width
                }
            }
        
        # 颜色编码配置
        if self.template.color_encoding and self.template.color_encoding.field:
            encoding["color"] = {
                "field": self.template.color_encoding.field,
                "type": self.template.color_encoding.field_type,
                "scale": {
                    "domain": self.template.color_encoding.domain,
                    "range": self.template.color_encoding.range
                }
            }
        
        specification["encoding"] = encoding
        
        return specification

    def generate(self, data: List[Dict], template: ChartTemplate) -> Tuple[str, Dict, Dict]:
        self.data = data
        self.template = template
        spec = self.template_to_spec()
        result = NodeBridge.execute_node_script(self.script_path, {
            "spec": spec,
        })
        return result, {}
