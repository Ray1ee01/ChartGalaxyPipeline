# 抽象类
from abc import ABC, abstractmethod
from modules.chart_engine.template.vegalite_py.utils.element_tool.elements import *
from modules.chart_engine.template.vegalite_py.utils.element_tool.layout import *
from dataclasses import dataclass
from typing import List
import re

@dataclass
class Constraint:
    max_width: float
    max_height: float


class ReadabilityProcessor(ABC):
    def __init__(self):
        pass
    
    @abstractmethod
    def process(self):
        pass
    

class AxisReadabilityProcessor(ReadabilityProcessor):
    def __init__(self, axis: Axis):
        super().__init__()
        self.axis = axis
        
    def process(self):
        pass
    
    def avoid_label_overlap(self):
        for child in self.axis.children:
            print("child: ", child)
            if child.attributes.get("class", "") == "axis_label-group":
                grand_children = child.children
                for grand_child in grand_children:
                    grand_child._bounding_box = grand_child.get_bounding_box()
                grand_children_bounding_box = [child._bounding_box for child in grand_children]
                overlap_flag = False
                for i in range(len(grand_children)):
                    for j in range(i+1, len(grand_children)):
                        if grand_children_bounding_box[i].is_overlapping(grand_children_bounding_box[j]):
                            overlap_flag = True
                            break
                if overlap_flag:
                    # 调整label的角度
                    for grand_child in grand_children:
                        old_boundingbox = grand_child._bounding_box
                        if grand_child.axis_orient=="bottom":
                            reference_point = [grand_child._bounding_box.maxx, grand_child._bounding_box.miny]
                        elif grand_child.axis_orient=="top":
                            reference_point = [grand_child._bounding_box.maxx, grand_child._bounding_box.maxy]
                        elif grand_child.axis_orient=="left":
                            reference_point = [grand_child._bounding_box.maxx, grand_child._bounding_box.maxy]
                        elif grand_child.axis_orient=="right":
                            reference_point = [grand_child._bounding_box.minx, grand_child._bounding_box.miny]
                        grand_child.attributes["transform"] = f"rotate(-45,{reference_point[0]},{reference_point[1]}) " + grand_child.attributes.get("transform", "")
                        new_boundingbox = grand_child.get_bounding_box()
                        shift_x = 0
                        shift_y = 0

                        if grand_child.axis_orient=="bottom":
                            # 把max_x和原来的mid_x对齐
                            new_mid_x = new_boundingbox.minx+new_boundingbox.width/2
                            old_mid_x = old_boundingbox.minx+old_boundingbox.width/2
                            shift_x = old_mid_x - new_mid_x - new_boundingbox.width/2 + 5
                            shift_y = new_boundingbox.miny - old_boundingbox.miny
                        elif grand_child.axis_orient=="top":
                            # 把min_x和原来的mid_x对齐
                            new_mid_x = new_boundingbox.minx+new_boundingbox.width/2
                            old_mid_x = old_boundingbox.minx+old_boundingbox.width/2
                            shift_x = old_mid_x - new_mid_x - new_boundingbox.width/2
                            shift_y = new_boundingbox.maxy - old_boundingbox.maxy
                        elif grand_child.axis_orient=="left":
                            # 把max_y和原来的mid_y对齐
                            new_mid_y = new_boundingbox.miny+new_boundingbox.height/2
                            old_mid_y = old_boundingbox.miny+old_boundingbox.height/2
                            shift_y = old_mid_y - new_mid_y - new_boundingbox.height/2
                            shift_x = new_boundingbox.minx - old_boundingbox.minx
                        elif grand_child.axis_orient=="right":
                            # 把min_y和原来的mid_y对齐
                            new_mid_y = new_boundingbox.miny+new_boundingbox.height/2
                            old_mid_y = old_boundingbox.miny+old_boundingbox.height/2
                            shift_y = old_mid_y - new_mid_y - new_boundingbox.height/2
                            shift_x = new_boundingbox.maxx - old_boundingbox.maxx
                        grand_child.attributes["transform"] = f"translate({shift_x},{shift_y}) " + grand_child.attributes.get("transform", "")



