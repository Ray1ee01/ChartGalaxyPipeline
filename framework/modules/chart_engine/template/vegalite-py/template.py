from typing import Dict, List
import subprocess
import json
import os
import random
import sys
import pathlib
from utils.element_tool.vegalite_parser import SVGParser
from utils.element_tool.tree_converter import SVGTreeConverter
from utils.element_tool.vegalite_element_parser import VegaLiteElementParser
from utils.element_tool.data_binder import *

class VegaLiteTemplate:
    def __init__(self, json_data: Dict):
        self.json_data = json_data

    def make_specification(self, json_data: Dict) -> Dict:
        specification = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "config": {
                "view": {"stroke": None}
            },
            "data": {
                "values": json_data['data']['data']
            }
        }
        variables = json_data['variables']
        if variables.get('height',0) != 0:
            specification['height'] = variables['height']
        if variables.get('width',0) != 0:
            specification['width'] = variables['width']
        return specification

    def specification_to_svg(self, vegalite_specification, output_svg_path):
        class NodeBridge:
            @staticmethod
            def execute_node_script(script_path: str, data: dict) -> str:
                # 生成一个随机种子
                random.seed(random.randint(0, 1000000))
                # 将数据写入临时JSON文件
                tmp_input = f'temp_input_{random.randint(0, 1000000)}.json'
                
                with open(tmp_input, 'w', encoding='utf-8') as f:
                    json.dump(data, f)
                print("tmp_input: ", tmp_input)
                # 执行Node.js脚本
                result = subprocess.run([
                    'node', script_path, tmp_input
                ], capture_output=True, encoding='utf-8')
                # 清理临时文件
                os.remove(tmp_input)
                if result.returncode != 0:
                    raise Exception(f"Node.js执行错误: {result.stderr}")

                return result.stdout
        script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)),'vegalite-py', 'vega_spec.js')
        result = NodeBridge.execute_node_script(script_path, {
            "spec": vegalite_specification,
        })
        # 把result写入output_svg_path
        with open(output_svg_path, 'w', encoding='utf-8') as f:
            f.write(result)
        return output_svg_path, result

    def svg_to_element_tree(self, svg_content):
        parser = SVGParser(svg_content)
        # print("svg_content: ", svg_content)
        svg_dict = parser.parseTree(svg_content)
        self.svg_root = {
            'tag': 'svg',
            'attributes': svg_dict['attributes'],
        }
        elements_tree = SVGTreeConverter.convert(svg_dict)
        element_parser = VegaLiteElementParser(elements_tree)
        elements_tree = element_parser.parse(elements_tree)
        self.marks = element_parser.marks
        self.axes = element_parser.axes
        self.axis_labels = element_parser.axis_labels
        data_columns = self.json_data['data']['columns']
        for mark in self.marks:
            element_with_data = find_element_with_aria_label(mark)
            data_dict = extract_data_from_aria_label(element_with_data.attributes.get('aria-label', ''), data_columns)
            bind_data_to_element(mark, data_dict)
        return elements_tree

    def element_tree_to_svg(self, element_tree):
        svg_content = SVGTreeConverter.element_tree_to_svg(element_tree)
        attrs_list = []
        for key, value in self.svg_root['attributes'].items():
            attrs_list.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs_list)
        svg_left = f"<svg {attrs_str} xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
        svg_right = f"</svg>"
        svg_str = svg_left + svg_content + svg_right
        return svg_str

    def apply_icon_mark(self, json_data: Dict):
        constants = json_data['constants']
        print("constants: ", constants)
        if constants['icon_mark'] == "overlay":
            print("apply_icon_mark_overlay")
            print("self: ", self)
            # 使用type()获取实际的类，调用对应的方法
            self.apply_icon_mark_overlay(json_data)
        elif constants['icon_mark'] == "side":
            self.apply_icon_mark_side(json_data)
        elif constants['icon_mark'] == "replace":
            self.apply_icon_mark_replace(json_data)

    def apply_icon_mark_overlay(self, json_data: Dict):
        print("apply_icon_mark_overlay father")
        pass
    
    def apply_icon_mark_side(self, json_data: Dict):    
        pass

    def apply_icon_mark_replace(self, json_data: Dict):
        pass
    
    def apply_icon_label(self, json_data: Dict):
        constants = json_data['constants']
        if constants['icon_label'] == "side":
            self.apply_icon_label_side(json_data)
        elif constants['icon_label'] == "replace":
            self.apply_icon_label_replace(json_data)
    
    def apply_icon_label_side(self, json_data: Dict):
        pass
    
    def apply_icon_label_replace(self, json_data: Dict):
        pass
    
    
    def apply_data_label(self, json_data: Dict):
        constants = json_data['constants']
        if constants['data_label'] == "side":
            self.apply_data_label_side(json_data)
        elif constants['data_label'] == "overlay":
            self.apply_data_label_overlay(json_data)
    
    def apply_data_label_side(self, json_data: Dict):
        pass
    
    def apply_data_label_overlay(self, json_data: Dict):
        pass
    
    def apply_background(self, json_data: Dict):
        constants = json_data['constants']
        if constants['background'] == "styled":
            self.apply_background_styled(json_data)
        elif constants['background'] == "none":
            pass
    
    def apply_background_styled(self, json_data: Dict):
        pass
    
    def apply_variation(self, json_data: Dict):
        constants = json_data['constants']
        if constants['icon_mark'] != "none":
            self.apply_icon_mark(json_data)
        elif constants['icon_label'] != "none":
            self.apply_icon_label(json_data)
        elif constants['data_label'] != "none":
            self.apply_data_label(json_data)
        elif constants['background'] != "none":
            self.apply_background(json_data)