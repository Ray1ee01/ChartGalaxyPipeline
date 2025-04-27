from typing import Tuple, Optional, List, Dict
from template.base_generator import BaseGenerator
import os
import logging

logger = logging.getLogger("InstructionGeneration.Template.TemplateHandlers")

class TemplateHandlers:
    def __init__(self, base_generator: BaseGenerator):
        self.generator = base_generator
        
    def _handle_basic_calculation(self, template: str, calc_type: str) -> Tuple[Optional[str], Optional[float]]:
        """
        处理基础计算模板
        
        Args:
            template: 模板字符串
            calc_type: 计算类型 ('sum', 'avg', 'median', 'max', 'min', 'max_min_diff', 'max_second_max_diff')
        """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None
            
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
                    result = y_values[0] - y_values[1]
                    
        return question, result
    
    def _handle_difference(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[float]]:
        """
        处理差值类模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
        """
        y_label = self.generator.get_column_by_role('y')
        
        legend_value = None
        if with_legend:
            placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
            if not legend_values or not x_ticks:
                return None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
            if not x_ticks:
                return None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        difference = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
        
        return question, difference
    
    def _handle_legend_calculation(self, template: str, calc_type: str) -> Tuple[Optional[str], Optional[float]]:
        """
        处理图例计算模板
        
        Args:
            template: 模板字符串
            calc_type: 计算类型 ('sum', 'avg', 'max', 'min', etc.)
        """
        y_label = self.generator.get_column_by_role('y')
                    
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
        if not legend_values:
            return None, None
        
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
            
        return question, result
    
    def _handle_threshold_count(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[int]]:
        """
        处理阈值计数模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
        """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        
        legend_value = None
        if with_legend:
            placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1, use_threshold=True)
            if not legend_values:
                return None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, _ = self.generator.get_common_placeholders(use_threshold=True)
        
        threshold = float(placeholders["N"])
        if threshold is None:
            return None, None
                    
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
                
        return question, count
    
    def _handle_comparison_question(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[str]]:
        """
        处理比较问题模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
        """
        y_label = self.generator.get_column_by_role('y')

        legend_value = None
        if with_legend:
            placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
            if not legend_values:
                return None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not x_ticks:
            return None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None:
            is_less = float(val1) < float(val2)
            return question, "Yes" if is_less else "No"
            
        return None, None
    
    def _handle_ratio(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[float]]:
        """
        处理比率模板
        
        Args:
            template: 模板字符串
            with_legend: 是否带图例
        """
        y_label = self.generator.get_column_by_role('y')

        legend_value = None
        if with_legend:
            placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
            if not legend_values:
                return None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not x_ticks:
            return None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None and val2 != 0:
            ratio = float(val1) / float(val2)
            return question, ratio
            
        return None, None
    
    def _handle_extreme_value_x(self, template: str, extreme_type: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[str]]:
        """
        处理极值对应的X值模板
        
        Args:
            template: 模板字符串
            extreme_type: 'max'或'min'
            with_legend: 是否带图例
        """
        legend_value = None
        if with_legend:
            placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
            if not legend_values:
                return None, None
            legend_value = legend_values[0]
        else:
            placeholders, _, _ = self.generator.get_common_placeholders(legend_num=1)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        extreme_x = self.generator.get_extreme_value_x(extreme_type, legend_value)
        
        return question, extreme_x
    
    def _handle_extremes_difference(self, template: str, first_rank: int, second_rank: int) -> Tuple[Optional[str], Optional[float]]:
        """
        处理极值差值模板的通用方法
        
        Args:
            template: 模板字符串
            first_rank: 第一个值的排名（0为最高，1为第二高，-1为最低）
            second_rank: 第二个值的排名
        """
        y_label = self.generator.get_column_by_role('y')
        
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
        if not legend_values:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict = self.generator.get_filter_dict(legend_value=legend_values[0])
        
        val1 = self.generator.get_nth_highest_value(y_label, first_rank, filter_dict)
        val2 = self.generator.get_nth_highest_value(y_label, second_rank, filter_dict)
        
        if val1 is not None and val2 is not None:
            difference = val1 - val2
            return question, difference
            
        return None, None
        
    def handle_template_1(self, template: str) -> Tuple[str, float]:
        """ What is the sum of <Y label> ? """
        return self._handle_basic_calculation(template, 'sum')
    
    def handle_template_2(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the difference between the <Y label> in <ithx tick> and <jthx tick> ? """
        return self._handle_difference(template)
    
    def handle_template_3(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the average <Y label> per <singular form of X label> ? """
        return self._handle_basic_calculation(template, 'avg')
    
    def handle_template_4(self, template: str) -> Tuple[str, float]:
        """ What is the median <Y label> ? """
        return self._handle_basic_calculation(template, 'median')
    
    def handle_template_5(self, template: str) -> Tuple[str, float]:
        """ What is the total <Y label> of/in <legend label> in the graph? """
        return self._handle_legend_calculation(template, 'sum')
    
    def handle_template_6(self, template: str) -> Tuple[str, float]:
        """ What is the difference between the <Y label> of/in <legend label> in <ithx tick> and that in <jthx tick> ? """
        return self._handle_difference(template, with_legend=True)
    
    def handle_template_7(self, template: str) -> Tuple[str, float]:
        """ What is the difference between the <Y label> of/in <legend label1> in <ithx tick>
        and the <Y label> of/in <legend label2> in <jthx tick> ? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        
        if not group_label:
            return None, None
        
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=2)
        if len(legend_values) < 2 or not x_ticks:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_values[1])
        
        difference = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
        
        return question, difference
    
    def handle_template_8(self, template: str) -> Tuple[str, float]:
        """ What is the average <Y label> of/in <legend label> per <singular form of X label>? """
        return self._handle_legend_calculation(template, 'avg')
    
    def handle_template_9(self, template: str) -> Tuple[str, float]:
        """ 和 10 没区别 """
        return None, None
    
    def handle_template_10(self, template: str) -> Tuple[str, float]:
        """ What is the difference between the <Y label> of/in <legend label1> and <Y label>
        of/in <legend label2> in <ithx tick> ? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        
        if not group_label:
            return None, None
        
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=1)
        if len(legend_values) < 2 or not x_ticks:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[0], legend_values[1])
        
        difference = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
        
        return question, difference
    
    def handle_template_11(self, template: str) -> Tuple[str, int]:
        """ In how many <plural form of X label>, is the <Y label> greater than <N> units ? """
        return self._handle_threshold_count(template)
    
    def handle_template_12(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the ratio of the <Y label> in <ithx tick> to that in <jthx tick> ? """
        return self._handle_ratio(template)
    
    def handle_template_13(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the <Y label> in <ithx tick> less than that in <jthx tick> ? """
        return self._handle_comparison_question(template)
    
    def handle_template_14(self, template: str) -> Tuple[Optional[str], Optional[int]]:
        """ In how many <plural form of X label>, is the <Y label> of/in <legend label> greater than <N> <units> ? """
        return self._handle_threshold_count(template, with_legend=True)
    
    def handle_template_15(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the ratio of the <Y label> of/in <legend label> in <ithx tick> to that in <jthx tick> ? """
        return self._handle_ratio(template, with_legend=True)
    
    def handle_template_16(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the <Y label> of/in <legend label> in <ithx tick> less than that in <jthx tick> ? """
        return self._handle_comparison_question(template, with_legend=True)
    
    def handle_template_17(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the difference between the <Y label> in <ithx tick> and <jthx tick> greater than
        he difference between any two <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if not x_ticks:
            return None, None
        
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
            return question, "Yes" if is_greatest else "No"
            
        return None, None
    
    def handle_template_18(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the difference between the highest and the second highest <Y label> ? """
        return self._handle_basic_calculation(template, 'max_second_max_diff')
    
    def handle_template_19(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """Is the sum of the <Y label> of/in <legend label1> in <ithx tick> and <jthx tick>
        greater than the maximum <Y label> of/in <legend label2> across all <plural form of X label> ?"""
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=2)
        if len(legend_values) < 2 or not x_ticks:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_values[0])
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        max_val = self.generator.get_max(y_label, 
                                        self.generator.get_filter_dict(legend_value=legend_values[1]))
        
        if val1 is not None and val2 is not None and max_val is not None:
            sum_vals = float(val1) + float(val2)
            is_greater = sum_vals > max_val
            return question, "Yes" if is_greater else "No"
            
        return None, None
    
    def handle_template_20(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """Is it the case that in every <singular form of X label>, the sum of the <Y label>
        of/in <legend label1> and <legend label2> is greater than the sum of <Y label> of <legend label3> and <Y label> of <legend label4> ?"""
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=4)
        if len(legend_values) < 4:
            return None, None
        
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
                sum1 = float(val1) + float(val2)
                sum2 = float(val3) + float(val4)
                return sum1 > sum2
            return False
        
        condition_met = self.generator.check_condition_for_all_x(check_condition)
        
        return question, "Yes" if condition_met else "No"
    
    def handle_template_21(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the sum of the <Y label> in <ithx tick> and <jthx tick> greater than the
        maximum <Y label> across all <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if not x_ticks:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1])
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        max_y = self.generator.get_max(y_label)
        
        if val1 is not None and val2 is not None and max_y is not None:
            sum_vals = float(val1) + float(val2)
            is_greater = sum_vals > max_y
            return question, "Yes" if is_greater else "No"
            
        return None, None
    
    def handle_template_22(self, template: str) -> Tuple[str, float]:
        """ What is the difference between the highest and the lowest <Y label> ? """
        return self._handle_basic_calculation(template, 'max_min_diff')
    
    def handle_template_23(self, template: str) -> Tuple[str, int]:
        """  In how many <plural form of X label> , is the <Y label> greater than the average <Y
        label> taken over all <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        
        placeholders, _, _ = self.generator.get_common_placeholders()
        question = self.generator.replace_placeholders(template, placeholders)
        
        avg_y = self.generator.get_average(y_label)
        
        count = 0
        x_values = self.generator.get_column_values(x_label)
        
        for x_val in x_values:
            filter_dict = self.generator.get_filter_dict(x_val)
            y_val = self.generator.get_value(y_label, filter_dict)
            if y_val is not None and y_val > avg_y:
                count += 1
                
        return question, count
    
    def handle_template_24(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the difference between the <Y label> of/in <legend label1> in <ithx tick> and
        <jthx tick> greater than the difference between the <Y label> of/in <legend label2> in <ithx tick> and <jthx tick> ? """
        y_label = self.generator.get_column_by_role('y')

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=2, tick_num=2)
        if len(legend_values) < 2 or not x_ticks:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict1_1 = self.generator.get_filter_dict(x_ticks[0], legend_values[0])
        filter_dict1_2 = self.generator.get_filter_dict(x_ticks[1], legend_values[0])
        
        val1_1 = self.generator.get_value(y_label, filter_dict1_1)
        val1_2 = self.generator.get_value(y_label, filter_dict1_2)
        
        filter_dict2_1 = self.generator.get_filter_dict(x_ticks[0], legend_values[1])
        filter_dict2_2 = self.generator.get_filter_dict(x_ticks[1], legend_values[1])
        
        val2_1 = self.generator.get_value(y_label, filter_dict2_1)
        val2_2 = self.generator.get_value(y_label, filter_dict2_2)
        
        if all(v is not None for v in [val1_1, val1_2, val2_1, val2_2]):
            diff1 = abs(float(val1_1) - float(val1_2))
            diff2 = abs(float(val2_1) - float(val2_2))
            
            is_greater = diff1 > diff2
            return question, "Yes" if is_greater else "No"
            
        return None, None
    
    def handle_template_25(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the difference between the highest and the second highest <Y label> of/in <legend label> ? """
        return self._handle_extremes_difference(template, 0, 1)
    
    def handle_template_26(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the difference between the highest and the lowest <Y label> of/in <legend label> ? """
        return self._handle_extremes_difference(template, 0, -1)
    
    def handle_template_27(self, template: str) -> Tuple[Optional[str], Optional[int]]:
        """ In how many <plural form of X label>, is the <Y label> of/in <legend label> greater
        than the average <Y label> of/in <legend label> taken over all <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
            
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=1)
        if not legend_values:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict = self.generator.get_filter_dict(legend_value=legend_values[0])
        avg_y = self.generator.get_average(y_label, filter_dict)
        
        count = 0
        x_values = self.generator.get_column_values(x_label)
        
        for x_val in x_values:
            val_filter = self.generator.get_filter_dict(x_val, legend_values[0])
            y_val = self.generator.get_value(y_label, val_filter)
            if y_val is not None and y_val > avg_y:
                count += 1
                
        return question, count
    
    def handle_template_28(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is it the case that in every <singular form of X label>, the sum of the <Y label> of/in
        <legend label1> and <legend label2> is greater than the <Y label> of/in <legend label3> ? """
        y_label = self.generator.get_column_by_role('y')
        
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=3)
        if len(legend_values) < 3:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            filter_dict3 = self.generator.get_filter_dict(x_val, legend_values[2])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            val3 = self.generator.get_value(y_label, filter_dict3)
            
            if all(v is not None for v in [val1, val2, val3]):
                sum12 = float(val1) + float(val2)
                return sum12 > float(val3)
            return False
            
        condition_met = self.generator.check_condition_for_all_x(check_condition)
        
        return question, "Yes" if condition_met else "No"
    
    def handle_template_29(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the <Y label> of/in <legend label1> strictly greater than the <Y label> of/in
        <legend label2> over the <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
            
        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=2)
        if len(legend_values) < 2:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            
            if val1 is not None and val2 is not None:
                return float(val1) > float(val2)
            return False
            
        strictly_greater = self.generator.check_condition_for_all_x(check_condition)
        
        return question, "Yes" if strictly_greater else "No"
    
    def handle_template_30(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Is the <Y label> of/in <legend label1> strictly less than the <Y label> of/in
        <legend label2> over the <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')

        placeholders, legend_values, _ = self.generator.get_common_placeholders(legend_num=2)
        if len(legend_values) < 2:
            return None, None
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        def check_condition(x_val):
            filter_dict1 = self.generator.get_filter_dict(x_val, legend_values[0])
            filter_dict2 = self.generator.get_filter_dict(x_val, legend_values[1])
            
            val1 = self.generator.get_value(y_label, filter_dict1)
            val2 = self.generator.get_value(y_label, filter_dict2)
            
            if val1 is not None and val2 is not None:
                return float(val1) < float(val2)
            return False
            
        strictly_less = self.generator.check_condition_for_all_x(check_condition)
        
        return question, "Yes" if strictly_less else "No"
    
    def handle_template_31(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ Does the <Y label> of/in <legend label> monotonically increase over the
        <plural form of X label> ? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        group_label = self.generator.get_column_by_role('group')
        
        x_is_temporal = self.generator.is_temporal_column(x_label)

        if x_is_temporal:
            if group_label:
                placeholders, legend_values, _ = self.generator.get_common_placeholders()
                if not legend_values:
                    return None, None
                
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
                    
                    return question, "Yes" if is_monotonic else "No"
            else:
                modified_template = template.replace(" of/in <legend label>", "")
                
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
                    
                    return question, "Yes" if is_monotonic else "No"
                    
        return None, None
    
    def handle_template_32(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ What is the difference between two consecutive major ticks on the Y-axis ? """
        return None, None # NOTE 不太容易标准化
    
    def handle_template_33(self, template: str) -> Tuple[str, float]:
        """ Across all <plural form of X label> , what is the maximum <Y label> ? """
        return self._handle_basic_calculation(template, 'max')
    
    def handle_template_34(self, template: str) -> Tuple[str, float]:
        """ Across all <plural form of X label> , what is the minimum <Y label> ? """
        return self._handle_basic_calculation(template, 'min')
    
    def handle_template_35(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ In which <X label> was the <Y label> maximum ? """
        return self._handle_extreme_value_x(template, 'max')
    
    def handle_template_36(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """  In which <X label> was the <Y label> minimum ? """
        return self._handle_extreme_value_x(template, 'min')
    
    def handle_template_37(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ Across all <plural form of X label> , what is the maximum <Y label> of/in <legend
        label> ? """
        return self._handle_legend_calculation(template, 'max')
    
    def handle_template_38(self, template: str) -> Tuple[Optional[str], Optional[float]]:
        """ Across all <plural form of X label> , what is the minimum <Y label> of/in <legend
        label> ? """
        return self._handle_legend_calculation(template, 'min')
    
    def handle_template_39(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ In which <singular form of X label> was the <Y label> of/in <legend label> maximum ? """
        return self._handle_extreme_value_x(template, 'max', with_legend=True)
    
    def handle_template_40(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ In which <singular form of X label> was the <Y label> of/in <legend label> minimum ? """
        return self._handle_extreme_value_x(template, 'min', with_legend=True)
    
    def handle_template_41(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ What is the position of the title in this infographic? """
        info = self.generator.get_info()
        if not info or "title_to_chart" not in info:
            return None, None
            
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
            return template, position
        return None, None
    
    def handle_template_42(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ What is the position of the main image in this infographic? """
        info = self.generator.get_info()
        if not info or "image_to_chart" not in info:
            return None, None
            
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
            return template, position
        return None, None
    
    def handle_template_43(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ What is the alignment style of the main text content? """
        info = self.generator.get_info()
        if not info or "text_align" not in info:
            return None, None
            
        text_align = info["text_align"].lower()
        
        alignment_map = {
            "left": "left-aligned",
            "right": "right-aligned",
            "center": "center-aligned",
            "middle": "center-aligned"
        }
        
        alignment = alignment_map.get(text_align)
        
        if alignment:
            return template, alignment
        return None, None
    
    def handle_template_44(self, template: str) -> Tuple[Optional[str], Optional[int]]:
        """ How many icons or images are present in this infographic? """
        svg_path = self.generator.get_svg_path()
        if not svg_path or not os.path.exists(svg_path):
            return None, None
            
        try:
            with open(svg_path, 'r', encoding='utf-8') as f:
                svg_content = f.read()
                
            # 计算<image>标签的数量
            image_count = svg_content.count('<image>')
            
            return template, image_count
        except Exception as e:
            logger.error(f"读取SVG文件错误: {e}")
            return None, None
    
    def handle_template_45(self, template: str) -> Tuple[Optional[str], Optional[int]]:
        """ 暂时留空 """
        return None, None
    
    def handle_template_46(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ 留空 """
        return None, None
    
    def handle_template_47(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ What types of charts are included in this infographic? """
        info = self.generator.get_info()
        if not info or "chart_type" not in info:
            return None, None
            
        chart_type = info["chart_type"]
        
        return template, chart_type
    
    def handle_template_48(self, template: str) -> Tuple[Optional[str], Optional[str]]:
        """ How are images presented in relation to the charts in this infographic? """
        info = self.generator.get_info()
        if not info or "image_mode" not in info:
            return None, None
            
        image_mode = info["image_mode"].lower()
        
        mode_map = {
            "overlay": "overlay",
            "background": "background",
            "side": "side_by_side"
        }
        
        mode = mode_map.get(image_mode)
        
        if mode:
            return template, mode
        return None, None
    

    
    