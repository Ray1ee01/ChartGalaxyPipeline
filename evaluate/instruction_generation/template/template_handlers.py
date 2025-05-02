from typing import Tuple, Optional, List, Dict, Any
from template.base_generator import BaseGenerator
import os
import logging
import math # Add math import for closest value calculation
import random # Add random import for numerical distractor handling
from generate_choice import generate_numerical_distractors # Import moved to top

logger = logging.getLogger("InstructionGeneration.Template.TemplateHandlers")

# 添加格式化数值的辅助函数
def format_numeric_value(value):
    """根据数值类型格式化数值：整数保持不变，浮点数保留2位小数"""
    if value is None:
        return None
    
    try:
        # 检查是否是整数
        if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
            return int(value)
        else:
            # 浮点数保留2位小数
            return round(float(value), 2)
    except (ValueError, TypeError):
        # 如果无法转换为数值，返回原值
        return value

# 添加生成数值混淆项的辅助函数
def generate_formatted_distractors(value, count=4):
    """生成格式化的数值混淆项，整数不保留小数，浮点数保留2位小数"""
    if value is None:
        return None
    
    # 先格式化正确答案
    formatted_value = format_numeric_value(value)
    
    # 检查是否是整数
    is_integer = isinstance(formatted_value, int) or (isinstance(formatted_value, float) and formatted_value.is_integer())
    
    # 生成混淆项
    try:
        # 生成比原始数量更多的混淆项，以便有足够的不重复选项
        extra_count = count * 2
        distractors = generate_numerical_distractors(value, extra_count)
        
        # 格式化所有混淆项
        formatted_distractors = []
        for d in distractors:
            try:
                if is_integer:
                    # 如果答案是整数，确保混淆项也是整数
                    # 先转换为浮点数，然后四舍五入取整
                    d_float = float(d)
                    d_int = int(round(d_float))
                    formatted_distractors.append(d_int)
                else:
                    # 浮点数保留2位小数
                    formatted_distractors.append(format_numeric_value(d))
            except (ValueError, TypeError) as e:
                logger.debug(f"混淆项格式化错误: {d}, {e}")
                continue
        
        # 移除重复项
        unique_distractors = []
        for d in formatted_distractors:
            if d not in unique_distractors and d != formatted_value:
                unique_distractors.append(d)
        
        # 如果不重复的混淆项不足，再生成一些不同的值
        if len(unique_distractors) < count:
            # 基于原值生成更分散的值
            try:
                base = float(value)
                multipliers = [0.5, 1.5, 2.0, 2.5, 0.25, 0.75, 1.25, 1.75]
                for m in multipliers:
                    new_val = base * m
                    if is_integer:
                        new_val = int(round(new_val))
                    else:
                        new_val = format_numeric_value(new_val)
                    
                    if new_val not in unique_distractors and new_val != formatted_value:
                        unique_distractors.append(new_val)
                        if len(unique_distractors) >= count:
                            break
            except (ValueError, TypeError) as e:
                logger.debug(f"生成额外混淆项错误: {e}")
        
        # 如果仍然不足，随机生成一些整数值
        while len(unique_distractors) < count:
            if is_integer:
                # 对于整数，生成一些随机整数
                random_int = int(formatted_value) + random.randint(-10, 10)
                if random_int not in unique_distractors and random_int != formatted_value:
                    unique_distractors.append(random_int)
            else:
                # 对于浮点数，生成一些随机浮点数
                random_float = round(float(formatted_value) + random.uniform(-10, 10), 2)
                if random_float not in unique_distractors and random_float != formatted_value:
                    unique_distractors.append(random_float)
        
        # 取前count个不重复的混淆项
        return unique_distractors[:count]
    except Exception as e:
        logger.error(f"生成混淆项错误: {e}")
        # 发生错误时，回退到简单的随机数生成
        try:
            base_value = float(value)
            fallback_distractors = []
            for i in range(count):
                if is_integer:
                    fallback = int(base_value) + (i + 1) * 5
                else:
                    fallback = round(base_value + (i + 1) * 2.5, 2)
                fallback_distractors.append(fallback)
            return fallback_distractors
        except:
            # 如果连回退方案都失败，返回None
            return None

# 添加处理布尔值混淆项的辅助函数
def generate_boolean_choice_options(answer, count=4):
    """
    生成布尔值问题的多选项，将Yes/No扩展为count个选项
    
    Args:
        answer: 正确答案字符串，"Yes"或"No"
        count: 目标选项数量
        
    Returns:
        List[str]: 包含正确答案在内的混淆选项列表
    """
    # 确保答案是字符串格式
    answer = str(answer)
    
    # 直接使用Yes/No
    base_options = ["Yes", "No"]
    
    # 添加更多相关的选项
    extended_options = [
        "Cannot determine", 
        "They are equal", 
        "Data insufficient", 
        "Depends on context",
        "Not applicable",
        "Both are valid",
        "Neither is correct",
        "More information needed"
    ]
    
    # 构建最终选项列表：确保答案在内，再从其他选项中选择，凑够count个
    options = [answer]  # 先加入正确答案
    
    # 添加另一个 Yes/No 选项
    other_base = "No" if answer.lower() == "yes" else "Yes"
    options.append(other_base)
    
    # 从扩展选项中随机选择，组成共count个选项
    needed_count = count - len(options)
    if needed_count > 0:
        remaining_options = random.sample(extended_options, min(needed_count, len(extended_options)))
        options.extend(remaining_options)
    
    # 确保选项数量等于count（可能没有那么多扩展选项）
    while len(options) < count and extended_options:
        extra_option = f"{random.choice(['Alternative', 'Option', 'Choice'])} {len(options) + 1}"
        if extra_option not in options:
            options.append(extra_option)
    
    # 混淆选项是除答案外的所有选项
    confusion = [opt for opt in options if opt != answer]
    
    return confusion

