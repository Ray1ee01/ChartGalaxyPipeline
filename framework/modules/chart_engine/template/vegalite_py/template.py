from typing import Dict, List
import subprocess
import json
import os
import random
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import from the same directory
from modules.chart_engine.template.vegalite_py.utils.element_tool.vegalite_parser import SVGParser
from modules.chart_engine.template.vegalite_py.utils.element_tool.tree_converter import SVGTreeConverter
from modules.chart_engine.template.vegalite_py.utils.element_tool.vegalite_element_parser import VegaLiteElementParser
from modules.chart_engine.template.vegalite_py.utils.element_tool.data_binder import *
from modules.chart_engine.template.vegalite_py.utils.color_tool.base import *
from modules.chart_engine.template.vegalite_py.utils.element_tool.variation import BackgroundChart
from modules.chart_engine.template.vegalite_py.utils.element_tool.readability import *

class VegaLiteTemplate:
    def __init__(self, json_data: Dict):
        self.json_data = json_data
        self.defs = None
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
        script_path = os.path.join(os.path.dirname(os.path.dirname(__file__)),'vegalite_py', 'vega_spec.js')
        result = NodeBridge.execute_node_script(script_path, {
            "spec": vegalite_specification,
        })
        # 把result写入output_svg_path
        with open(output_svg_path, 'w', encoding='utf-8') as f:
            f.write(result)
        return output_svg_path, result

    def svg_to_element_tree(self, svg_content):
        parser = SVGParser(svg_content)
        svg_dict = parser.parseTree(svg_content)
        if parser.defs is not None:
            self.defs = parser.defs
        self.svg_root = {
            'tag': 'svg',
            'attributes': svg_dict['attributes'],
        }
        elements_tree = SVGTreeConverter.convert(svg_dict)
        print("elements_tree: ", elements_tree.children)
        element_parser = VegaLiteElementParser(elements_tree)
        self.elements_tree = element_parser.parse(elements_tree)
        self.marks = element_parser.marks
        self.axes = element_parser.axes
        self.axis_labels = element_parser.axis_labels
        data_columns = self.json_data['data']['columns']
        x_column = None
        for data_column in data_columns:
            if data_column['role'] == 'x':
                x_column = data_column
        self.chart = elements_tree
        # print("self.chart: ", self.chart.children[0].children[0].children)
        # 在self.chart.children[0].children[0].children中，把class是mark_group的元素放在第一的位置
        for child in self.chart.children[0].children[0].children:
            if child.attributes.get("class", "") == "mark_group":
                self.chart.children[0].children[0].children.remove(child)
                self.chart.children[0].children[0].children.insert(0, child)
                break
        self.legend_group = element_parser.legend_group
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
        if self.defs is not None:
            svg_right = SVGTreeConverter.defs_to_svg(self.defs) + svg_right
        svg_str = svg_left + svg_content + svg_right
        
        return svg_str

    def apply_icon_mark(self, json_data: Dict):
        variation = json_data['variation']
        if variation['icon_mark'] == "overlay":
            print("apply_icon_mark_overlay")
            print("self: ", self)
            # 使用type()获取实际的类，调用对应的方法
            self.apply_icon_mark_overlay(json_data)
        elif variation['icon_mark'] == "side":
            self.apply_icon_mark_side(json_data)
        elif variation['icon_mark'] == "replace":
            self.apply_icon_mark_replace(json_data)

    def apply_icon_mark_overlay(self, json_data: Dict):
        print("apply_icon_mark_overlay father")
        pass
    
    def apply_icon_mark_side(self, json_data: Dict):    
        pass

    def apply_icon_mark_replace(self, json_data: Dict):
        pass
    
    def apply_axis_label(self, json_data: Dict):
        variation = json_data['variation']
        print("apply axis label variation: ", variation)
        
        if variation['axis_label'] == "side":
            self.apply_axis_label_side(json_data)
        elif variation['axis_label'] == "replace":
            self.apply_axis_label_replace(json_data)
    
    def apply_axis_label_side(self, json_data: Dict):
        pass
    
    def apply_axis_label_replace(self, json_data: Dict):
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
        variation = json_data['variation']
        if variation['background'] == "styled":
            self.apply_background_styled(json_data)
        elif variation['background'] == "none" or variation['background'] == "no":
            pass
    
    def apply_background_styled(self, json_data: Dict):
        # pass
        background_chart = BackgroundChart(self.chart)
        background_chart_config = {
            'type': 'styled',
            'orientation': 'vertical'
        }
        self.chart = background_chart.process(background_chart_config)
    
    def adjust_axis_readability(self):
        for axis in self.axes:
            axis_label_group = None
            for child in axis.children:
                if child.attributes.get("class", "") == "axis_label-group":
                    axis_label_group = child
                    break
            if axis_label_group is None:
                continue
            texts = []
            font_size = 0
            axis_orient = ""
            x_list = []
            y_list = []
            width_constraint = None
            height_constraint = None
            for child in axis_label_group.children:
                axis_orient = child.axis_orient
                texts.append(child.children[0].content)
                font_size = float(child.children[0].attributes.get("font-size", 0).replace("px", ""))
                x_list.append(child.get_bounding_box().minx + child.get_bounding_box().width / 2)
                y_list.append(child.get_bounding_box().miny + child.get_bounding_box().height / 2)
            if axis_orient == "left" or axis_orient == "right":
                # Note 0304: 先不处理这种label
                continue
            elif axis_orient == "top" or axis_orient == "bottom":
                width_constraint = 10000
                for i in range(len(x_list)-1):
                    width_constraint = min(width_constraint, abs(x_list[i+1] - x_list[i]))
            numbers = []
            units = []
            for text in texts:
                number, unit = number_spliter(text)
                numbers.append(number)
                units.append(unit)
            valid_text_flag = True
            for number, unit in zip(numbers, units):
                if number_type_judge(number) == "invalid":
                    valid_text_flag = False
                    break
            if not valid_text_flag:
                continue
            constraints = []
            for i in range(len(numbers)):
                constraints.append(Constraint(width_constraint*0.9, height_constraint))
            number_readability_processor = NumberReadabilityProcessor(numbers, units, font_size, constraints)
            numbers, units, font_size = number_readability_processor.process()
            for i, child in enumerate(axis_label_group.children):
                axis_orient = child.axis_orient
                reference_point = "center"
                if axis_orient == "left":
                    reference_point = "right"
                elif axis_orient == "right":
                    reference_point = "left"
                elif axis_orient == "top":
                    reference_point = "bottom"
                elif axis_orient == "bottom":
                    reference_point = "top"
                apply_to_element(child.children[0], numbers[i]+units[i], font_size, reference_point)
        print("avoid label overlap")
        for axis in self.axes:
            axis_readability_processor = AxisReadabilityProcessor(axis)
            axis_readability_processor.avoid_label_overlap()
        
    
    def apply_variation(self, json_data: Dict):
        # constants = json_data['constants']
        # variation = json_data['variation']
        # print("apply variation: ", variation)
        # if variation['icon_mark'] != "none":
        #     self.apply_icon_mark(json_data)
        # if variation['axis_label'] != "none":
        #     self.apply_axis_label(json_data)
        # if variation['background'] != "none":
        #     self.apply_background(json_data)
        try:
            self.adjust_legend_position()
        except Exception as e:
            print("adjust legend position error: ", e)
        try:
            self.adjust_axis_readability()
        except Exception as e:
            print("adjust axis readability error: ", e)