def number_type_judge(number: str):
    """
    判断输入字符串 number 是哪种数值类型：
    1. 整数
    2. 浮点数（包括科学计数法表示的浮点数）

    :param number: 输入字符串 
    :return: 返回 "整数" 或 "浮点数" 或 "非法输入"
    """
    # 匹配整数的正则表达式
    int_pattern = r'^-?\d+$'
    # 匹配浮点数和科学计数法的正则表达式
    float_pattern = r'^-?(\d*\.\d+|\d+\.\d*|\d+)([eE][-+]?\d+)?$'

    # 判断是否是整数
    if re.match(int_pattern, number) and 'e' not in number.lower():
        return "int"
    # 判断是否是浮点数（包括科学计数法）
    elif re.match(float_pattern, number):
        return "float"
    else:
        return "invalid"

def special_number_judge(number: str):
    """
    判断输入字符串 number 是否是年份
    
    :param number: 输入字符串
    :return: 如果是年份返回 "year"，否则返回 "not_year"
    """
    # 匹配年份的正则表达式 - 1000-2999年
    year_pattern = r'^[12]\d{3}$'
    
    # 判断是否是年份
    if re.match(year_pattern, number):
        return "year"
    else:
        return "invalid"


def number_spliter(number: str):
    # 首先去除number中的逗号
    number = number.replace(",", "")
    # 然后从开始位置开始，找到第一个是数字的位置，这之前的部分是unit，这之后的部分是number
    unit = ""
    for i in range(len(number)):
        if number[i].isdigit():
            unit = number[:i]
            number = number[i:]
            break
    if unit == "":
        # 如果unit为空，则从结束位置开始，找到第一个是数字的位置，这之前的部分是unit，这之后的部分是number
        for i in range(len(number)-1, -1, -1):
            if number[i].isdigit():
                unit = number[i+1:]
                number = number[:i+1]
                break
    return number, unit

def apply_to_element(element: Text, new_content: str, new_font_size: float, reference_point: str):
    old_bounding_box = element.get_bounding_box()
    element.content = new_content
    element.attributes["font-size"] = str(new_font_size) + "px"
    new_bounding_box = element.get_bounding_box()
    shift_x = 0
    shift_y = 0
    if reference_point == "center":
        old_mid_x = old_bounding_box.minx + old_bounding_box.width/2
        old_mid_y = old_bounding_box.miny + old_bounding_box.height/2
        new_mid_x = new_bounding_box.minx + new_bounding_box.width/2
        new_mid_y = new_bounding_box.miny + new_bounding_box.height/2
        shift_x = old_mid_x - new_mid_x
        shift_y = old_mid_y - new_mid_y
    elif reference_point == "left":
        shift_x = old_bounding_box.minx - new_bounding_box.minx
        old_mid_y = old_bounding_box.miny + old_bounding_box.height/2
        new_mid_y = new_bounding_box.miny + new_bounding_box.height/2
        shift_y = old_mid_y - new_mid_y
    elif reference_point == "right":
        shift_x = old_bounding_box.maxx - new_bounding_box.maxx
        old_mid_y = old_bounding_box.miny + old_bounding_box.height/2
        new_mid_y = new_bounding_box.miny + new_bounding_box.height/2
        shift_y = old_mid_y - new_mid_y
    elif reference_point == "top":
        shift_y = old_bounding_box.miny - new_bounding_box.miny
        old_mid_x = old_bounding_box.minx + old_bounding_box.width/2
        new_mid_x = new_bounding_box.minx + new_bounding_box.width/2
        shift_x = old_mid_x - new_mid_x
    elif reference_point == "bottom":
        shift_y = old_bounding_box.maxy - new_bounding_box.maxy
        old_mid_x = old_bounding_box.minx + old_bounding_box.width/2
        new_mid_x = new_bounding_box.minx + new_bounding_box.width/2
        shift_x = old_mid_x - new_mid_x
    element.attributes["transform"] = f"translate({shift_x},{shift_y}) " + element.attributes.get("transform", "")