class TemplateHandlers:
    def __init__(self, base_generator: BaseGenerator):
        self.generator = base_generator
        # Add a mapping to call handlers dynamically if needed,
        # otherwise, assume they are called by name lookup.
        self.handler_map = {
            "template_1": self.handle_template_1,
            "template_2": self.handle_template_2,
            "template_3": self.handle_template_3,
            "template_4": self.handle_template_4,
            "template_5": self.handle_template_5,
            "template_6": self.handle_template_6,
            "template_7": self.handle_template_7,
            "template_8": self.handle_template_8,
            "template_9": self.handle_template_9,
            "template_10": self.handle_template_10,
            "template_11": self.handle_template_11,
            "template_12": self.handle_template_12,
            "template_13": self.handle_template_13,
            "template_14": self.handle_template_14,
            "template_15": self.handle_template_15,
            "template_16": self.handle_template_16,
            "template_17": self.handle_template_17,
            "template_18": self.handle_template_18,
            "template_19": self.handle_template_19,
            "template_20": self.handle_template_20,
            "template_21": self.handle_template_21,
            "template_22": self.handle_template_22,
            "template_23": self.handle_template_23,
            "template_24": self.handle_template_24,
            "template_25": self.handle_template_25,
            "template_26": self.handle_template_26,
            "template_27": self.handle_template_27,
            "template_28": self.handle_template_28,
            "template_29": self.handle_template_29,
            "template_30": self.handle_template_30,
            "template_31": self.handle_template_31,
            "template_32": self.handle_template_32,
            "template_33": self.handle_template_33,
            "template_34": self.handle_template_34,
            "template_35": self.handle_template_35,
            "template_36": self.handle_template_36,
            "template_37": self.handle_template_37,
            "template_38": self.handle_template_38,
            "template_39": self.handle_template_39,
            "template_40": self.handle_template_40,
            "template_41": self.handle_template_41,
            "template_42": self.handle_template_42,
            "template_43": self.handle_template_43,
            "template_44": self.handle_template_44,
            "template_45": self.handle_template_45,
            "template_46": self.handle_template_46,
            "template_47": self.handle_template_47,
            "template_48": self.handle_template_48,
            "template_49": self.handle_template_49,
            "template_50": self.handle_template_50,
            "template_51": self.handle_template_51,
            "template_52": self.handle_template_52,
            "template_53": self.handle_template_53,
            "template_54": self.handle_template_54,
            "template_55": self.handle_template_55,
            "template_56": self.handle_template_56,
            "template_57": self.handle_template_57,
            "template_58": self.handle_template_58,
            "template_59": self.handle_template_59,
        }
        
    def _handle_basic_calculation(self, template: str, calc_type: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """
        处理基础计算模板
        
        Args:
            template: 模板字符串
            calc_type: 计算类型 ('sum', 'avg', 'median', 'max', 'min', 'max_min_diff', 'max_second_max_diff')
            
        Returns:
            Tuple[str, float, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None
            
        placeholders, _, _ = self.generator.get_common_placeholders()
        question = self.generator.replace_placeholders(template, placeholders)
        
        result = None
        if calc_type == 'sum':
            result = self.generator.get_sum(y_label)
        elif calc_type == 'avg':
            result = self.generator.get_average(y_label)
        elif calc_type == 'median':
            result = self.generator.get_median(y_label)
        elif calc_type == 'max':
            result = self.generator.get_max(y_label)
        elif calc_type == 'min':
            result = self.generator.get_min(y_label)
        elif calc_type == 'max_min_diff':
            # 最高和最低差值
            max_y = self.generator.get_max(y_label)
            min_y = self.generator.get_min(y_label)
            if max_y is not None and min_y is not None:
                result = max_y - min_y
        elif calc_type == 'max_second_max_diff':
            # 最高和次高差值
            if self.generator.df is not None and y_label in self.generator.df.columns:
                y_values = sorted(self.generator.df[y_label].unique(), reverse=True)
                if len(y_values) >= 2:
                    # Ensure values are numeric before subtraction
                    try:
                        val1 = float(y_values[0])
                        val2 = float(y_values[1])
                        result = val1 - val2
                    except (ValueError, TypeError):
                        result = None # Handle non-numeric cases

        # 格式化结果
        formatted_result = format_numeric_value(result)
        
        # 生成混淆选项
        confusion = None
        if result is not None:
            confusion = generate_formatted_distractors(result)
                
        return question, formatted_result, confusion, None
    
    def _handle_difference(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """
        处理差值类模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
            
        Returns:
            Tuple[str, float, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')
        
        legend_value = None
        if with_legend:
            placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
            if not legend_values or not x_ticks:
                return None, None, None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not x_ticks:
            return None, None, None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        difference = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
        
        # 格式化结果
        formatted_difference = format_numeric_value(difference)
        
        # 生成混淆选项
        confusion = None
        if difference is not None:
            confusion = generate_formatted_distractors(difference)

        return question, formatted_difference, confusion, None
    
    def _handle_legend_calculation(self, template: str, calc_type: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """
        处理图例计算模板
        
        Args:
            template: 模板字符串
            calc_type: 计算类型 ('sum', 'avg', 'max', 'min', etc.)
            
        Returns:
            Tuple[str, float, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')
                    
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
        if not legend_values:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict = self.generator.get_filter_dict(legend_value=legend_values[0])
        
        result = None
        if calc_type == 'sum':
            result = self.generator.get_sum(y_label, filter_dict)
        elif calc_type == 'avg':
            result = self.generator.get_average(y_label, filter_dict)
        elif calc_type == 'max':
            result = self.generator.get_max(y_label, filter_dict)
        elif calc_type == 'min':
            result = self.generator.get_min(y_label, filter_dict)
        elif calc_type == 'median':
            result = self.generator.get_median(y_label, filter_dict)

        # 格式化结果
        formatted_result = format_numeric_value(result)

        # 生成混淆选项
        confusion = None
        if result is not None:
            confusion = generate_formatted_distractors(result)

        return question, formatted_result, confusion, None
    
    def _handle_threshold_count(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """
        处理阈值计数模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
            
        Returns:
            Tuple[str, int, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        
        legend_value = None
        if with_legend:
            placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1, use_threshold=True)
            if not legend_values:
                return None, None, None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, _ = self.generator.get_common_placeholders(use_threshold=True)
        
        threshold = float(placeholders["N"])
        if threshold is None:
            return None, None, None, None
                    
        question = self.generator.replace_placeholders(template, placeholders)
        
        # 计算有多少个x值的y值大于阈值
        count = 0
        x_values = self.generator.get_column_values(x_label)
        
        for x_val in x_values:
            if with_legend:
                val_filter = self.generator.get_filter_dict(x_val, legend_value)
            else:
                val_filter = self.generator.get_filter_dict(x_val)
                
            y_val = self.generator.get_value(y_label, val_filter)
            if y_val is not None and y_val > threshold:
                count += 1
        
        # 生成混淆选项 (count是整数，不需要额外格式化)
        confusion = generate_formatted_distractors(count)
                
        return question, count, confusion, None
    
    def _handle_comparison_question(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """
        处理比较问题模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
            
        Returns:
            Tuple[str, str, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')

        legend_value = None
        if with_legend:
            placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
            if not legend_values:
                return None, None, None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not x_ticks:
            return None, None, None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None:
            try: # Ensure values are comparable
                is_less = float(val1) < float(val2)
                answer = "Yes" if is_less else "No"

                # 为布尔答案创建混淆项，Yes/No只有两个选项
                confusion = ["Yes", "No"]
                confusion.remove(answer)  # 移除正确答案

                return question, answer, confusion, None
            except (ValueError, TypeError):
                 logger.debug(f"无法比较非数值: {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
    
    def _handle_ratio(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """
        处理比率模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
            
        Returns:
            Tuple[str, float, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')

        legend_value = None
        if with_legend:
            placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
            if not legend_values:
                return None, None, None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not x_ticks:
            return None, None, None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None:
            try:
                float_val1 = float(val1)
                float_val2 = float(val2)
                if float_val2 != 0:
                    ratio = float_val1 / float_val2
                    
                    # 格式化结果
                    formatted_ratio = format_numeric_value(ratio)

                    # 生成混淆选项
                    confusion = generate_formatted_distractors(ratio)

                    return question, formatted_ratio, confusion, None
                else:
                    # Handle division by zero
                    logger.debug("Division by zero in ratio calculation.")
                    return None, None, None, None
            except (ValueError, TypeError):
                 logger.debug(f"无法计算非数值的比率: {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
    
    def _handle_extreme_value_x(self, template: str, extreme_type: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """
        处理极值对应的X值模板
        
        Args:
            template: 模板字符串
            extreme_type: 'max'或'min'
            with_legend: 是否带图例
            
        Returns:
            Tuple[str, str, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        legend_value = None
        if with_legend:
            placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
            if not legend_values:
                return None, None, None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, _ = self.generator.get_common_placeholders(legend_num=1)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        extreme_x = self.generator.get_extreme_value_x(extreme_type, legend_value)
        
        # 为文本答案创建混淆项，获取所有可能的x值，然后排除正确答案
        x_label = self.generator.get_column_by_role('x')
        confusion = None
        if x_label and extreme_x:
            all_x_values = self.generator.get_column_values(x_label)
            if all_x_values:
                # 确保类型一致性
                try:
                    str_extreme_x = str(extreme_x)
                    confusion = [str(x) for x in all_x_values if str(x) != str_extreme_x]
                except Exception:
                    confusion = [x for x in all_x_values if x != extreme_x]

                # 最多选择4个混淆项
                if len(confusion) > 4:
                    confusion = random.sample(confusion, 4)
                # 如果混淆项不足4个，可以添加一些随机的变体
                elif len(confusion) < 4:
                    # 尝试添加一些变体
                    original_len = len(confusion)
                    for i in range(4 - original_len):
                        if confusion:  # 确保有至少一个元素可以变形
                            variant = str(confusion[i % original_len]) + " (var)"
                            confusion.append(variant)
        
        return question, extreme_x, confusion, None
    
    def _handle_extremes_difference(self, template: str, first_rank: int, second_rank: int) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """
        处理极值差值模板的通用方法
        
        Args:
            template: 模板字符串
            first_rank: 第一个值的排名（0为最高，1为第二高，-1为最低）
            second_rank: 第二个值的排名
            
        Returns:
            Tuple[str, float, list, str]: (问题, 答案, 混淆选项, 图像)
        """
        y_label = self.generator.get_column_by_role('y')
        
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
        if not legend_values:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict = self.generator.get_filter_dict(legend_value=legend_values[0])
        
        val1 = self.generator.get_nth_highest_value(y_label, first_rank, filter_dict)
        val2 = self.generator.get_nth_highest_value(y_label, second_rank, filter_dict)
        
        if val1 is not None and val2 is not None:
            try:
                difference = float(val1) - float(val2)
                
                # 格式化结果
                formatted_difference = format_numeric_value(difference)

                # 生成混淆选项
                confusion = generate_formatted_distractors(difference)

                return question, formatted_difference, confusion, None
            except (ValueError, TypeError):
                 logger.debug(f"无法计算极值差值 (非数值): {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
        
    def handle_template_1(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the sum of <Y label> ? """
        return self._handle_basic_calculation(template, 'sum')
    
    def handle_template_2(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the <Y label> in <ithx tick> and <jthx tick> ? """
        return self._handle_difference(template)
    
    def handle_template_3(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the average <Y label> per <singular form of X label> ? """
        return self._handle_basic_calculation(template, 'avg')
    
    def handle_template_4(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the median <Y label> ? """
        return self._handle_basic_calculation(template, 'median')
    
    def handle_template_5(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the total <Y label> of/in <legend label> in the graph? """
        return self._handle_legend_calculation(template, 'sum')
    
    def handle_template_6(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the <Y label> of/in <legend label> in <ithx tick> and that in <jthx tick> ? """
        return self._handle_difference(template, with_legend=True)
    
    def handle_template_7(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the <Y label> of/in <legend label1> in <ithx tick>
        and the <Y label> of/in <legend label2> in <jthx tick> ? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        
        if not group_label:
            return None, None, None, None
        
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=2)
        if len(legend_values) < 2 or not x_ticks:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_values[1])
        
        difference = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
        
        # 生成混淆选项
        confusion = None
        if difference is not None:
            try:
                float_difference = float(difference)
                confusion = generate_numerical_distractors(float_difference, 3)
            except (ValueError, TypeError):
                logger.debug(f"无法为 template 7 差值结果生成混淆选项: {difference}")

        return question, difference, confusion, None
    
    def handle_template_8(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the average <Y label> of/in <legend label> per <singular form of X label>? """
        return self._handle_legend_calculation(template, 'avg')
    
    def handle_template_9(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ 和 10 没区别 """
        return None, None, None, None
    
    def handle_template_10(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the <Y label> of/in <legend label1> and <Y label>
        of/in <legend label2> in <ithx tick> ? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        
        if not group_label:
            return None, None, None, None
        
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=1)
        if len(legend_values) < 2 or not x_ticks:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[0], legend_values[1])
        
        difference = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
        
        # 生成混淆选项
        confusion = None
        if difference is not None:
            try:
                float_difference = float(difference)
                confusion = generate_numerical_distractors(float_difference, 3)
            except (ValueError, TypeError):
                logger.debug(f"无法为 template 10 差值结果生成混淆选项: {difference}")

        return question, difference, confusion, None
    
    def handle_template_11(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ In how many <plural form of X label>, is the <Y label> greater than <N> units ? """
        return self._handle_threshold_count(template)
    
    def handle_template_12(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the ratio of the <Y label> in <ithx tick> to that in <jthx tick> ? """
        return self._handle_ratio(template)
    
    def handle_template_13(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the <Y label> in <ithx tick> less than that in <jthx tick> ? """
        return self._handle_comparison_question(template)
    
    def handle_template_14(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ In how many <plural form of X label>, is the <Y label> of/in <legend label> greater than <N> <units> ? """
        return self._handle_threshold_count(template, with_legend=True)
    
    def handle_template_15(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the ratio of the <Y label> of/in <legend label> in <ithx tick> to that in <jthx tick> ? """
        return self._handle_ratio(template, with_legend=True)
    
    def handle_template_16(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the <Y label> of/in <legend label> in <ithx tick> less than that in <jthx tick> ? """
        return self._handle_comparison_question(template, with_legend=True)
    
    def handle_template_17(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the difference between the <Y label> in <ithx tick> and <jthx tick> greater than
        he difference between any two <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if not x_ticks:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1])
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None:
            selected_diff = abs(float(val1) - float(val2))
            
            # 计算所有可能的差值
            max_diff = 0
            x_values = self.generator.get_column_values(x_label)
            
            for i in range(len(x_values)):
                for j in range(i+1, len(x_values)):
                    filter_i = self.generator.get_filter_dict(x_values[i])
                    filter_j = self.generator.get_filter_dict(x_values[j])
                    
                    val_i = self.generator.get_value(y_label, filter_i)
                    val_j = self.generator.get_value(y_label, filter_j)
                    
                    if val_i is not None and val_j is not None:
                        diff = abs(float(val_i) - float(val_j))
                        max_diff = max(max_diff, diff)
            
            is_greatest = selected_diff >= max_diff
            answer = "Yes" if is_greatest else "No"
            
            # 为布尔答案创建混淆项
            confusion = ["Yes", "No"]
            confusion.remove(answer)
            
            return question, answer, confusion, None
            
        return None, None, None, None
    
    def handle_template_18(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the highest and the second highest <Y label> ? """
        return self._handle_basic_calculation(template, 'max_second_max_diff')
    
    def handle_template_19(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """Is the sum of the <Y label> of/in <legend label1> in <ithx tick> and <jthx tick>
        greater than the maximum <Y label> of/in <legend label2> across all <plural form of X label> ?"""
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=2)
        if len(legend_values) < 2 or not x_ticks:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_values[0])
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        max_val = self.generator.get_max(y_label, 
                                        self.generator.get_filter_dict(legend_value=legend_values[1]))
        
        if val1 is not None and val2 is not None and max_val is not None:
            try:
                sum_vals = float(val1) + float(val2)
                is_greater = sum_vals > float(max_val) # Ensure max_val is float too
                answer = "Yes" if is_greater else "No"

                # 为布尔答案创建混淆项
                confusion = ["Yes", "No"]
                confusion.remove(answer)

                return question, answer, confusion, None
            except (ValueError, TypeError):
                 logger.debug(f"无法比较 template 19 (非数值): {val1}, {val2}, {max_val}")
                 return None, None, None, None

        return None, None, None, None
    
    def handle_template_20(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """Is it the case that in every <singular form of X label>, the sum of the <Y label>
        of/in <legend label1> and <legend label2> is greater than the sum of <Y label> of <legend label3> and <Y label> of <legend label4> ?"""
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=4)
        if len(legend_values) < 4:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            filter_dict3 = self.generator.get_filter_dict(x_val, legend_values[2])
            filter_dict4 = self.generator.get_filter_dict(x_val, legend_values[3])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            val3 = self.generator.get_value(y_label, filter_dict3)
            val4 = self.generator.get_value(y_label, filter_dict4)
            
            if all(v is not None for v in [val1, val2, val3, val4]):
                try:
                    sum1 = float(val1) + float(val2)
                    sum2 = float(val3) + float(val4)
                    return sum1 > sum2
                except (ValueError, TypeError):
                    return False # Treat non-numeric comparison as false
            return False
        
        condition_met = self.generator.check_condition_for_all_x(check_condition)
        answer = "Yes" if condition_met else "No"
        
        # 为布尔答案创建混淆项
        confusion = ["Yes", "No"]
        confusion.remove(answer)
        
        return question, answer, confusion, None
    
    def handle_template_21(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the sum of the <Y label> in <ithx tick> and <jthx tick> greater than the
        maximum <Y label> across all <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if not x_ticks:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1])
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        max_y = self.generator.get_max(y_label)
        
        if val1 is not None and val2 is not None and max_y is not None:
            try:
                sum_vals = float(val1) + float(val2)
                is_greater = sum_vals > float(max_y) # Ensure max_y is float
                answer = "Yes" if is_greater else "No"

                # 为布尔答案创建混淆项
                confusion = ["Yes", "No"]
                confusion.remove(answer)

                return question, answer, confusion, None
            except (ValueError, TypeError):
                logger.debug(f"无法比较 template 21 (非数值): {val1}, {val2}, {max_y}")
                return None, None, None, None

        return None, None, None, None
    
    def handle_template_22(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the highest and the lowest <Y label> ? """
        return self._handle_basic_calculation(template, 'max_min_diff')
    
    def handle_template_23(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ In how many <plural form of X label>, is the <Y label> of/in <legend label> greater
        than the average <Y label> of/in <legend label> across all <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        group_label = self.generator.get_column_by_role('group')
        
        if not y_label or not x_label or not group_label:
            return None, None, None, None
            
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
        if not legend_values:
            return None, None, None, None
            
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict = self.generator.get_filter_dict(legend_value=legend_values[0])
        avg_y = self.generator.get_average(y_label, filter_dict)
        
        if avg_y is None:
            return None, None, None, None
            
        try:
             float_avg_y = float(avg_y)
        except (ValueError, TypeError):
             logger.warning(f"Template 23: Average Y value {avg_y} is not numeric.")
             return None, None, None, None
            
        count = 0
        x_values = self.generator.get_column_values(x_label)
        
        for x_val in x_values:
            val_filter = self.generator.get_filter_dict(x_val, legend_values[0])
            y_val = self.generator.get_value(y_label, val_filter)
            if y_val is not None:
                try:
                    if float(y_val) > float_avg_y:
                        count += 1
                except (ValueError, TypeError):
                    continue # Skip non-numeric y_val
        
        # 生成混淆选项
        confusion = generate_numerical_distractors(count, 3)
                
        return question, count, confusion, None
    
    def handle_template_24(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the difference between the <Y label> of <legend label1> in <ithx tick> and <jthx tick> greater than
        the difference between the <Y label> of <legend label2> in <ithx tick> and <jthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        
        if not group_label:
            return None, None, None, None
            
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=2)
        if len(legend_values) < 2 or len(x_ticks) < 2:
            return None, None, None, None
            
        question = self.generator.replace_placeholders(template, placeholders)
        
        # 第一个图例在两个刻度上的差值
        filter_dict1_ith = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict1_jth = self.generator.get_filter_dict(x_ticks[1], legend_values[0])
        
        val1_ith = self.generator.get_value(y_label, filter_dict1_ith)
        val1_jth = self.generator.get_value(y_label, filter_dict1_jth)
        
        # 第二个图例在两个刻度上的差值
        filter_dict2_ith = self.generator.get_filter_dict(x_ticks[0], legend_values[1])
        filter_dict2_jth = self.generator.get_filter_dict(x_ticks[1], legend_values[1])
        
        val2_ith = self.generator.get_value(y_label, filter_dict2_ith)
        val2_jth = self.generator.get_value(y_label, filter_dict2_jth)
        
        if all(v is not None for v in [val1_ith, val1_jth, val2_ith, val2_jth]):
            try:
                diff1 = abs(float(val1_ith) - float(val1_jth))
                diff2 = abs(float(val2_ith) - float(val2_jth))

                is_greater = diff1 > diff2
                answer = "Yes" if is_greater else "No"

                # 为布尔答案创建混淆项
                confusion = ["Yes", "No"]
                confusion.remove(answer)

                return question, answer, confusion, None
            except (ValueError, TypeError):
                 logger.debug(f"无法比较 template 24 差值 (非数值)")
                 return None, None, None, None

        return None, None, None, None
    
    def handle_template_25(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the highest and second highest <Y label> of <legend label>? """
        # 使用通用方法处理极值差值：0为最高，1为次高
        return self._handle_extremes_difference(template, 0, 1)
    
    def handle_template_26(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between the highest and lowest <Y label> of <legend label>? """
        # 使用通用方法处理极值差值：0为最高，-1为最低
        return self._handle_extremes_difference(template, 0, -1)
    
    def handle_template_27(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ In how many <plural form of X label> is the <Y label> of <legend label> greater than 
        the average <Y label> of <legend label> across all <plural form of X label>? """
        # 这个与template_23基本相同，可以复用代码
        return self.handle_template_23(template)
    
    def handle_template_28(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is it the case that in every <singular form of X label>, the sum of the <Y label> of/in
        <legend label1> and <legend label2> is greater than the <Y label> of/in <legend label3> ? """
        y_label = self.generator.get_column_by_role('y')
        
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=3)
        if len(legend_values) < 3:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            filter_dict3 = self.generator.get_filter_dict(x_val, legend_values[2])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            val3 = self.generator.get_value(y_label, filter_dict3)
            
            if all(v is not None for v in [val1, val2, val3]):
                try:
                    sum12 = float(val1) + float(val2)
                    return sum12 > float(val3)
                except (ValueError, TypeError):
                    return False # Treat non-numeric comparison as false
            return False
            
        condition_met = self.generator.check_condition_for_all_x(check_condition)
        answer = "Yes" if condition_met else "No"
        
        # 为布尔答案创建混淆项
        confusion = ["Yes", "No"]
        confusion.remove(answer)
        
        return question, answer, confusion, None
    
    def handle_template_29(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the <Y label> of/in <legend label1> strictly greater than the <Y label> of/in
        <legend label2> over the <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=2)
        if len(legend_values) < 2:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            
            if val1 is not None and val2 is not None:
                try:
                    return float(val1) > float(val2)
                except (ValueError, TypeError):
                     return False # Treat non-numeric comparison as false
            return False
            
        strictly_greater = self.generator.check_condition_for_all_x(check_condition)
        answer = "Yes" if strictly_greater else "No"
        
        # 为布尔答案创建混淆项
        confusion = ["Yes", "No"]
        confusion.remove(answer)
        
        return question, answer, confusion, None
    
    def handle_template_30(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Is the <Y label> of/in <legend label1> strictly less than the <Y label> of/in
        <legend label2> over the <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')

        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=2)
        if len(legend_values) < 2:
            return None, None, None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            
            if val1 is not None and val2 is not None:
                try:
                    return float(val1) < float(val2)
                except (ValueError, TypeError):
                    return False # Treat non-numeric comparison as false
            return False
            
        strictly_less = self.generator.check_condition_for_all_x(check_condition)
        answer = "Yes" if strictly_less else "No"
        
        # 为布尔答案创建混淆项
        confusion = ["Yes", "No"]
        confusion.remove(answer)
        
        return question, answer, confusion, None
    
    def handle_template_31(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Does the <Y label> of <legend label> monotonically increase over the
        <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        group_label = self.generator.get_column_by_role('group')
        
        x_is_temporal = self.generator.is_temporal_column(x_label)

        if x_is_temporal:
            if group_label:
                placeholders, legend_values, _ = self.generator.get_common_placeholders()
                if not legend_values:
                    return None, None, None, None
                
                question = self.generator.replace_placeholders(template, placeholders)
                
                filtered_df = self.generator.get_filtered_data(
                    self.generator.get_filter_dict(legend_value=legend_values[0]))
                
                if not filtered_df.empty and y_label in filtered_df.columns:
                    is_monotonic = True
                    prev_y = None
                    
                    for idx, row in filtered_df.iterrows():
                        curr_y = row[y_label]
                        
                        if prev_y is not None and curr_y <= prev_y:
                            is_monotonic = False
                            break
                        
                        prev_y = curr_y
                    
                    answer = "Yes" if is_monotonic else "No"
                    
                    # 为布尔答案创建混淆项
                    confusion = ["Yes", "No"]
                    confusion.remove(answer)
                    
                    return question, answer, confusion, None
            else:
                modified_template = template.replace(" of <legend label>", "")
                
                placeholders, _, _ = self.generator.get_common_placeholders()
                question = self.generator.replace_placeholders(modified_template, placeholders)
                
                if self.generator.df is not None and y_label in self.generator.df.columns:
                    is_monotonic = True
                    prev_y = None
                    
                    for idx, row in self.generator.df.iterrows():
                        curr_y = row[y_label]
                        
                        if prev_y is not None and curr_y <= prev_y:
                            is_monotonic = False
                            break
                        
                        prev_y = curr_y
                    
                    answer = "Yes" if is_monotonic else "No"
                    
                    # 为布尔答案创建混淆项
                    confusion = ["Yes", "No"]
                    confusion.remove(answer)
                    
                    return question, answer, confusion, None
                    
        return None, None, None, None
    
    def handle_template_32(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ What is the difference between two consecutive major ticks on the Y-axis ? """
        return None, None, None, None # NOTE 不太容易标准化
    
    def handle_template_33(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ Across all <plural form of X label> , what is the maximum <Y label> ? """
        return self._handle_basic_calculation(template, 'max')
    
    def handle_template_34(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ Across all <plural form of X label> , what is the minimum <Y label> ? """
        return self._handle_basic_calculation(template, 'min')
    
    def handle_template_35(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ In which <X label> was the <Y label> maximum ? """
        return self._handle_extreme_value_x(template, 'max')
    
    def handle_template_36(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """  In which <X label> was the <Y label> minimum ? """
        return self._handle_extreme_value_x(template, 'min')
    
    def handle_template_37(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ Across all <plural form of X label> , what is the maximum <Y label> of/in <legend
        label> ? """
        return self._handle_legend_calculation(template, 'max')
    
    def handle_template_38(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[str]]:
        """ Across all <plural form of X label> , what is the minimum <Y label> of/in <legend
        label> ? """
        return self._handle_legend_calculation(template, 'min')
    
    def handle_template_39(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ In which <singular form of X label> was the <Y label> of/in <legend label> maximum ? """
        return self._handle_extreme_value_x(template, 'max', with_legend=True)
    
    def handle_template_40(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ In which <singular form of X label> was the <Y label> of/in <legend label> minimum ? """
        return self._handle_extreme_value_x(template, 'min', with_legend=True)
    
    def handle_template_41(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ What is the position of the title in this infographic? """
        info = self.generator.get_info()
        if not info or "title_to_chart" not in info:
            return None, None, None, None
            
        position_map = {
            "L": "left",
            "R": "right",
            "T": "top-center",
            "B": "bottom-center",
            "TL": "top-left",
            "TR": "top-right",
            "BL": "bottom-left",
            "BR": "bottom-right",
            "C": "center"
        }
        
        position_code = info["title_to_chart"]
        position = position_map.get(position_code)
        
        if position:
            # 为文本答案创建混淆项
            all_positions = list(position_map.values())
            confusion = [pos for pos in all_positions if pos != position]
            if len(confusion) > 4:
                confusion = random.sample(confusion, 4)
                
            return template, position, confusion, None
            
        return None, None, None, None
    
    def handle_template_42(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ What is the position of the main image in this infographic? """
        info = self.generator.get_info()
        if not info or "image_to_chart" not in info:
            return None, None, None, None
            
        position_map = {
            "L": "left",
            "R": "right",
            "T": "top-center",
            "B": "bottom-center",
            "TL": "top-left",
            "TR": "top-right",
            "BL": "bottom-left",
            "BR": "bottom-right",
            "C": "center"
        }
        
        position_code = info["image_to_chart"]
        position = position_map.get(position_code)
        
        if position:
            # 为文本答案创建混淆项
            all_positions = list(position_map.values())
            confusion = [pos for pos in all_positions if pos != position]
            if len(confusion) > 4:
                confusion = random.sample(confusion, 4)
                
            return template, position, confusion, None
            
        return None, None, None, None
    
    def handle_template_43(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ What is the alignment style of the main text content? """
        info = self.generator.get_info()
        if not info or "text_align" not in info:
            return None, None, None, None
            
        text_align = info["text_align"].lower()
        
        alignment_map = {
            "left": "left-aligned",
            "right": "right-aligned",
            "center": "center-aligned",
            "middle": "center-aligned",
            "justified": "justified"
        }
        
        alignment = alignment_map.get(text_align)
        
        
        if alignment:
            # 为文本答案创建混淆项
            all_alignments = list(set(alignment_map.values()))
            confusion = [align for align in all_alignments if align != alignment]
            
            return template, alignment, confusion, None
            
        return None, None, None, None
    
    def handle_template_44(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ How many icons or images are present in this infographic? """
        svg_path = self.generator.get_svg_path()
        if not svg_path or not os.path.exists(svg_path):
            return None, None, None, None
            
        try:
            with open(svg_path, 'r', encoding='utf-8') as f:
                svg_content = f.read()
                
            image_count = svg_content.count('<image')
            
            # 生成混淆选项
            confusion = generate_numerical_distractors(image_count, 3)
            print(confusion)
            
            return template, image_count, confusion, None
            
        except Exception as e:
            logger.error(f"读取SVG文件错误: {e}")
            return None, None, None, None
    
    def handle_template_45(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Which data field determines the color encoding for the chart elements? """
        info = self.generator.get_requirements()
        if not info or "required_fields_colors" not in info or not info["required_fields_colors"]:
            return None, None, None, None
    
        color_roles = info["required_fields_colors"]
        color_columns = []
        for role in color_roles:
            column_name = self.generator.get_column_by_role(role)
            if column_name:
                color_columns.append(column_name)
        
        if not color_columns:
             # This case might occur if the roles exist but don't map to current data columns
            return None, None, None, None
    
        # Join multiple columns if present, although often it might be just one
        answer = ", ".join(color_columns) 
        
        # 获取所有可能的列名作为混淆项
        all_columns = set()
        for role in ["x", "y", "group", "size", "text"]:
            col = self.generator.get_column_by_role(role)
            if col and col not in color_columns:
                all_columns.add(col)
        
        confusion = list(all_columns)
        if len(confusion) > 3:
            confusion = random.sample(confusion, 3)
        
        return template, answer, confusion, None
    
    def handle_template_46(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Which data field is used for the icon encoding in the chart? """
        info = self.generator.get_requirements() # Changed from get_info() based on T45
        if not info or "required_fields_icons" not in info or not info["required_fields_icons"]:
            # If no specific field is designated for icons, return None or "none"
            answer = "none"
            # Generate confusion from potential roles/columns if possible
            possible_confusion = ["category", "value", "group", self.generator.get_column_by_role('x'), self.generator.get_column_by_role('y')]
            confusion = random.sample([c for c in possible_confusion if c and c != answer], min(3, len([c for c in possible_confusion if c and c != answer])))
            return template, answer, confusion, None

        icon_roles = info["required_fields_icons"]
        icon_columns = []
        for role in icon_roles:
            column_name = self.generator.get_column_by_role(role)
            if column_name:
                icon_columns.append(column_name)
    
        if not icon_columns:
             # Role specified but no matching column found in data
            return None, None, None, None
    
        answer = ", ".join(icon_columns)
        
        # 获取所有可能的列名作为混淆项
        all_columns = set()
        for role in ["x", "y", "group", "size", "text"]:
            col = self.generator.get_column_by_role(role)
            if col and col not in icon_columns:
                all_columns.add(col)
        
        confusion = list(all_columns)
        if len(confusion) > 3:
            confusion = random.sample(confusion, 3)
        
        return template, answer, confusion, None
    
    def handle_template_47(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ What types of charts are included in this infographic? """
        info = self.generator.get_info()
        if not info or "chart_type" not in info:
            return None, None, None, None
            
        chart_type = info["chart_type"]
        
        # 为文本答案创建混淆项
        chart_types = ["bar chart", "line chart", "pie chart", "scatter plot", "area chart", "bubble chart", "donut chart"]
        confusion = [ct for ct in chart_types if ct != chart_type]
        if len(confusion) > 3:
            confusion = random.sample(confusion, 3)
        
        return template, chart_type, confusion, None
    
    def handle_template_48(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ How are images presented in relation to the charts in this infographic? """
        info = self.generator.get_info()
        if not info or "image_mode" not in info:
            return None, None, None, None
            
        image_mode = info["image_mode"].lower()
        
        mode_map = {
            "overlay": "overlay",
            "background": "background",
            "side": "side_by_side"
        }
        
        mode = mode_map.get(image_mode)
        
        if mode:
            # 为文本答案创建混淆项
            all_modes = list(mode_map.values())
            confusion = [m for m in all_modes if m != mode]
            
            return template, mode, confusion, None
            
        return None, None, None, None
    
    def handle_template_49(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Does this chart have a visible x-axis structure with labels or title? """
        info = self.generator.get_requirements()
        if not info or "has_x_axis" not in info:
            return None, None, None, None
    
        has_x_axis = info["has_x_axis"].lower()
        
        if has_x_axis == "yes":
            answer = "yes"
        elif has_x_axis == "no":
            answer = "no"
        else:
            # Handle unexpected values if necessary, or default to None
            logger.warning(f"Unexpected value for has_x_axis: {has_x_axis}")
            return None, None, None, None
        
        # 为布尔答案创建混淆项
        confusion = ["yes", "no"]
        confusion.remove(answer)
            
        return template, answer, confusion, None
    
    def handle_template_50(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ Does this chart have a visible y-axis structure with labels or title? """
        info = self.generator.get_requirements()
        if not info or "has_y_axis" not in info:
            return None, None, None, None
        
        has_y_axis = info["has_y_axis"].lower()
        
        if has_y_axis == "yes":
            answer = "yes"
        elif has_y_axis == "no":
            answer = "no"
        else:
            logger.warning(f"Unexpected value for has_y_axis: {has_y_axis}")
            return None, None, None, None
        
        # 为布尔答案创建混淆项
        confusion = ["yes", "no"]
        confusion.remove(answer)
            
        return template, answer, confusion, None
    
    def handle_template_51(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ How are small icons used with data marks in the visualization? """
        info = self.generator.get_requirements()
        if not info or "icon_mark" not in info:
            # If icon_mark is not specified, assume 'none' based on template description
            answer = "none"
            confusion = ["overlay", "replace", "side"]
            return template, answer, confusion, None
            
        icon_mark = info["icon_mark"].lower()
        
        # Direct mapping based on observed values in variation.json and template options
        valid_options = ["overlay", "replace", "side", "none", "circle"] # Include 'circle' as observed
        if icon_mark in valid_options:
             # Map 'circle' or potentially other specific mark types to 'overlay' if they are on the mark?
             # Or treat 'circle' as a distinct category if needed. 
             # Based on the template options, mapping non-explicit options to 'none' or a default seems safest.
             # Let's stick to the exact options for now. If icon_mark is 'circle', it doesn't fit neatly.
             # Re-evaluating: The template asks how *icons* are used *with data marks*. `icon_mark` describes the mark *itself*.
             # This might require a different field or interpretation.
             # Let's assume `icon_mark` directly maps for now, returning the value if valid.
             if icon_mark in ["overlay", "replace", "side", "none"]:
                 answer = icon_mark
                 # 为文本答案创建混淆项
                 confusion = [opt for opt in ["overlay", "replace", "side", "none"] if opt != answer]
                 return template, answer, confusion, None
             else:
                 # If icon_mark is something else (like 'circle'), it doesn't directly answer the question about *icon usage*.
                 # Defaulting to 'none' as no icons are used *in the manner described*.
                 logger.info(f"icon_mark value '{icon_mark}' does not fit template 51 options, defaulting to 'none'.")
                 answer = "none"
                 confusion = ["overlay", "replace", "side"]
                 return template, answer, confusion, None

        else:
            logger.warning(f"Unexpected value for icon_mark: {icon_mark}")
            return None, None, None, None # Or default to 'none'

    def handle_template_52(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[str]]:
        """ How are icons integrated with axis labels? """
        info = self.generator.get_requirements()
        if not info or "icon_label" not in info:
             # If icon_label is not specified, assume 'none' based on template description
            answer = "none"
            confusion = ["side", "replace"]
            return template, answer, confusion, None
            
        icon_label = info["icon_label"].lower()
        
        # Map variation.json values to template options
        if icon_label == "side":
            answer = "side"
        elif icon_label == "replace":
            answer = "replace"
        elif icon_label in ["none", "legend", "bottom"]: 
            # 'legend' or 'bottom' mean icons are not *with axis labels*
            answer = "none"
        else:
            logger.warning(f"Unexpected value for icon_label: {icon_label}")
            return None, None, None, None # Or default to 'none'
        
        # 为文本答案创建混淆项
        confusion = [opt for opt in ["side", "replace", "none"] if opt != answer]
            
        return template, answer, confusion, None
    
    def _calculate_rank(self, value: float, sorted_unique_values_desc: List[float]) -> Optional[int]:
        """Calculates the 1-based rank of a value in a descending sorted list of unique values."""
        if value is None:
            return None
        try:
            # Find the index (0-based) of the value in the unique sorted list
            rank_0_based = sorted_unique_values_desc.index(value)
            return rank_0_based + 1 # Return 1-based rank
        except ValueError:
            # Value not found in the list
            logger.warning(f"Value {value} not found in list for ranking.")
            return None
            
    def handle_template_53(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[str]]:
        """ What is the <Y label> for <ithx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        # Ensure the value passed to get_field_images is the actual x-axis value
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = (ith_tick_value, image_base64) if image_base64 else None

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 53")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value)
        answer = self.generator.get_value(y_label, filter_dict)

        if answer is None:
            logger.warning(f"Could not retrieve Y value for {ith_tick_value} in template 53")
            return None, None, None, None
            
        # 格式化结果
        formatted_answer = format_numeric_value(answer)

        # 生成混淆选项
        confusion = None
        if answer is not None:
            confusion = generate_formatted_distractors(answer)

        return question, formatted_answer, confusion, image

    def handle_template_54(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ What is the rank of the <Y label> for <ithx tick> among all <plural form of X label>? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x') # Needed for placeholder replacement
        if not y_label or not x_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = (ith_tick_value, image_base64) if image_base64 else None

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 54")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)

        # Get the specific Y value for the tick
        filter_dict_tick = self.generator.get_filter_dict(x_tick=ith_tick_value)
        target_y_value = self.generator.get_value(y_label, filter_dict_tick)

        if target_y_value is None:
            logger.warning(f"Could not retrieve Y value for {ith_tick_value} in template 54")
            return None, None, None, None
            
        # Get all unique Y values, sorted descending, for ranking
        # 手动处理唯一性和排序，因为 get_column_values 不支持 unique, sort, ascending 等参数
        all_y_values = self.generator.get_column_values(y_label)
        all_y_values_numeric = []
        if all_y_values:
             for val in all_y_values:
                 try:
                     all_y_values_numeric.append(float(val))
                 except (ValueError, TypeError):
                     logger.debug(f"Skipping non-numeric Y value {val} for ranking in template 54")
                     continue # Skip non-numeric
        
        if not all_y_values_numeric:
             logger.warning("No numeric Y values found for ranking in template 54")
             return None, None, None, None

        # Sort in descending order and ensure uniqueness
        all_y_values_sorted_unique = sorted(list(set(all_y_values_numeric)), reverse=True)

        try:
            target_y_numeric = float(target_y_value)
            rank = self._calculate_rank(target_y_numeric, all_y_values_sorted_unique)
        except (ValueError, TypeError):
            logger.warning(f"Target Y value {target_y_value} is not numeric in template 54")
            return None, None, None, None

        if rank is None:
            logger.warning(f"Could not calculate rank for Y value {target_y_value} in template 54")
            return None, None, None, None

        # 生成混淆选项 (rank is int)
        confusion = generate_numerical_distractors(rank, 3)

        return question, rank, confusion, image

    def handle_template_55(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[str]]:
        """ What is the <Y label> for <ithx tick> in the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=1)
        if not legend_values or not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        legend_value = legend_values[0]
        image_base64 = self.generator.get_field_images(ith_tick_value) # Check image for the tick itself
        image = (ith_tick_value, image_base64) if image_base64 else None

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 55")
             return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend_value)
        answer = self.generator.get_value(y_label, filter_dict)

        if answer is None:
            logger.warning(f"Could not retrieve Y value for tick={ith_tick_value}, legend={legend_value} in template 55")
            return None, None, None, None
            
        # 格式化结果
        formatted_answer = format_numeric_value(answer)

        # 生成混淆选项
        confusion = None
        if answer is not None:
            confusion = generate_formatted_distractors(answer)

        return question, formatted_answer, confusion, image

    def handle_template_56(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[str]]:
        """ What is the rank of the <Y label> for <ithx tick> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        x_label = self.generator.get_column_by_role('x') # Needed for placeholder replacement
        if not y_label or not group_label or not x_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=1)
        if not legend_values or not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        legend_value = legend_values[0]
        image_base64 = self.generator.get_field_images(ith_tick_value) # Check image for the tick itself
        image = (ith_tick_value, image_base64) if image_base64 else None

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 56")
             return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)

        # Get the specific Y value for the tick and legend
        filter_dict_tick_legend = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend_value)
        target_y_value = self.generator.get_value(y_label, filter_dict_tick_legend)

        if target_y_value is None:
            logger.warning(f"Could not retrieve Y value for tick={ith_tick_value}, legend={legend_value} in template 56")
            return None, None, None, None

        # Get all unique Y values for the specific legend group, sorted descending
        filter_dict_legend = self.generator.get_filter_dict(legend_value=legend_value)
        # 注意：使用 filter_dict 参数获取特定 legend 组的值
        filtered_df = self.generator.get_filtered_data(filter_dict_legend)
        if not filtered_df.empty and y_label in filtered_df.columns:
            # 手动处理唯一性和排序
            group_y_values = filtered_df[y_label].tolist()
        else:
            group_y_values = []  
        
        group_y_values_numeric = []
        if group_y_values:
            for val in group_y_values:
                try:
                    group_y_values_numeric.append(float(val))
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {val} for ranking in group {legend_value}, template 56")
                    continue # Skip non-numeric

        if not group_y_values_numeric:
             logger.warning(f"No numeric Y values found for ranking in group {legend_value}, template 56")
             return None, None, None, None
             
        # Sort in descending order and ensure uniqueness
        group_y_values_sorted_unique = sorted(list(set(group_y_values_numeric)), reverse=True)

        try:
             target_y_numeric = float(target_y_value)
             rank = self._calculate_rank(target_y_numeric, group_y_values_sorted_unique)
        except(ValueError, TypeError):
             logger.warning(f"Target Y value {target_y_value} is not numeric in template 56")
             return None, None, None, None

        if rank is None:
            logger.warning(f"Could not calculate rank for Y value {target_y_value} in group {legend_value}, template 56")
            return None, None, None, None

        # 生成混淆选项 (rank is int)
        confusion = generate_numerical_distractors(rank, 3)

        return question, rank, confusion, image

    def handle_template_57(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[str]]:
        """ Which <singular form of X label> has a <Y label> closest to <N>? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        if not y_label or not x_label:
            return None, None, None, None

        placeholders, _, _ = self.generator.get_common_placeholders(use_threshold=True)
        if "N" not in placeholders:
             logger.warning("Placeholder <N> not found for template 57")
             return None, None, None, None

        try:
            threshold_n = float(placeholders["N"])
        except (ValueError, TypeError):
             logger.warning(f"Placeholder <N> value {placeholders['N']} is not numeric for template 57")
             return None, None, None, None # Threshold must be numeric

        question = self.generator.replace_placeholders(template, placeholders)
        
        x_values = self.generator.get_column_values(x_label)
        
        closest_x = None
        closest_img = None
        min_diff = float('inf')

        if not x_values:
            return None, None, None, None

        for x_val in x_values:
            # Check image condition FIRST
            img = self.generator.get_field_images(x_val)
            if img is None:
                logger.debug(f"Skipping x={x_val} due to no image in template 57")
                continue # Skip if no image for this x_val

            current_y = self.generator.get_value(y_label, self.generator.get_filter_dict(x_tick=x_val))

            if current_y is not None:
                try:
                    diff = abs(float(current_y) - threshold_n)
                    if diff < min_diff:
                        min_diff = diff
                        closest_x = x_val
                        closest_img = img
                    elif diff == min_diff:
                         # Handle ties: maybe pick the first one, or log a warning. 
                         # Sticking with the first one found.
                         pass 

                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {current_y} for x={x_val} in template 57")
                    continue # Skip if y_val is not numeric

        if closest_x is not None:
            image = (closest_x, closest_img)
            # 为文本答案创建混淆项，获取所有可能的x值，然后排除正确答案
            if x_values:
                confusion = None
                if x_values:
                    # Ensure closest_x is treated as the same type as values in x_values if possible
                    try:
                        str_closest_x = str(closest_x)
                        confusion = [str(x) for x in x_values if str(x) != str_closest_x]
                    except Exception:
                         confusion = [x for x in x_values if x != closest_x]

                    # 最多选择4个混淆项
                    if len(confusion) > 4:
                        confusion = random.sample(confusion, 4)
                return question, closest_x, confusion if confusion else None, image
        else:
            # No x_value met the image condition AND had a valid numeric y_value
            logger.warning("No suitable (x, y) pair found meeting conditions for template 57")
            return None, None, None, None

    def handle_template_58(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[str]]:
        """ Which <legend label> has the highest <Y label> at <ithx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        x_label = self.generator.get_column_by_role('x') # Needed for placeholder replacement
        if not y_label or not group_label or not x_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        image_base64 = self.generator.get_field_images(ith_tick_value) # Check image for the tick itself
        image = (ith_tick_value, image_base64) if image_base64 else None

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 58")
             return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)

        # Find legends present at this tick
        filter_tick = self.generator.get_filter_dict(x_tick=ith_tick_value)
        # 手动获取唯一的 legends
        filtered_df = self.generator.get_filtered_data(filter_tick)
        legends_at_tick = []
        if not filtered_df.empty and group_label in filtered_df.columns:
            legends_at_tick = list(filtered_df[group_label].unique())

        if not legends_at_tick:
             logger.warning(f"No legends found for tick {ith_tick_value} in template 58")
             return None, None, None, None

        max_y = -float('inf')
        max_legend = None

        for legend in legends_at_tick:
            filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend)
            y_val = self.generator.get_value(y_label, filter_dict)
            
            if y_val is not None:
                try:
                   numeric_y = float(y_val)
                   if numeric_y > max_y:
                       max_y = numeric_y
                       max_legend = legend
                   elif numeric_y == max_y:
                       # Handle ties - maybe return list? For now, keep the first one found.
                       pass
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {y_val} for legend {legend} at tick {ith_tick_value}, template 58")
                    continue # Skip non-numeric Y values

        if max_legend is not None:
            # 为文本答案创建混淆项，使用其他图例值作为混淆选项
            confusion = None
            if legends_at_tick:
                confusion = [legend for legend in legends_at_tick if legend != max_legend]
                if len(confusion) < 4 and len(legends_at_tick) < 5:
                    # 如果真实的图例数量不足，添加一些虚构的图例作为混淆项
                    additional_legends = [f"Other group {i+1}" for i in range(4 - len(confusion))]
                    confusion.extend(additional_legends)
                elif len(confusion) > 4:
                    confusion = random.sample(confusion, 4)
            return question, max_legend, confusion if confusion else None, image
        else:
            # No numeric Y values found for any legend at this tick
            logger.warning(f"No legend with a numeric Y value found for tick {ith_tick_value} in template 58")
            return None, None, None, None

    def handle_template_59(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[str]]:
        """ Which <legend label> has the lowest <Y label> at <ithx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        x_label = self.generator.get_column_by_role('x') # Needed for placeholder replacement
        if not y_label or not group_label or not x_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        image_base64 = self.generator.get_field_images(ith_tick_value) # Check image for the tick itself
        image = (ith_tick_value, image_base64) if image_base64 else None

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 59")
             return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)

        # Find legends present at this tick
        filter_tick = self.generator.get_filter_dict(x_tick=ith_tick_value)
        # 手动获取唯一的 legends
        filtered_df = self.generator.get_filtered_data(filter_tick)
        legends_at_tick = []
        if not filtered_df.empty and group_label in filtered_df.columns:
            legends_at_tick = list(filtered_df[group_label].unique())

        if not legends_at_tick:
             logger.warning(f"No legends found for tick {ith_tick_value} in template 59")
             return None, None, None, None

        min_y = float('inf')
        min_legend = None

        for legend in legends_at_tick:
            filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend)
            y_val = self.generator.get_value(y_label, filter_dict)
            
            if y_val is not None:
                try:
                   numeric_y = float(y_val)
                   if numeric_y < min_y:
                       min_y = numeric_y
                       min_legend = legend
                   elif numeric_y == min_y:
                        # Handle ties - keep first one found.
                        pass
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {y_val} for legend {legend} at tick {ith_tick_value}, template 59")                    
                    continue # Skip non-numeric Y values

        if min_legend is not None:
            # 为文本答案创建混淆项，使用其他图例值作为混淆选项
            confusion = None
            if legends_at_tick:
                confusion = [legend for legend in legends_at_tick if legend != min_legend]
                if len(confusion) < 4 and len(legends_at_tick) < 5:
                    # 如果真实的图例数量不足，添加一些虚构的图例作为混淆项
                    additional_legends = [f"Other group {i+1}" for i in range(4 - len(confusion))]
                    confusion.extend(additional_legends)
                elif len(confusion) > 4:
                    confusion = random.sample(confusion, 4)
            return question, min_legend, confusion if confusion else None, image
        else:
             # No numeric Y values found for any legend at this tick
             logger.warning(f"No legend with a numeric Y value found for tick {ith_tick_value} in template 59")
             return None, None, None, None
    