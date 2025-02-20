from typing import Optional, Dict, List, Tuple, Union
import re
from lxml import etree
from io import StringIO
import math
from .tree_converter import SVGTreeConverter
from .elements import *
from .layout import *
import random
from ..image_processor import ImageProcessor
from .overlay_processor import OverlayProcessor
# No module named 'src.processors.svg_processor_modules.overlay_processor'
from ...utils.text_similarity import get_text_list_similarity, linear_assignment,get_text_similarity
# No module named 'src.utils.text_similarity'

class VegaLiteParser():
    def __init__(self, svg: str, additional_configs: Dict):
        self.svg = svg
        self.additional_configs = additional_configs
        self.data = additional_configs['data']
        # self.mark_group = None
        self.all_mark_groups = []
        self.mark_annotation_group = None
        self.x_axis_group = None
        self.y_axis_group = None
        self.x_axis_label_group = None
        self.y_axis_label_group = None
        self.in_x_axis_flag = False
        self.in_y_axis_flag = False
        self.in_legend_flag = False
        self.in_mark_group_flag = False
        self.mark_data_map = {}
        self.x_values = []
        for data in self.data:
            self.x_values.append(str(data['x_data']))
        self.x_values = list(set(self.x_values))
        self.group_values = []
        for data in self.data:
            self.group_values.append(str(data.get('group', '')))
        self.group_values = list(set(self.group_values))
        self.defs = None
        
    def parse(self) -> dict:
        # 解析SVG为树结构
        # 移除self.svg中<style >到</style>之间的内容
        self.svg = re.sub(r'<style[^>]*>.*?</style>', '', self.svg)
        # print("self.svg: ", self.svg)
        svg_tree = self.parseTree(self.svg)
        # print("svg_tree: ", svg_tree)
        self.svg_root = {
            'tag': 'svg',
            'attributes': svg_tree['attributes'],
        }
        
        # 转换为Elements树
        elements_tree = SVGTreeConverter.convert(svg_tree)
        
        # 遍历Elements树，找到mark_group, mark_annotation_group, axis_group, x_axis_group, y_axis_group, x_axis_label_group, y_axis_label_group
        self._traverse_elements_tree(elements_tree)
        
        group_to_flatten = {
            # 'mark_group': self.mark_group,
            'mark_annotation_group': self.mark_annotation_group,
            'x_axis_group': self.x_axis_group,
            'y_axis_group': self.y_axis_group,
        }
        for i, mark_group in enumerate(self.all_mark_groups):
            group_to_flatten[f'mark_group_{i}'] = mark_group
        
        try:
            orient = self.additional_configs['chart_template'].mark.orientation
        except:
            orient = 'horizontal'
            
        category_axis = None
        if self.additional_configs['chart_template'].mark.type == 'bar':
            if orient == 'horizontal':
                category_axis = self.y_axis_group
            else:
                category_axis = self.x_axis_group
        if category_axis is not None:
            def find_all_text_elements(element):
                # 将element的children以及递归地children的children中的text元素返回
                text_elements = []
                if element.tag == 'text':
                    text_elements.append(element)
                if hasattr(element, 'children'):
                    for child in element.children:
                        text_elements.extend(find_all_text_elements(child))
                return text_elements
            
            category_axis_text_elements = find_all_text_elements(category_axis)
            texts = [element.content for element in category_axis_text_elements]
            # x_texts = [self.data[i]['x_data'] for i in range(len(self.data))]
            # unique texts
            # texts = list(set(texts))
            # x_texts = list(set(x_texts))
            # 如果texts比x_texts短，则用""补齐
            if len(texts) < len(self.x_values):
                texts.extend([""] * (len(self.x_values) - len(texts)))
            # 如果texts比x_texts长，则用texts中最后一个元素补齐
            if len(texts) > len(self.x_values):
                texts = texts[:len(self.x_values)]
            # 如果x_texts比texts长，则用x_texts中最后一个元素补齐
            if len(self.x_values) > len(texts):
                self.x_values.extend([self.x_values[-1]] * (len(texts) - len(self.x_values)))
            print("texts: ", texts)
            print("x_texts: ", self.x_values)
            similarity_matrix = get_text_list_similarity(texts, self.x_values)
            assignment = linear_assignment(similarity_matrix)
            # 根据assignment，找到每个category_axis_text_element对应的x_texts
            self.text_data_map = {}
            for i, text in enumerate(texts):
                self.text_data_map[category_axis_text_elements[i]] = self.x_values[assignment[i]]
        
        def find_element_with_aria_label(element):
                if 'aria-label' in element.attributes:
                    return element
                if hasattr(element, 'children'):
                    for child in element.children:
                        found = find_element_with_aria_label(child)
                        if found:
                            return found
                return None
        
        for mark_group in self.all_mark_groups:
            # self.replace_area_mark_with_image(mark_group)
            for element in mark_group.children:
                element_with_data = find_element_with_aria_label(element)
                if element_with_data:
                    self._bind_data_to_mark(element_with_data)
        icon_urls = self.additional_configs['x_data_multi_url']
        self.value_icon_map = {}
        self.value_icon_map['x'] = {}
        self.value_icon_map['y'] = {}
        self.value_icon_map['group'] = {}
        # print("icon_urls: ", icon_urls)
        for key, value in self.mark_data_map.items():
            if value['x_value'] is not None:
                if value['x_value'] not in self.value_icon_map['x']:
                    try:
                        # 从icon_urls中找到value['x_value']对应的icon_url
                        for icon_url in icon_urls:
                            if value['x_value'] in icon_url['text']:
                                self.value_icon_map['x'][value['x_value']] = icon_url['file_path']
                                break
                    except:
                        self.value_icon_map['x'][value['x_value']] = icon_urls[random.randint(0, len(icon_urls) - 1)]
                        
                    # self.value_icon_map['x'][value['x_value']] = icon_urls[random.randint(0, len(icon_urls) - 1)]
            if value['y_value'] is not None:
                if value['y_value'] not in self.value_icon_map['y']:
                    self.value_icon_map['y'][value['y_value']] = icon_urls[random.randint(0, len(icon_urls) - 1)]
            if value['group_value'] is not None:
                if value['group_value'] not in self.value_icon_map['group']:
                    self.value_icon_map['group'][value['group_value']] = icon_urls[random.randint(0, len(icon_urls) - 1)]
            
            
            
        # orient = self.additional_configs['chart_config'].get('orientation', 'horizontal')

        
        # directions = ['top', 'bottom', 'left', 'right']
        # sides = ['outside', 'inside', 'half']
        config = {
            # 随机选择一个direction
            # 'direction': random.choice(directions),
            'direction': 'left',
            # 随机选择一个side
            # 'side': random.choice(sides),
            'side': 'inside',
            
            # 随机选择一个padding
            # 'padding': random.randint(0, 10)
            'orient': orient
        }
        # # print("config: ", config)
        
        
        def replace_corresponding_element(element, element_to_replace, new_element):
            if hasattr(element, 'children'):
                for i, child in enumerate(element.children):
                    if child == element_to_replace:
                        element.children[i] = new_element
                        return True
                    if replace_corresponding_element(child, element_to_replace, new_element):
                        return True
            return False
        
        mark_type = self.additional_configs['chart_template'].mark.type
        if self.additional_configs.get('image_overlay', {}).get(mark_type, {}).get('object', '') == 'label':
            
            config = self.additional_configs['image_overlay']
            config['type'] = mark_type
            axis_orient = self.additional_configs['chart_template'].x_axis.orientation
            try:
                orient = self.additional_configs['chart_template'].mark.orientation
            except:
                orient = 'horizontal'
                
            config['orient'] = orient
            old_boundingboxes = []
            new_boundingboxes = []
            for text_element in self.text_data_map:
                image_url = self.value_icon_map['x'][self.text_data_map[text_element]]
                base64_image = Image._getImageAsBase64(image_url)
                if config.get('crop', '') == 'circle':
                    content_type = base64_image.split(';base64,')[0]
                    base64 = base64_image.split(';base64,')[1]
                    base64 = ImageProcessor().crop_by_circle(base64)
                    base64_image = f"{content_type};base64,{base64}"
                image_element = Image(base64_image)
                image_element.attributes = {
                    "xlink:href": f"data:{base64_image}"
                }
                # image_element._bounding_box = image_element.get_bounding_box()
                # mark_group.children[j] = image_element
                overlay_processor = OverlayProcessor(text_element, image_element, config)
                # 用overlay_processor.process()的返回值替换mark_group子树下的element_with_data
                # old_boundingboxes.append(text_element.get_bounding_box())
                old_boundingbox = text_element.get_bounding_box()
                new_element = overlay_processor.process()
                replace_corresponding_element(category_axis, text_element, new_element)
                new_boundingbox = new_element.get_bounding_box()
                shift_x = 0
                shift_y = 0
                if axis_orient == 'left':
                    shift_x = old_boundingbox.maxx - new_boundingbox.maxx
                elif axis_orient == 'right':
                    shift_x = old_boundingbox.minx - new_boundingbox.minx
                elif axis_orient == 'top':
                    shift_y = old_boundingbox.maxy - new_boundingbox.maxy
                elif axis_orient == 'bottom':
                    shift_y = old_boundingbox.miny - new_boundingbox.miny
                print("text_element shift_x: ", shift_x)
                print("text_element shift_y: ", shift_y)
                # new_element.attributes['x'] = float(new_element.attributes.get('x', 0)) + shift_x
                # new_element.attributes['y'] = float(new_element.attributes.get('y', 0)) + shift_y
                new_element.attributes['transform'] = f"translate({shift_x}, {shift_y})" + new_element.attributes.get('transform', '')
        shift_x = 0
        shift_y = 0
        flag_to_move = False
        
        if self.additional_configs['chart_template'].mark.type == 'bar' and self.additional_configs.get('image_overlay', {}).get(mark_type, {}).get('object', '') == 'mark':
            config = self.additional_configs['image_overlay']
            config['type'] = mark_type
            try:
                orient = self.additional_configs['chart_template'].mark.orientation
            except:
                orient = 'horizontal'
            config['orient'] = orient
            old_boundingboxes = []
            new_boundingboxes = []
            for i, mark_group in enumerate(self.all_mark_groups):
                for j, element in enumerate(mark_group.children):
                    element_with_data = find_element_with_aria_label(element)
                        
                    # print("element: ", element.dump())
                    # image_url = image_urls[j]
                    # try:
                    #     image_url = self.value_icon_map['group'][self.mark_data_map[element]['group_value']]
                    # except:
                    image_url = self.value_icon_map['x'][self.mark_data_map[element_with_data]['x_value']]
                    base64_image = Image._getImageAsBase64(image_url)
                    if config.get('crop', '') == 'circle':
                        content_type = base64_image.split(';base64,')[0]
                        base64 = base64_image.split(';base64,')[1]
                        base64 = ImageProcessor().crop_by_circle(base64)
                        base64_image = f"{content_type};base64,{base64}"
                    image_element = Image(base64_image)
                    image_element.attributes = {
                        "xlink:href": f"data:{base64_image}"
                    }
                    # image_element._bounding_box = image_element.get_bounding_box()
                    # mark_group.children[j] = image_element
                    overlay_processor = OverlayProcessor(element_with_data, image_element, config)
                    # 用overlay_processor.process()的返回值替换mark_group子树下的element_with_data
                    old_boundingboxes.append(element_with_data.get_bounding_box())
                    new_element = overlay_processor.process()
                    replace_corresponding_element(mark_group, element_with_data, new_element)
                    new_boundingboxes.append(new_element.get_bounding_box())
            # print("old_boundingboxes: ", old_boundingboxes)
            # print("new_boundingboxes: ", new_boundingboxes)
            if orient == 'horizontal' and config['direction'] == 'left' and config['side'] == 'outside':
                flag_to_move = True
                shift_x = new_boundingboxes[0].minx - old_boundingboxes[0].minx
            if orient == 'vertical' and config['direction'] == 'bottom' and config['side'] == 'outside':
                flag_to_move = True
                shift_y = new_boundingboxes[0].maxy - old_boundingboxes[0].maxy
                    
                    # replace_corresponding_element(mark_group, element_with_data, overlay_processor.process_replace_single())
                    
                    
                    # 随机从1,2,3中取一个
                    # choice = random.randint(1, 3)
                    # if choice == 1:
                    #     mark_group.children[j] = overlay_processor.process()
                    # elif choice == 2:
                    #     mark_group.children[j] = overlay_processor.process_replace_single()
                    # else:
                    #     mark_group.children[j] = overlay_processor.process_replace_multiple()
                    # overlay_processor.process_replace_single()
        
        if self.additional_configs['chart_template'].mark.type == 'arc' and self.additional_configs.get('image_overlay', {}).get('object', '') == 'mark':
            print("self.additional_configs['chart_template'].mark.type: ", self.additional_configs['chart_template'].mark.type)
            config = self.additional_configs['image_overlay']
            config['type'] = mark_type
            print("self.all_mark_groups: ", self.all_mark_groups)
            for i, mark_group in enumerate(self.all_mark_groups):
                for j, element in enumerate(mark_group.children):
                    element_with_data = find_element_with_aria_label(element)
                    print("element_with_data: ", element_with_data.dump())
                    # print("element: ", element.dump())
                    # image_url = image_urls[j]
                    # try:
                    #     image_url = self.value_icon_map['group'][self.mark_data_map[element]['group_value']]
                    # except:
                    image_url = self.value_icon_map['x'][self.mark_data_map[element_with_data]['x_value']]
                    base64_image = Image._getImageAsBase64(image_url)
                    content_type = base64_image.split(';base64,')[0]
                    base64 = base64_image.split(';base64,')[1]
                    base64 = ImageProcessor().crop_by_circle(base64)
                    base64_image = f"{content_type};base64,{base64}"
                    image_element = Image(base64_image)
                    image_element.attributes = {
                        "xlink:href": f"data:{base64_image}"
                    }
                    # image_element._bounding_box = image_element.get_bounding_box()
                    # mark_group.children[j] = image_element
                    overlay_processor = OverlayProcessor(element_with_data, image_element, config)
                    new_element = overlay_processor.process()
                    replace_corresponding_element(mark_group, element_with_data, new_element)
            

        
        
        # flattened_elements_tree = SVGTreeConverter.partial_flatten_tree(elements_tree, group_to_flatten)
        # print(elements_tree.dump())
        flattened_elements_tree, top_level_groups = SVGTreeConverter.move_groups_to_top(elements_tree, group_to_flatten)
        
        
        # 移除tree中所有class为background的元素
        flattened_elements_tree = SVGTreeConverter.remove_elements_by_class(flattened_elements_tree, 'background')
        flattened_elements_tree = SVGTreeConverter.remove_elements_by_class(flattened_elements_tree, 'foreground')
        
        
        # print("top_level_groups['y_axis_group']: ", top_level_groups['y_axis_group'])
        # mark_group = top_level_groups['mark_group']
        x_axis_group = top_level_groups['x_axis_group']
        y_axis_group = top_level_groups['y_axis_group']
        print("x_axis_group: ", x_axis_group)
        print("y_axis_group: ", y_axis_group)
        # x_axis_label_group = top_level_groups['x_axis_label_group']
        # y_axis_label_group = top_level_groups['y_axis_label_group']
        x_axis_label_group = [element for element in top_level_groups['x_axis_group'] if element.tag == 'text' and "role-axis-label" in element.attributes.get('class', '')]
        y_axis_label_group = [element for element in top_level_groups['y_axis_group'] if element.tag == 'text' and "role-axis-label" in element.attributes.get('class', '')]
        mark_annotation_group = top_level_groups['mark_annotation_group']
        
        layout_graph = LayoutGraph()
        
            
        orientation = self.additional_configs['chart_template'].mark.orientation
        direction = ""
        if orientation == "horizontal":
            x_axis_label_group, y_axis_label_group = y_axis_label_group, x_axis_label_group
            x_axis_group, y_axis_group = y_axis_group, x_axis_group
        
        # 把x_axis_label_group中的text元素的x坐标+shift_x,y坐标+shift_y
        
        # print("shift_x: ", shift_x)
        # print("shift_y: ", shift_y)
        # print("x_axis_label_group: ", x_axis_label_group)
        for element in x_axis_label_group:
            element.attributes['x'] = float(element.attributes.get('x', 0)) + shift_x
            element.attributes['y'] = float(element.attributes.get('y', 0)) + shift_y
        
        
        
        # if axis_orientation == "left":
        #     direction = "right"
        # elif axis_orientation == "right":
        #     direction = "left"
        # elif axis_orientation == "top":
        #     direction = "down"
        # else:
        #     direction = "up"
        
        # sequence = self.additional_configs['chart_composition']['sequence']
        # relative_to_mark = self.additional_configs['chart_composition']['relative_to_mark']
        
        # print("mark_group: ", mark_group)
        # print("mark_annotation_group: ", mark_annotation_group)
        # print("y_axis_label_group: ", y_axis_label_group)
        # build inital layout graph
        # if "mark_annotation" in sequence:
        #     if direction == "up" or direction == "down":
        #         min_mark_width = max([mark.get_bounding_box().width for mark in mark_group])
        #         max_annotation_width = max([mark_annotation.get_bounding_box().width for mark_annotation in mark_annotation_group])
        #         if min_mark_width < max_annotation_width:
                    # for i in range(len(mark_annotation_group)):
                    #     if direction == "up":
                    #         if self.additional_configs['chart_template'].mark.annotation_side == "inner":
                    #             mark_annotation_group[i].rotate_to_fit("top")
                    #         else:
                    #             mark_annotation_group[i].rotate_to_fit("bottom")
                    #     else:
                    #         if self.additional_configs['chart_template'].mark.annotation_side == "inner":
                    #             mark_annotation_group[i].rotate_to_fit("bottom")
                    #         else:
                    #             mark_annotation_group[i].rotate_to_fit("top")
        
        # 从flattened_elements_tree中找到area_mark_group
        # for element in flattened_elements_tree.children:
        #     print("element: ", element)
        #     if element.tag == 'g': print("element: ", element.dump())
        
        # self._traverse_elements_tree(flattened_elements_tree)
        
        # element_to_replace = {
        #     'area_mark_group': self.area_mark_group,
        # }
        
        # # 将area_mark_group中的path转换为image
        # print("self.area_mark_group: ", self.area_mark_group)
        # print("flattened_elements_tree: ", flattened_elements_tree.dump())
        # self.replace_area_mark_with_image(self.area_mark_group)
            
        # for i in range(len(mark_group)):
        #     if "mark_annotation" in sequence:
        #         mark_group[i]._bounding_box = mark_group[i].get_bounding_box()
        #         mark_annotation_group[i]._bounding_box = mark_annotation_group[i].get_bounding_box()
        #         y_axis_label_group[i]._bounding_box = y_axis_label_group[i].get_bounding_box()
        #         layout_strategy_1 = parse_layout_strategy(mark_group[i], mark_annotation_group[i], orientation)
        #         layout_strategy_2 = parse_layout_strategy(mark_group[i], y_axis_label_group[i], orientation)
        #         layout_graph.add_edge_by_value(mark_group[i], mark_annotation_group[i], layout_strategy_1)
        #         layout_graph.add_edge_by_value(mark_group[i], y_axis_label_group[i], layout_strategy_2)
        #     else:
        #         mark_group[i]._bounding_box = mark_group[i].get_bounding_box()
        #         mark_annotation_group[i]._bounding_box = mark_annotation_group[i].get_bounding_box()
        #         layout_strategy_1 = parse_layout_strategy(mark_group[i], mark_annotation_group[i],orientation)
        #         layout_graph.add_edge_by_value(mark_group[i], mark_annotation_group[i], layout_strategy_1)
        
        # temporal_group_element = GroupElement()
        # temporal_group_element.tag = "g"
        # temporal_group_element.id = "temporal_group"
        # temporal_group_element.children = y_axis_label_group
        # temporal_group_element._bounding_box = temporal_group_element.get_bounding_box()
        
        # # y_axis_title_element = 
        # # 从y_axis_group中找到title对应的element
        # for element in y_axis_group:
        #     if element.tag == "text":
        #         # 如果class attribute中有"role-axis-title"
        #         if "role-axis-title" in element.attributes.get('class', ''):
        #             y_axis_title_element = element
        #             break
        # layout_strategy_3 = parse_layout_strategy(temporal_group_element, y_axis_title_element, orientation)
        # layout_graph.add_edge_by_value(temporal_group_element, y_axis_title_element, layout_strategy_3)
        # # print("layout_strategy_3: ", layout_strategy_3.name, layout_strategy_3.direction, layout_strategy_3.padding, layout_strategy_3.offset, layout_strategy_3.alignment)
        # # 把 paading的绝对值改成5，保证正负和之前不变
        # if layout_strategy_3.padding < 0:
        #     layout_strategy_3.padding = -5
        # else:
        #     layout_strategy_3.padding = 5
        # nodemap = layout_graph.node_map
        # node = nodemap[y_axis_title_element]
        # temporal_edge = node.prevs_edges[0]
        
        # # 从single和multi中随机取一个
        # # icon_type = random.choice(["single", "multi"])
        # icon_type = "multi"
        # x_datas = []
        # image_urls = []

        
        
        # if icon_type == "multi":
        #     raw_image_urls = self.additional_configs['x_data_multi_url']
        #     x_data_multi_icon_map = self.additional_configs['x_data_multi_icon_map']
        #     # print("x_data_multi_icon_map: ", x_data_multi_icon_map)
        #     x_data_lines = []
        #     x_data_ordered = []
        #     for i in range(len(mark_group)):
        #         x_data_lines.append(mark_group[i].attributes.get('aria-label', ''))
        #         print("x_data_lines[i]: ", x_data_lines[i])
        #         for key in x_data_multi_icon_map:
        #             if str(key) in x_data_lines[i]:
        #                 image_urls.append(x_data_multi_icon_map[key])
        #                 print("image_urls[i]: ", image_urls[i])
        #                 x_data_ordered.append(key)
        #                 break
        #     # for i in range(len(y_axis_label_group)):
        #     #     print("y_axis_label_group[i]: ", y_axis_label_group[i].content)
        #     # 获取第一个y轴标签的aria-label属性值作为字符串
        #     arial_label = y_axis_label_group[0].attributes.get('aria-label', '')
        #     print("arial_label: ", arial_label)
        #     # 获取x_data_ordered中每个key在arial_label字符串中的位置
        #     x_data_indexes = []
        #     for key in x_data_ordered:
        #         # 在arial_label字符串中查找每个单词key的位置
        #         index = arial_label.find(str(key))
        #         if index != -1:
        #             x_data_indexes.append(index)
        #     print("x_data_indexes: ", x_data_indexes)
        #     # 将x_data_indexes中的值替换为该值在排序后的序列中的索引
        #     # 例如，x_data_indexes = [104, 69, 76, 60, 100, 91, 83]
        #     # sorted_indexes = [6, 1, 2, 0, 5, 4, 3]
        #     sorted_indexes = sorted(range(len(x_data_indexes)), key=lambda i: x_data_indexes[i])
        #     sorted_indexes = [sorted_indexes.index(i) for i in range(len(sorted_indexes))]
        #     print("sorted_indexes: ", sorted_indexes)
        #     y_axis_label_group = [y_axis_label_group[i] for i in sorted_indexes]
        #     for i in range(len(y_axis_label_group)):
        #         print("y_axis_label_group[i]: ", y_axis_label_group[i].content)
            
            
        # else:
        #     image_urls = [self.additional_configs['x_data_single_url']]*len(mark_group)
        # print("image_urls: ", image_urls)
        # # print("image_urls: ", image_urls)
        # # image_urls = []
        # for i in range(len(image_urls)):
        #     base64_image = Image._getImageAsBase64(image_urls[i])
        #     content_type = base64_image.split(';base64,')[0]
        #     base64 = base64_image.split(';base64,')[1]
        #     image_processor = ImageProcessor()
        #     base64_image = image_processor.crop_by_circle(base64)
        #     base64_image = f"{content_type};base64,{base64_image}"
            
        #     image_element = Image(base64_image)
        #     original_width, original_height = Image.get_image_size(image_urls[i])
        #     image_element.original_width = original_width
        #     image_element.original_height = original_height
        #     aspect_ratio = original_width / original_height
            
        #     # 计算新的width和height
        #     if orientation == "horizontal":
        #         height = mark_group[i].get_bounding_box().height * 1.1
        #         width = height * aspect_ratio
        #     else:
        #         width = mark_group[i].get_bounding_box().width * 1.1
        #         height = width / aspect_ratio
        #     image_element.attributes = {
        #         "xlink:href": f"data:{base64_image}",
        #         "width": width,
        #         "height": height,
        #     }
        #     boundingbox = image_element.get_bounding_box()
        #     image_element._bounding_box = boundingbox
            
        #     if orientation == "horizontal":
        #         if relative_to_mark and relative_to_mark[0] == "inside":
        #             layout_strategy = InnerHorizontalLayoutStrategy()
        #             if relative_to_mark[1] == "start" and direction == "right":
        #                 layout_strategy.direction = 'left'
        #             elif relative_to_mark[1] == "end" and direction == "right":
        #                 layout_strategy.direction = 'right'
        #             elif relative_to_mark[1] == "start" and direction == "left":
        #                 layout_strategy.direction = 'left'
        #             elif relative_to_mark[1] == "end" and direction == "left":
        #                 layout_strategy.direction = 'right'
        #             elif relative_to_mark[1] == "middle":
        #                 layout_strategy = MiddleHorizontalLayoutStrategy()
        #         else:
        #             layout_strategy = HorizontalLayoutStrategy()
        #     else:
        #         if relative_to_mark and relative_to_mark[0] == "inside":
        #             layout_strategy = InnerVerticalLayoutStrategy()
        #             if relative_to_mark[1] == "start" and direction == "down":
        #                 layout_strategy.direction = 'up'
        #             elif relative_to_mark[1] == "end" and direction == "down":
        #                 layout_strategy.direction = 'down'
        #             elif relative_to_mark[1] == "start" and direction == "up":
        #                 layout_strategy.direction = 'up'
        #             elif relative_to_mark[1] == "end" and direction == "up":
        #                 layout_strategy.direction = 'down'
        #             elif relative_to_mark[1] == "middle":
        #                 layout_strategy = MiddleVerticalLayoutStrategy()
        #         else:
        #             layout_strategy = VerticalLayoutStrategy()
            
        #     # 如果在sequence里,"axis_label"在"x_multiple_icon"之前
        #     if "axis_label" in sequence and "x_multiple_icon" in sequence and sequence.index("axis_label") < sequence.index("x_multiple_icon") and not relative_to_mark[0] == "inside" and sequence.index("x_multiple_icon") < sequence.index("mark"):
        #         print("chart-image-template: 2")
        #         # print("direction: ", direction)
        #         # layout_strategy.direction与direction相反，如果direction是right，则layout_strategy.direction是left
        #         if direction == "right":
        #             layout_strategy.direction = "left"
        #         elif direction == "left":
        #             layout_strategy.direction = "right"
        #         elif direction == "down":
        #             layout_strategy.direction = "up"
        #         else:
        #             layout_strategy.direction = "down"
        #         layout_graph.add_node_with_edges(image_element, y_axis_label_group[i], layout_strategy)
        #         node = layout_graph.node_map[image_element]
        #         # print("node: ", node.value.tag, node.value._bounding_box)
        #         for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
        #             # print("prev_layout_strategy: ", prev_layout_strategy.value.name, prev_layout_strategy.value.direction, prev_layout_strategy.value.padding, prev_layout_strategy.value.offset, prev_layout_strategy.value.alignment)
        #             # print("prev: ", prev.value.tag, prev.value._bounding_box)
        #             prev_layout_strategy.process_layout()
        #         for next, next_layout_strategy in zip(node.nexts, node.nexts_edges):
        #             # print("next_layout_strategy: ", next_layout_strategy.value.name, next_layout_strategy.value.direction, next_layout_strategy.value.padding, next_layout_strategy.value.offset, next_layout_strategy.value.alignment)
        #             # print("next: ", next.value.tag, next.value._bounding_box)
        #             next_layout_strategy.process_layout()

        #         flattened_elements_tree.children.append(image_element)
        #     elif "axis_label" in sequence and "x_multiple_icon" in sequence and sequence.index("axis_label") > sequence.index("x_multiple_icon"):
        #         print("chart-image-template: 1")
        #         if direction == "right":
        #             layout_strategy.direction = "left"
        #         elif direction == "left":
        #             layout_strategy.direction = "right"
        #         elif direction == "down":
        #             layout_strategy.direction = "up"
        #         else:
        #             layout_strategy.direction = "down"
        #         layout_graph.add_node_with_edges(y_axis_label_group[i], image_element, layout_strategy)
        #         node = layout_graph.node_map[image_element]
        #         for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
        #             prev_layout_strategy.process_layout()
        #         flattened_elements_tree.children.append(image_element)
                
        #     elif "axis_label" in sequence and "x_multiple_icon" in sequence and sequence.index("axis_label") < sequence.index("x_multiple_icon") and relative_to_mark[0] == "inside" and relative_to_mark[1] == "start":
        #         print("chart-image-template: 3")
        #         if direction == "right":
        #             layout_strategy.direction = "left"
        #         elif direction == "left":
        #             layout_strategy.direction = "right"
        #         elif direction == "down":
        #             layout_strategy.direction = "up"
        #         else:
        #             layout_strategy.direction = "down"
        #         layout_graph.add_node_with_edges(mark_group[i], image_element, layout_strategy)
        #         node = layout_graph.node_map[image_element]
        #         for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
        #             prev_layout_strategy.process_layout()
        #         flattened_elements_tree.children.append(image_element)
        #     # 如果在sequence里,"x_multiple_icon"在"mark_annotation"之后
        #     elif "x_multiple_icon" in sequence and "mark_annotation" in sequence and sequence.index("x_multiple_icon") > sequence.index("mark_annotation"):
        #         print("chart-image-template: 7")
        #         layout_strategy.direction = direction
                    
        #         layout_graph.add_node_with_edges(mark_annotation_group[i], image_element, layout_strategy)
        #         node = layout_graph.node_map[image_element]
        #         for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
        #             prev_layout_strategy.process_layout()
        #         flattened_elements_tree.children.append(image_element)
        #     # 如果在sequence里,"x_multiple_icon"在"mark_annotation"之前，且在"mark"之后
        #     elif "x_multiple_icon" in sequence and "mark_annotation" in sequence and sequence.index("x_multiple_icon") < sequence.index("mark_annotation") and sequence.index("x_multiple_icon") > sequence.index("mark") and not relative_to_mark[0] == "inside":
        #         print("chart-image-template: 6")
        #         layout_strategy.direction = direction
        #         layout_graph.add_node_with_edges(image_element, mark_annotation_group[i], layout_strategy)
        #         node = layout_graph.node_map[image_element]
        #         for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
        #             prev_layout_strategy.process_layout()
        #         for next, next_layout_strategy in zip(node.nexts, node.nexts_edges):
        #             next_layout_strategy.process_layout()
        #         flattened_elements_tree.children.append(image_element)
        #     # 如果在sequence里,"x_multiple_icon"在"mark_annotation"之前，且在"mark"之后
        #     elif "x_multiple_icon" in sequence and "mark_annotation" in sequence and sequence.index("x_multiple_icon") < sequence.index("mark_annotation") and sequence.index("x_multiple_icon") > sequence.index("mark") and relative_to_mark[0] == "inside":
        #         print("chart-image-template: 4 or 5")
        #         if relative_to_mark[1] == "start":
        #             if direction == "right":
        #                 layout_strategy.direction = "left"
        #             elif direction == "left":
        #                 layout_strategy.direction = "right"
        #             elif direction == "down":
        #                 layout_strategy.direction = "up"
        #             else:
        #                 layout_strategy.direction = "down"
        #         else:
        #             layout_strategy.direction = direction
        #         layout_graph.add_node_with_edges(mark_group[i], image_element, layout_strategy)
        #         node = layout_graph.node_map[image_element]
        #         for prev, prev_layout_strategy in zip(node.prevs, node.prevs_edges):
        #             prev_layout_strategy.process_layout()
        #         flattened_elements_tree.children.append(image_element)
        #     else:
        #         # 报错
        #         raise ValueError(f"不支持的sequence: {sequence}")
            
        # temporal_group_element._bounding_box = temporal_group_element.get_bounding_box()
        # temporal_edge.process_layout()
        
        # layout_graph.visualize()
        # print(flattened_elements_tree.dump())
        # 将Elements树转换为SVG字符串
        attrs_list = []
        for key, value in self.svg_root['attributes'].items():
            attrs_list.append(f'{key}="{value}"')
        attrs_str = ' '.join(attrs_list)
        svg_left = f"<svg {attrs_str} xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
        svg_right = f"</svg>"
        svg_str = SVGTreeConverter.element_tree_to_svg(flattened_elements_tree)
        # if self.defs:
        #     svg_str =  svg_str + SVGTreeConverter.defs_to_svg(self.defs)
        svg_str = svg_left + svg_str + svg_right
        if self.defs:
            res_defs = SVGTreeConverter.defs_to_svg(self.defs)
        else:
            res_defs = ''
        return svg_str, flattened_elements_tree, layout_graph, res_defs
    
    def replace_area_mark_with_image(self, father: GroupElement):
        # 首先找到area_mark
        for i,child in enumerate(father.children):
            if self.if_area_mark(child):
                # 将area_mark的path转换为image
                image_path = "D:/VIS/Infographics/data/chart_pipeline/src/test.png"
                base64_image = Image._getImageAsBase64(image_path)
                base64 = base64_image.split(';base64,')[1]
                base64 = ImageProcessor().clip_by_path(base64, child)
                content_type = base64_image.split(';base64,')[0]
                print("child.attributes:", child.attributes)
                base64_image = f"{content_type};base64,{base64}"
                image_element = Image(base64_image)
                coordinates = child._get_path_coordinates()
                print("coordinates: ", coordinates)
                min_x = min(coordinates, key=lambda x: x[0])[0]
                min_y = min(coordinates, key=lambda y: y[1])[1]
                max_x = max(coordinates, key=lambda x: x[0])[0]
                max_y = max(coordinates, key=lambda y: y[1])[1]
                child._bounding_box = child.get_bounding_box()
                print("child._bounding_box: ", child._bounding_box)
                image_element.attributes = {
                    "xlink:href": f"data:{base64_image}",
                    'width': child._bounding_box.width,
                    'height': child._bounding_box.height,
                    'x': min_x,
                    'y': min_y,
                    'preserveAspectRatio':'none',
                }
                image_element.attributes['transform'] = child.attributes.get('transform', '')
                image_element._bounding_box = child._bounding_box
                father.children[i] = image_element
                break
    
    def if_area_mark(self, element: LayoutElement) -> bool:
        return element.tag == 'path'
    def if_area_mark_group(self, group: LayoutElement) -> bool:
        if not group.tag == 'g':
            return False
        #如果group中有一个child是area_mark,则返回True
        for child in group.children:
            if self.if_area_mark(child):
                return True
        return False
    
    def if_mark_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            ('role-mark' in group.attributes.get('class', '') or \
             'role-scope' in group.attributes.get('class', '')) and \
            'graphics-object' in group.attributes.get('role', '') and \
            'mark container' in group.attributes.get('aria-roledescription', '') \
            and 'text' not in group.attributes.get('aria-roledescription', '')
            # and \
            # 'text' not in group.attributes.get('aria-roledescription', '')
    
            
        # if self.additional_configs['meta_data']['chart_type'] == 'bar':
        #     return group.tag == 'g' and \
        #         'role-mark' in group.attributes.get('class', '') and \
        #         'graphics-object' in group.attributes.get('role', '') and \
        #         'mark container' in group.attributes.get('aria-roledescription', '') and \
        #         'text' not in group.attributes.get('aria-roledescription', '')
        # elif self.additional_configs['meta_data']['chart_type'] == 'line':
        #     return group.tag == 'g' and \
        #         'mark-group role-scope' in group.attributes.get('class', '')
    
    
    # def if_legend_group(self, group: LayoutElement) -> bool:
    #     return group.tag == 'g' and \
    #         'role-legend' in group.attributes.get('class', '') and \
    #         'legend' in group.attributes.get('aria-roledescription', '')
                
    def if_mark_annotation_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'role-mark' in group.attributes.get('class', '') and \
            'graphics-object' in group.attributes.get('role', '') and \
            'mark container' in group.attributes.get('aria-roledescription', '') and \
            'text' in group.attributes.get('aria-roledescription', '')
    
    def if_axis_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'mark-group role-axis' in group.attributes.get('class', '') and \
            'axis' in group.attributes.get('aria-roledescription', '')

    def if_x_axis_group(self, group: LayoutElement) -> bool:
        return self.if_axis_group(group) and 'X-axis' in group.attributes.get('aria-label', '')

    def if_y_axis_group(self, group: LayoutElement) -> bool:
        return self.if_axis_group(group) and 'Y-axis' in group.attributes.get('aria-label', '')
    
    def if_axis_label_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'mark-text role-axis-label' == group.attributes.get('class', '')
    
    def if_legend_group(self, group: LayoutElement) -> bool:
        return group.tag == 'g' and \
            'role-legend' in group.attributes.get('class', '') and \
            'legend' in group.attributes.get('aria-roledescription', '')
    
    # def append_image(self, tree: LayoutElement, image_element: LayoutElement):
    #     tree.children.append(image_element)
        
    def parseTree(self, svg: str) -> dict:
        # 创建解析器
        parser = etree.XMLParser(remove_comments=True, remove_blank_text=True)
        # 将SVG字符串解析为XML树
        tree = etree.parse(StringIO(svg), parser)
        root = tree.getroot()
        # 递归解析节点
        return self._parse_node(root)

    def _parse_node(self, node) -> dict:
        # 创建基本节点信息
        result = {
            'tag': node.tag.split('}')[-1],  # 移除命名空间
            'attributes': dict(node.attrib),
            'children': []
        }
        
        # 如果节点有文本内容，添加到结果中
        if node.text and node.text.strip():
            result['text'] = node.text.strip()
            
        # 递归处理所有子节点
        for child in node:
            result['children'].append(self._parse_node(child))
        
        if result['tag'] == 'defs':
            self.defs = result
        return result

    def _traverse_elements_tree(self, element):
        """递归遍历元素树，识别并设置各种图表组件组"""
        flag_in_legend = False
        flag_in_mark_group = False
        # 如果是轴标签组，需要判断是属于x轴还是y轴
        if self.if_axis_label_group(element):
            if self.in_x_axis_flag:
                self.x_axis_label_group = element
            elif self.in_y_axis_flag:
                self.y_axis_label_group = element
        # 检查当前元素是否匹配任何特定组
        if self.if_legend_group(element) and not self.in_legend_flag:
            self.legend_group = element
            self.in_legend_flag = True
            flag_in_legend = True
            # print("legend_group: ", element.dump())
        elif self.if_mark_group(element) and not self.in_legend_flag and not self.in_mark_group_flag:
            # print("mark_group: ", element.dump())
            self.all_mark_groups.append(element)
            self.in_mark_group_flag = True
            flag_in_mark_group = True
        elif self.if_mark_annotation_group(element):
            self.mark_annotation_group = element
        elif self.if_x_axis_group(element):
            self.x_axis_group = element
            self.in_x_axis_flag = True
            if hasattr(element, 'children'):
                for child in element.children:
                    self._traverse_elements_tree(child)
            self.in_x_axis_flag = False
            return 
        elif self.if_y_axis_group(element):
            self.y_axis_group = element
            self.in_y_axis_flag = True
            if hasattr(element, 'children'):
                for child in element.children:
                    self._traverse_elements_tree(child)
            self.in_y_axis_flag = False
            return
        elif self.if_area_mark_group(element):
            self.area_mark_group = element
        # 递归处理所有子元素
        if hasattr(element, 'children'):
            for child in element.children:
                self._traverse_elements_tree(child)
        if flag_in_legend:
            self.in_legend_flag = False
        if flag_in_mark_group:
            self.in_mark_group_flag = False
        
    # def _bind_data_to_mark(self, element: LayoutElement):
    #     # "Unnamed: 1: 67; Label: 2; group: Lorem Ipsum 1"
    
    def extract_data_from_aria_label(self, aria_label: str):
        meta_data = self.additional_configs['meta_data']
        x_label = meta_data['x_label']
        y_label = meta_data['y_label']
        group_label = meta_data.get('group_label', '')
        # print("x_label: ", x_label)
        # print("y_label: ", y_label)
        # print("group_label: ", group_label)
        
        # print("aria_label: ", aria_label)
        group_value = None
        if x_label in aria_label:
            x_value = aria_label.split(x_label)[1].split(';')[0].split(':')[1].strip()
        if y_label in aria_label:
            y_value = aria_label.split(y_label)[1].split(';')[0].split(':')[1].strip()
        if group_label is not "" and group_label in aria_label:
            group_value = aria_label.split(group_label)[1].split(';')[0].split(':')[1].strip()
        
        # 从self.x_values中找到最相似的x_value
        res_x_value = None
        res_y_value = None
        res_group_value = None
        if x_value is not None:
            max_similarity = 0
            for true_x_value in self.x_values:
                similarity = get_text_similarity(x_value, true_x_value)
                if similarity > max_similarity:
                    max_similarity = similarity
                    res_x_value = true_x_value
        if group_value is not None:
            max_similarity = 0
            for true_group_value in self.group_values:
                similarity = get_text_similarity(group_value, true_group_value)
                if similarity > max_similarity:
                    max_similarity = similarity
                    res_group_value = true_group_value
                    
        return {
            'x_value': res_x_value,
            'y_value': y_value,
            'group_value': res_group_value
        }
    
    
    def _bind_data_to_mark(self, element: LayoutElement):
        aria_label = element.attributes.get('aria-label', '')
        if aria_label is not "":
            data = self.extract_data_from_aria_label(aria_label)
            self.mark_data_map[element] = data