class NumberReadabilityProcessor(ReadabilityProcessor):
    def __init__(self, numbers: List[str], units: List[str], font_size: int, constraints: List[Constraint]):
        super().__init__()
        self.numbers = numbers
        self.units = units
        self.font_size = font_size
        self.constraints = constraints
    
    def process(self):
        min_font_size = self.font_size
        res_numbers = []
        res_units = []
        for number, unit, constraint in zip(self.numbers, self.units, self.constraints):
            new_number, new_unit, new_font_size = self.process_single(number, unit, self.font_size, constraint)
            if new_font_size < min_font_size:
                min_font_size = new_font_size
            res_numbers.append(new_number)
            res_units.append(new_unit)
        return res_numbers, res_units, min_font_size
    
    
    def process_year(self, number: str):
        return "'" + number[2:]
    
    def process_single(self, number: str, unit: str, font_size: int, constraint: Constraint):
        # 这里默认输入过来的number应该就去掉了逗号这种符号，只有数字和小数点
        number = number
        unit = unit
        try_text_element = Text(number+unit)
        try_text_element.attributes["font-size"] = font_size
        try_bounding_box = try_text_element.get_bounding_box()
        
        # 先处理height constraint, 因为如果高度有问题，需要调整字体大小
        height_ratio = 1
        if constraint.max_height != None:
            height_ratio = try_bounding_box.height / constraint.max_height
        new_font_size = font_size * height_ratio
        try_text_element.attributes["font-size"] = new_font_size
        try_bounding_box = try_text_element.get_bounding_box()
        
        if try_bounding_box.width <= constraint.max_width:
            return number, unit, new_font_size
        elif try_bounding_box.width > constraint.max_width:
            # print("try_bounding_box.width: ", try_bounding_box.width)
            # print("constraint.max_width: ", constraint.max_width)
            special_type = special_number_judge(number)
            if special_type == "year":
                new_number = self.process_year(number)
            else:
                # 如果宽度超出限制，则首先判断类型
                ratio = try_bounding_box.width / constraint.max_width
                cur_len = len(number)
                new_len = int(cur_len * ratio)
                value = float(number)
                # 根据值的大小和新的长度，判断使用xxxK, xxxM, xxxB, xxxT
                if value >= 1000000000:
                    new_number = f"{value/1000000000:.2f}B"
                elif value >= 1000000:
                    new_number = f"{value/1000000:.2f}M"
                elif value >= 1000:
                    new_number = f"{value/1000:.2f}K"
                else:
                    new_number = f"{value:.2f}"
            # print("new_number: ", new_number)
            try_text_element.content = new_number
            try_bounding_box = try_text_element.get_bounding_box()
            if try_bounding_box.width <= constraint.max_width:
                return new_number, unit, new_font_size
            else:
                # 如果还是超出，先尝试从new_number中去掉一位小数
                # 找到new_number的最后一位数字，因为最后一位有可能是B, M, K, T,所以需要找到第一个不是数字的位置
                last_digit_index = len(new_number) - 1
                while not new_number[last_digit_index].isdigit():
                    last_digit_index -= 1
                if last_digit_index == len(new_number) - 1:
                    # 如果最后一位是数字，则需要去掉最后一位
                    new_number = new_number[:-1]
                else:
                    post_fix = new_number[-1]
                    # 如果最后一位不是数字，则需要去掉最后一位
                    new_number = new_number[:last_digit_index]
                    new_number += post_fix
                try_text_element.content = new_number
                try_bounding_box = try_text_element.get_bounding_box()
                if try_bounding_box.width <= constraint.max_width:
                    return new_number, unit, new_font_size
                else:
                    # 如果还是超出，则需要调整字体大小
                    new_font_size = new_font_size * constraint.max_width / try_bounding_box.width
                    try_text_element.attributes["font-size"] = new_font_size
                    return new_number, unit, new_font_size



if __name__=="__main__":
    number = "1234567890"
    print(number_type_judge(number))
    print(int(number))
    number = "1234567890.1234567890"
    print(number_type_judge(number))
    print(float(number))
    number = "1234567890e-12"
    print(number_type_judge(number))
    print(float(number))
    number = "1234567890.1234567890e10"
    print(number_type_judge(number))
    print(float(number))
    number = ".11"
    print(number_type_judge(number))
    print(float(number))
    number = ""
    print(number_type_judge(number))
    print(float(number))
