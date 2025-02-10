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

        # 如果是饼图类型
        if self.template.mark.type == "arc":
            mark_specification["innerRadius"] = self.template.mark.innerRadius if self.template.mark.innerRadius else 0
            mark_specification["radius"] = self.template.mark.radius if self.template.mark.radius else None
            print('arc')
        
        # 如果有填充颜色样式
        if self.template.mark.fill_color_style.color:
            mark_specification["fill"] = self.template.mark.fill_color_style.color
            mark_specification["fillOpacity"] = self.template.mark.fill_color_style.opacity
        
        # 如果有描边样式
        if self.template.mark.stroke_color_style.color:
            mark_specification["stroke"] = self.template.mark.stroke_color_style.color
            mark_specification["strokeOpacity"] = self.template.mark.stroke_color_style.opacity
            mark_specification["strokeWidth"] = self.template.mark.stroke_style.stroke_width
        
        # additional_mark_specification = {}
        # if self.template.mark.type == "line":
        #     additional_mark_specification["type"] = "area"
        #     mark_specification["type"] = "line"
        #     # additional_mark_specification["fill"] = self.template.mark.stroke_color_style.color
        #     additional_mark_specification["fillOpacity"] = 0.3
        #     # additional_mark_specification["stroke"] = self.template.mark.stroke_color_style.color
        #     # additional_mark_specification["strokeOpacity"] = self.template.mark.stroke_color_style.opacity
        #     # additional_mark_specification["strokeWidth"] = self.template.mark.stroke_style.stroke_width
        #     # additional_mark_specification["transform"] = [
        #     #     {"filter": "datum.group == 'Chile'"}
        #     # ]
        
        # if self.template.mark.point:
        #     mark_specification["point"] = self.template.mark.point
        # if self.template.mark.interpolate:
        #     mark_specification["interpolate"] = self.template.mark.interpolate
        

        
        # 编码配置
        encoding = {}
        
        # X轴配置
        if self.template.x_axis:
            x_encoding = {
                "field": self.template.x_axis.field,
                "type": self.template.x_axis.field_type,
                "axis": {"orient": "top", "grid": False
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
        if self.template.color_encoding and self.template.color_encoding.domain is not None:
            color_encoding = {
            }
            if self.template.color_encoding.field is not None:
                color_encoding["field"] = self.template.color_encoding.field
            if self.template.color_encoding.field_type is not None:
                color_encoding["type"] = self.template.color_encoding.field_type
            if self.template.color_encoding.domain is not None or self.template.color_encoding.range is not None:
                scale = {}
                if self.template.color_encoding.domain is not None:
                    scale["domain"] = self.template.color_encoding.domain
                if self.template.color_encoding.range is not None:
                    scale["range"] = self.template.color_encoding.range
                color_encoding["scale"] = scale

            # 不显示图例
            color_encoding["legend"] = {"title": None}
            if self.template.color_encoding.show_legend is False:
                color_encoding["legend"] = None
            encoding["color"] = color_encoding
        
        # 如果是饼图类型，添加角度编码
        if self.template.mark.type == "arc":
            print('开始添加角度编码')
            encoding["theta"] = {
                "field": self.template.theta["field"],
                "type": self.template.theta["type"] if self.template.theta["type"] else "quantitative"
            }
            print('theta field: ', self.template.theta["field"]),
            if self.template.color is not None:
                encoding["color"] = {
                    "field": self.template.color["field"],
                    "type": self.template.color["type"] if self.template.color["type"] else "nominal"
                }
            print('color field: ', self.template.color["field"])
            print('结束添加角度编码')

        specification["encoding"] = encoding
        specification["mark"] = mark_specification
        # specification = self.template.update_specification(specification)
        
        
        # print('orientation: ', self.template.mark.orientation)
        
        # print("additional_mark_specification: ", additional_mark_specification)
        # if additional_mark_specification:
        #     specification["layer"] = [{
        #         "mark": additional_mark_specification,
        #         "encoding": encoding,
        #         "transform": [
        #             {"filter": "datum.group == 'Chile'"}
        #         ]
        #     }] + specification["layer"]
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
            if 'group' in item:
                transformed_data[-1]['group'] = item['group']
            if 'order' in item:
                transformed_data[-1]['order'] = item['order']
            if 'size' in item:
                transformed_data[-1]['size'] = item['size']
        
        self.data = transformed_data
        self.template = template

        spec = self.template_to_spec()
        print('spec: ', spec)
        result = NodeBridge.execute_node_script(self.script_path, {
            "spec": spec,
        })
        return result, {}

class EchartGenerator(ChartGenerator):
    def __init__(self):
        self.script_path = os.path.join(
            os.path.dirname(__file__),
            'chart_generator_modules/echart/echart_option.js'
        )

    def template_to_option(self):
        option = {
            "dataset": {
                "source": self.format_data
            },
            "series": [{
                "animation": False,
                "silent": True,
                "emphasis": {
                    "disabled": True,
                    "scale": False
                }
            }
            ]
        }
        return option
    
    def generate(self, data: dict, template: ChartTemplate) -> Tuple[str, Dict, Dict]:
        self.data = data['data']
        self.meta_data = data['meta_data']
        data_headers = [key for key in self.data[0].keys()]
        self.format_data = []
        self.format_data.append(data_headers)
        for item in self.data:
            self.format_data.append(list(item.values()))
        self.template = template
        option = self.template_to_option()
        option = self.template.update_option(option)
        print('option: ', option)
        result = NodeBridge.execute_node_script(self.script_path, {
            "option": option,
        })
        return result, {}