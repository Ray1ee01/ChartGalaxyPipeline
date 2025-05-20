from typing import Tuple, Optional, List, Dict, Any
from template.base_generator import BaseGenerator
import os
import logging
import math # Add math import for closest value calculation
import random # Add random import for numerical distractor handling
from generate_choice import generate_numerical_distractors # Import moved to top

logger = logging.getLogger("InstructionGeneration.Template.TemplateHandlers")

# Add helper function for numeric value formatting
def format_numeric_value(value):
    """Format numeric values: keep integers as is, round float values to 2 decimal places"""
    if value is None:
        return None
    
    try:
        # Check if the value is an integer
        if isinstance(value, int) or (isinstance(value, float) and value.is_integer()):
            return int(value)
        else:
            # Round float values to 2 decimal places
            return round(float(value), 2)
    except (ValueError, TypeError):
        # If unable to convert to a numeric value, return the original value
        return value

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
            #"template_49": self.handle_template_49,
            #"template_50": self.handle_template_50,
            #"template_51": self.handle_template_51,
            #"template_52": self.handle_template_52,
            "template_53": self.handle_template_53,
            "template_54": self.handle_template_54,
            "template_55": self.handle_template_55,
            "template_56": self.handle_template_56,
            "template_57": self.handle_template_57,
            "template_58": self.handle_template_58,
            "template_59": self.handle_template_59,
            "template_60": self.handle_template_60,
            "template_61": self.handle_template_61,
            "template_62": self.handle_template_62,
            "template_63": self.handle_template_63,
            "template_64": self.handle_template_64,
            "template_65": self.handle_template_65,
            "template_66": self.handle_template_66,
            "template_67": self.handle_template_67,
            "template_68": self.handle_template_68,
            "template_69": self.handle_template_69,
            "template_70": self.handle_template_70,
            "template_71": self.handle_template_71,
            "template_72": self.handle_template_72,
            "template_73": self.handle_template_73,
            "template_74": self.handle_template_74,
            "template_75": self.handle_template_75,
            "template_76": self.handle_template_76,
            "template_77": self.handle_template_77,
            "template_78": self.handle_template_78,
            "template_79": self.handle_template_79,
            "template_80": self.handle_template_80,
        }
        
    def _handle_basic_calculation(self, template: str, calc_type: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """
        Handle basic calculation templates
        
        Args:
            template: Template string
            calc_type: Calculation type ('sum', 'avg', 'median', 'max', 'min', 'max_min_diff', 'max_second_max_diff')
            
        Returns:
            Tuple[str, float, list, str]: (question, answer, distractors, image)
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
            # Difference between highest and lowest values
            max_y = self.generator.get_max(y_label)
            min_y = self.generator.get_min(y_label)
            if max_y is not None and min_y is not None:
                result = max_y - min_y
        elif calc_type == 'max_second_max_diff':
            # Difference between highest and second highest values
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

        # Format result
        formatted_result = format_numeric_value(result)
        
        return question, formatted_result, None, None
    
    def _handle_difference(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """
        Handle difference templates
        
        Args:
            template: Template string
            with_legend: Whether to include legend
            
        Returns:
            Tuple[str, float, list, str]: (question, answer, distractors, image)
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
        
        # Format result
        formatted_difference = format_numeric_value(difference)
        
        return question, formatted_difference, None, None
    
    def _handle_legend_calculation(self, template: str, calc_type: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """
        Handle legend calculation templates
        
        Args:
            template: Template string
            calc_type: Calculation type ('sum', 'avg', 'max', 'min', etc.)
            
        Returns:
            Tuple[str, float, list, str]: (question, answer, distractors, image)
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

        # Format result
        formatted_result = format_numeric_value(result)
        confusion = None

        return question, formatted_result, confusion, None
    
    def _handle_threshold_count(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
        """
        Handle threshold count templates
        
        Args:
            template: Template string
            with_legend: Whether to include legend
            
        Returns:
            Tuple[str, int, list, str]: (question, answer, distractors, image)
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
        
        # Count how many x values have y values greater than the threshold
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
                
        return question, count, None, None
    
    def _handle_comparison_question(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """
        Handle comparison question templates
        
        Args:
            template: Template string
            with_legend: Whether to include legend
            
        Returns:
            Tuple[str, str, list, str]: (question, answer, distractors, image)
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

                # Add prompt for Yes/No questions
                question += " Your answer should be either Yes or No (without any additional text)."

                return question, answer, None, None
            except (ValueError, TypeError):
                 logger.debug(f"Cannot compare non-numeric values: {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
    
    def _format_multiple_answers(self, question: str, answer: str, confusion: list) -> Tuple[str, str, list, str]:
        """Format multiple answers in brackets"""
        return f"{question} If there are multiple answers, put them in brackets using this format ['Answer1', 'Answer2'].\n", answer, confusion, None
    
    # Add helper function for handling Yes/No questions
    def _format_yes_no_question(self, question: str, answer: str, image: list[tuple[str, str]]=None) -> Tuple[str, str, None, None]:
        """Add prompt to Yes/No questions and remove distractors"""
        return f"{question}", answer, None, image
    
    def _format_chart_type(self, question: str, answer: str) -> Tuple[str, str, None, None]:
        """Format chart type"""
        chart_types = ["Multiple Rose Chart", "Multiple Semi Donut Chart", "Gauge Chart", "Pie Chart", "Multiple Pie Chart", "Multiple Gauge Chart", "Multiple Donut Chart", "Bubble Chart", "Rose Chart", "Stacked Bar Chart", "Treemap", "Voronoi Treemap(Circle)", "Voronoi Treemap(Rectangle)", "Donut Chart", "Alluvial Diagram", "Multiple Line Graph", "Multiple Spline Graph", "Small Multiple Step Line Chart", "Bump Chart", "Multiple Step Line Graph", "Line Graph", "Small Multiple Line Graph", "Slope Chart", "Spline Graph", "Step Line Graph", "Grouped Circular Bar Chart", "Horizontal Diverging Bar Chart", "Vertical Bar Chart", "Horizontal Group Bar Chart", "Vertical Pictorial Bar Chart", "Circular Bar Chart", "Horizontal Bar Chart", "Vertical Group Bar Chart", "Vertical Dot Bar Chart", "Vertical Group Dot Bar Chart", "Vertical Stacked Bar Chart", "Horizontal Lollipop Chart", "Horizontal Stacked Bar Chart", "Vertical Waffle Chart", "Radial Bar Chart", "Grouped Bar Chart", "Stacked Area Chart", "Horizontal Range Chart", "Horizontal Dot Bar Chart", "Multiple Vertical Bar Chart", "Scatterplot", "Grouped Scatterplot", "Multiple Radar Spline Chart", "Multiple Radar Chart", "Radar Line Chart", "Radar Spline Chart", "Proportional Area Chart", "Triangle Bar Chart", "Pyramid Chart", "Pyramid Diagram", "Funnel Chart", "Area Chart", "Small Multiple Area Chart", "Layered Area Chart", "Spline Stacked Area Chart", "Spline Area Chart", "Spline Layered Area Chart", "Range Area Chart", "Spline Multiple Area Chart", "Multiple Area Chart"  ]
        
        # 根据图表类型选择相似的混淆项
        confusion = []
        primary_candidates = []
        secondary_candidates = []
        
        if "Bar" in answer:
            primary_candidates = [t for t in chart_types if "Bar" in t and t != answer]
            secondary_candidates = [t for t in chart_types if "Lollipop" in t or "Column" in t]
        elif "Area" in answer:
            primary_candidates = [t for t in chart_types if "Area" in t and t != answer]
            secondary_candidates = [t for t in chart_types if "Line" in t or "Spline" in t]
        elif "Line" in answer:
            primary_candidates = [t for t in chart_types if ("Line" in t or "Spline" in t) and t != answer]
            secondary_candidates = [t for t in chart_types if "Area" in t]
        elif "Pie" in answer:
            primary_candidates = [t for t in chart_types if ("Pie" in t or "Donut" in t) and t != answer]
            secondary_candidates = [t for t in chart_types if "Rose" in t]
        elif "Donut" in answer:
            primary_candidates = [t for t in chart_types if ("Pie" in t or "Donut" in t) and t != answer]
            secondary_candidates = [t for t in chart_types if "Rose" in t]
        elif "Radar" in answer:
            primary_candidates = [t for t in chart_types if "Radar" in t and t != answer]
            secondary_candidates = [t for t in chart_types if "Rose" in t or "Circular" in t]
        elif "Treemap" in answer:
            primary_candidates = [t for t in chart_types if "Treemap" in t and t != answer]
            secondary_candidates = ["Proportional Area Chart", "Bubble Chart"]
        elif "Rose" in answer:
            primary_candidates = [t for t in chart_types if "Rose" in t and t != answer]
            secondary_candidates = [t for t in chart_types if "Radar" in t or "Circular" in t]
        elif "Gauge" in answer:
            primary_candidates = [t for t in chart_types if "Gauge" in t and t != answer]
            secondary_candidates = ["Donut Chart", "Semi Donut Chart", "Circular Bar Chart"]
        elif any(x in answer for x in ["Pyramid", "Funnel", "Triangle"]):
            primary_candidates = ["Pyramid Chart", "Pyramid Diagram", "Funnel Chart", "Triangle Bar Chart"]
            primary_candidates.remove(answer)
            secondary_candidates = ["Vertical Bar Chart", "Stacked Bar Chart"]
        
        # 如果主要候选项不足3个，从次要候选项中补充
        confusion.extend(primary_candidates)
        if len(confusion) < 3 and secondary_candidates:
            remaining_slots = 3 - len(confusion)
            confusion.extend(random.sample(secondary_candidates, min(remaining_slots, len(secondary_candidates))))
        
        # 如果仍然不足3个，从其他完全不同类型中随机选择
        if len(confusion) < 3:
            other_charts = [t for t in chart_types if t != answer and t not in confusion]
            remaining_slots = 3 - len(confusion)
            confusion.extend(random.sample(other_charts, min(remaining_slots, len(other_charts))))
        
        # 确保只有3个混淆项
        confusion = confusion[:3]
        confusion = [c.lower() for c in confusion]
        
        return f"{question}", answer, confusion, None
    
    def _handle_ratio(self, template: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """
        Handle ratio template
        
        Args:
            template: Template string
            with_legend: Whether to include legend
            
        Returns:
            Tuple[str, float, list, str]: (question, answer, distractors, image)
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
                    
                    # Format result
                    formatted_ratio = format_numeric_value(ratio)

                    return question, formatted_ratio, None, None
                else:
                    # Handle division by zero
                    logger.debug("Division by zero in ratio calculation.")
                    return None, None, None, None
            except (ValueError, TypeError):
                 logger.debug(f"Cannot calculate ratio for non-numeric values: {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
    
    def _handle_extreme_value_x(self, template: str, extreme_type: str, with_legend: bool = False) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """
        Handle templates for X value corresponding to extreme Y values
        
        Args:
            template: Template string
            extreme_type: 'max' or 'min'
            with_legend: Whether to include legend
            
        Returns:
            Tuple[str, str, list, str]: (question, answer, distractors, image)
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
        
        return question, extreme_x, None, None
    
    def _handle_extremes_difference(self, template: str, first_rank: int, second_rank: int) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """
        Handle templates for difference between extreme values
        
        Args:
            template: Template string
            first_rank: Rank of first value (0 for highest, 1 for second highest, -1 for lowest)
            second_rank: Rank of second value
            
        Returns:
            Tuple[str, float, list, str]: (question, answer, distractors, image)
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
                formatted_difference = format_numeric_value(difference)
                return question, formatted_difference, None, None
            except (ValueError, TypeError):
                 logger.debug(f"Cannot calculate difference between extreme values (non-numeric): {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
        
    def handle_template_1(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the sum of <Y label> ? """
        return self._handle_basic_calculation(template, 'sum')
    
    def handle_template_2(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the <Y label> in <ithx tick> and <jthx tick> ? """
        return self._handle_difference(template)
    
    def handle_template_3(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the average <Y label> per <singular form of X label> ? """
        return self._handle_basic_calculation(template, 'avg')
    
    def handle_template_4(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the median <Y label> ? """
        return self._handle_basic_calculation(template, 'median')
    
    def handle_template_5(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the total <Y label> of/in <legend label> in the graph? """
        return self._handle_legend_calculation(template, 'sum')
    
    def handle_template_6(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the <Y label> of/in <legend label> in <ithx tick> and that in <jthx tick> ? """
        return self._handle_difference(template, with_legend=True)
    
    def handle_template_7(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
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
        return question, difference, confusion, None
    
    def handle_template_8(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the average <Y label> of/in <legend label> per <singular form of X label>? """
        return self._handle_legend_calculation(template, 'avg')
    
    def handle_template_9(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ 和 10 没区别 """
        return None, None, None, None
    
    def handle_template_10(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
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
        
        confusion = None
        return question, difference, confusion, None
    
    def handle_template_11(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
        """ In how many <plural form of X label>, is the <Y label> greater than <N> units ? """
        return self._handle_threshold_count(template)
    
    def handle_template_12(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the ratio of the <Y label> in <ithx tick> to that in <jthx tick> ? """
        return self._handle_ratio(template)
    
    def handle_template_13(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the <Y label> in <ithx tick> less than that in <jthx tick> ? """
        y_label = self.generator.get_column_by_role('y')

        placeholders, _, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not x_ticks:
            return None, None, None, None
            
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0])
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1])
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None:
            try: # Ensure values are comparable
                is_less = float(val1) < float(val2)
                answer = "Yes" if is_less else "No"
                return self._format_yes_no_question(question, answer)
            except (ValueError, TypeError):
                 logger.debug(f"无法比较非数值: {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
    
    def handle_template_14(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
        """ In how many <plural form of X label>, is the <Y label> of/in <legend label> greater than <N> <units> ? """
        return self._handle_threshold_count(template, with_legend=True)
    
    def handle_template_15(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the ratio of the <Y label> of/in <legend label> in <ithx tick> to that in <jthx tick> ? """
        return self._handle_ratio(template, with_legend=True)
    
    def handle_template_16(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the <Y label> of/in <legend label> in <ithx tick> less than that in <jthx tick> ? """
        y_label = self.generator.get_column_by_role('y')

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not legend_values or not x_ticks:
            return None, None, None, None
        
        legend_value = legend_values[0]
        filter_dict1 = self.generator.get_filter_dict(x_ticks[0], legend_value)
        filter_dict2 = self.generator.get_filter_dict(x_ticks[1], legend_value)
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        val1 = self.generator.get_value(y_label, filter_dict1)
        val2 = self.generator.get_value(y_label, filter_dict2)
        
        if val1 is not None and val2 is not None:
            try: # Ensure values are comparable
                is_less = float(val1) < float(val2)
                answer = "Yes" if is_less else "No"
                return self._format_yes_no_question(question, answer)
            except (ValueError, TypeError):
                 logger.debug(f"无法比较非数值: {val1}, {val2}")
                 return None, None, None, None

        return None, None, None, None
    
    def handle_template_17(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
            
            return self._format_yes_no_question(question, answer)
            
        return None, None, None, None
    
    def handle_template_18(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the highest and the second highest <Y label> ? """
        return self._handle_basic_calculation(template, 'max_second_max_diff')
    
    def handle_template_19(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
                return self._format_yes_no_question(question, answer)
            except (ValueError, TypeError):
                 logger.debug(f"无法比较 template 19 (非数值): {val1}, {val2}, {max_val}")
                 return None, None, None, None

        return None, None, None, None
    
    def handle_template_20(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
        
        return self._format_yes_no_question(question, answer)
    
    def handle_template_21(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
                return self._format_yes_no_question(question, answer)
            except (ValueError, TypeError):
                logger.debug(f"无法比较 template 21 (非数值): {val1}, {val2}, {max_y}")
                return None, None, None, None

        return None, None, None, None
        
    def handle_template_22(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the highest and the lowest <Y label> ? """
        return self._handle_basic_calculation(template, 'max_min_diff')
    
    def handle_template_23(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
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
                
        return question, count, None, None
    
    def handle_template_24(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
                return self._format_yes_no_question(question, answer)
            except (ValueError, TypeError):
                 logger.debug(f"无法比较 template 24 差值 (非数值)")
                 return None, None, None, None

        return None, None, None, None
        
    def handle_template_25(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the highest and second highest <Y label> of <legend label>? """
        # 使用通用方法处理极值差值：0为最高，1为次高
        return self._handle_extremes_difference(template, 0, 1)
    
    def handle_template_26(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the highest and lowest <Y label> of <legend label>? """
        # 使用通用方法处理极值差值：0为最高，-1为最低
        return self._handle_extremes_difference(template, 0, -1)
    
    def handle_template_27(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
        """ In how many <plural form of X label> is the <Y label> of <legend label> greater than 
        the average <Y label> of <legend label> across all <plural form of X label>? """
        # 这个与template_23基本相同，可以复用代码
        return self.handle_template_23(template)
    
    def handle_template_28(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
        
        return self._format_yes_no_question(question, answer)
    
    def handle_template_29(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
        
        return self._format_yes_no_question(question, answer)
    
    def handle_template_30(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
        
        return self._format_yes_no_question(question, answer)
    
    def handle_template_31(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
                    return self._format_yes_no_question(question, answer)
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
                    return self._format_yes_no_question(question, answer)
                    
        return None, None, None, None
    
    def handle_template_32(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between two consecutive major ticks on the Y-axis ? """
        return None, None, None, None # NOTE 不太容易标准化
    
    def handle_template_33(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ Across all <plural form of X label> , what is the maximum <Y label> ? """
        return self._handle_basic_calculation(template, 'max')
    
    def handle_template_34(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ Across all <plural form of X label> , what is the minimum <Y label> ? """
        return self._handle_basic_calculation(template, 'min')
    
    def handle_template_35(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ In which <X label> was the <Y label> maximum ? """
        return self._handle_extreme_value_x(template, 'max')
    
    def handle_template_36(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """  In which <X label> was the <Y label> minimum ? """
        return self._handle_extreme_value_x(template, 'min')
    
    def handle_template_37(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ Across all <plural form of X label> , what is the maximum <Y label> of/in <legend
        label> ? """
        return self._handle_legend_calculation(template, 'max')
    
    def handle_template_38(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ Across all <plural form of X label> , what is the minimum <Y label> of/in <legend
        label> ? """
        return self._handle_legend_calculation(template, 'min')
    
    def handle_template_39(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ In which <singular form of X label> was the <Y label> of/in <legend label> maximum ? """
        return self._handle_extreme_value_x(template, 'max', with_legend=True)
    
    def handle_template_40(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ In which <singular form of X label> was the <Y label> of/in <legend label> minimum ? """
        return self._handle_extreme_value_x(template, 'min', with_legend=True)
    
    def handle_template_41(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    
    def handle_template_42(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    
    def handle_template_43(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    
    def handle_template_44(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
        """ How many icons or images are present in this infographic? """
        svg_path = self.generator.get_svg_path()
        if not svg_path or not os.path.exists(svg_path):
            return None, None, None, None
            
        try:
            with open(svg_path, 'r', encoding='utf-8') as f:
                svg_content = f.read()
                
            image_count = svg_content.count('<image')
            
            return template, image_count, None, None
            
        except Exception as e:
            logger.error(f"读取SVG文件错误: {e}")
            return None, None, None, None
    
    def handle_template_45(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which data field determines the color encoding for the chart elements? """
        info = self.generator.get_requirements()
        if not info or "required_fields_colors" not in info:
            return None, None, None, None
    
        color_roles = info["required_fields_colors"]
        color_columns = []
        for role in color_roles:
            column_name = self.generator.get_column_by_role(role)
            if column_name:
                color_columns.append(column_name)
        
        if not color_columns:
            answer = "none"
        else:
            answer = ", ".join(color_columns) 
        
        all_columns = self.generator.get_column_names()
        confusion = [col for col in all_columns if col not in color_columns]
        
        if len(confusion) > 3:
            confusion = random.sample(confusion, 3)
        
        return template, answer, confusion, None
    
    def handle_template_46(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which data field is used for the icon encoding in the chart? """
        info = self.generator.get_requirements() # Changed from get_info() based on T45
        if not info or "required_fields_icons" not in info or not info["required_fields_icons"] or len(info["required_fields_icons"]) == 0:
            answer = "none"
            possible_confusion = self.generator.get_column_names()
            if len(possible_confusion) > 3:
                confusion = random.sample(possible_confusion, 3)
            else:
                confusion = possible_confusion
            return template, answer, confusion, None

        icon_roles = info["required_fields_icons"]
        icon_columns = []

        for role in icon_roles:
            column_name = self.generator.get_column_by_role(role)
            if column_name:
                icon_columns.append(column_name)
    
        if len(icon_columns) > 1:
            answer = "[" + ", ".join(icon_columns) + "]"
        else:
            answer = icon_columns[0]
        confusion = self.generator.get_column_names()
        confusion = [col for col in confusion if col not in icon_columns]
        confusion.append("none")
        if len(confusion) > 3:
            confusion = random.sample(confusion, 3)
        
        return self._format_multiple_answers(template, answer, confusion)
    
    def handle_template_47(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ What types of charts are included in this infographic? """
        chart_type = self.generator.chart_type
        return self._format_chart_type(template, chart_type)
    
    def handle_template_48(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    '''
    def handle_template_49(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    
    def handle_template_50(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    
    def handle_template_51(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ How are small icons used with data marks in the visualization? """
        info = self.generator.get_requirements()
        if not info or "icon_mark" not in info:
            # If icon_mark is not specified, assume 'none' based on template description
            answer = "none"
            confusion = ["overlay", "replace", "side"]
            return template, answer, confusion, None
            
        icon_mark = info["icon_mark"].lower()
        
        # Direct mapping based on observed values in variation.json and template options
        valid_options = ["overlay", "replace", "side", "none"] # Include 'circle' as observed
        if icon_mark in valid_options:
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

    def handle_template_52(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
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
    '''
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
            
    def handle_template_53(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[list]]:
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
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 53")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value)
        answer = self.generator.get_value(y_label, filter_dict)

        if answer is None:
            logger.warning(f"Could not retrieve Y value for {ith_tick_value} in template 53")
            return None, None, None, None
            
        # Format result
        formatted_answer = format_numeric_value(answer)

        return question, formatted_answer, None, image

    def handle_template_54(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
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
        image = [(ith_tick_value, image_base64) if image_base64 else None]

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

        return question, rank, None, image

    def handle_template_55(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[list]]:
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
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 55")
             return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend_value)
        answer = self.generator.get_value(y_label, filter_dict)

        if answer is None:
            logger.warning(f"Could not retrieve Y value for tick={ith_tick_value}, legend={legend_value} in template 55")
            return None, None, None, None
            
        formatted_answer = format_numeric_value(answer)
        return question, formatted_answer, None, image

    def handle_template_56(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
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
        image = [(ith_tick_value, image_base64) if image_base64 else None]

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

        return question, rank, None, image

    def handle_template_57(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[list]]:
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
            image = [(closest_x, closest_img)]
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

    def handle_template_58(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[list]]:
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
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 58")
             return None, None, None, None

        # 修复：确保替换模板中的<legend label>为实际的标签名称
        placeholders["legend label"] = group_label
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
                # 删除生成虚构混淆项的代码
                if len(confusion) > 4:
                    confusion = random.sample(confusion, 4)
            return question, max_legend, confusion if confusion else None, image
        else:
            # No numeric Y values found for any legend at this tick
            logger.warning(f"No legend with a numeric Y value found for tick {ith_tick_value} in template 58")
            return None, None, None, None

    def handle_template_59(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[list]]:
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
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
             logger.info(f"No image found for tick value: {ith_tick_value} in template 59")
             return None, None, None, None

        # 修复：确保替换模板中的<legend label>为实际的标签名称
        placeholders["legend label"] = group_label
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
                if len(confusion) > 4:
                    confusion = random.sample(confusion, 4)
            return question, min_legend, confusion if confusion else None, image
        else:
             # No numeric Y values found for any legend at this tick
             logger.warning(f"No legend with a numeric Y value found for tick {ith_tick_value} in template 59")
             return None, None, None, None
    
    def handle_template_60(self, template: str) -> Tuple[Optional[str], Optional[Any], Optional[list], Optional[list]]:
        """ Which <legend label> has the second highest <Y label> at <ithx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        x_label = self.generator.get_column_by_role('x')  # Needed for placeholder replacement
        if not y_label or not group_label or not x_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template_60")
            return None, None, None, None

        # Ensure replacement of <legend label> with the actual group label name
        placeholders["legend label"] = group_label
        question = self.generator.replace_placeholders(template, placeholders)

        # Find legends present at this tick
        filter_tick = self.generator.get_filter_dict(x_tick=ith_tick_value)
        filtered_df = self.generator.get_filtered_data(filter_tick)
        legends_at_tick = []
        if not filtered_df.empty and group_label in filtered_df.columns:
            legends_at_tick = list(filtered_df[group_label].unique())

        if len(legends_at_tick) < 2:  # Need at least 2 legends to find second highest
            logger.warning(f"Not enough legends found for tick {ith_tick_value} in template_60")
            return None, None, None, None

        # Create a list of (legend, y_value) pairs
        legend_y_pairs = []
        for legend in legends_at_tick:
            filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend)
            y_val = self.generator.get_value(y_label, filter_dict)
            
            if y_val is not None:
                try:
                    numeric_y = float(y_val)
                    legend_y_pairs.append((legend, numeric_y))
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {y_val} for legend {legend} at tick {ith_tick_value}")
                    continue
        
        if len(legend_y_pairs) < 2:  # Need at least 2 valid pairs to find second highest
            logger.warning(f"Not enough legends with numeric Y values found for tick {ith_tick_value}")
            return None, None, None, None
            
        # Sort by Y value in descending order
        legend_y_pairs.sort(key=lambda pair: pair[1], reverse=True)
        
        # Get the second highest legend
        second_highest_legend = legend_y_pairs[1][0]
        
        # Create confusion options from other legends
        confusion = [legend for legend in legends_at_tick if legend != second_highest_legend]
        if len(confusion) > 4:
            confusion = random.sample(confusion, 4)
            
        return question, second_highest_legend, confusion, image

    def handle_template_61(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the <Y label> of <ithx tick> greater than the average <Y label> across all <plural form of X label>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 61")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict = self.generator.get_filter_dict(x_tick=ith_tick_value)
        specific_y = self.generator.get_value(y_label, filter_dict)
        
        avg_y = self.generator.get_average(y_label)
        
        if specific_y is None or avg_y is None:
            logger.warning(f"Missing data for comparison in template 61: specific_y={specific_y}, avg_y={avg_y}")
            return None, None, None, None
            
        try:
            is_greater = float(specific_y) > float(avg_y)
            answer = "Yes" if is_greater else "No"
            return self._format_yes_no_question(question, answer, image)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison for template 61: specific_y={specific_y}, avg_y={avg_y}")
            return None, None, None, None

    def handle_template_62(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the <Y label> of <ithx tick> greater than the average <Y label> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=1)
        if not legend_values or not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        legend_value = legend_values[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 62")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        
        # Get the specific Y value for the tick in the legend group
        filter_dict_tick = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend_value)
        specific_y = self.generator.get_value(y_label, filter_dict_tick)
        
        # Get the average Y value within the legend group
        filter_dict_legend = self.generator.get_filter_dict(legend_value=legend_value)
        avg_y = self.generator.get_average(y_label, filter_dict_legend)
        
        if specific_y is None or avg_y is None:
            logger.warning(f"Missing data for comparison in template 62: specific_y={specific_y}, avg_y={avg_y}")
            return None, None, None, None
            
        try:
            is_greater = float(specific_y) > float(avg_y)
            answer = "Yes" if is_greater else "No"
            return self._format_yes_no_question(question, answer, image)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison for template 62: specific_y={specific_y}, avg_y={avg_y}")
            return None, None, None, None

    def handle_template_63(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ How many <plural form of X label> have <Y label> values strictly above that of <ithx tick>? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        if not y_label or not x_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=1)
        if not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 63")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        
        filter_dict_threshold = self.generator.get_filter_dict(x_tick=ith_tick_value)
        threshold_y = self.generator.get_value(y_label, filter_dict_threshold)
        
        if threshold_y is None:
            logger.warning(f"Could not retrieve threshold Y value for {ith_tick_value} in template 63")
            return None, None, None, None
            
        try:
            threshold_y_numeric = float(threshold_y)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric threshold Y value {threshold_y} in template 63")
            return None, None, None, None
        
        count = 0
        x_values = self.generator.get_column_values(x_label)
        
        for x_val in x_values:
            if x_val == ith_tick_value:
                continue
                
            filter_dict = self.generator.get_filter_dict(x_tick=x_val)
            y_val = self.generator.get_value(y_label, filter_dict)
            
            if y_val is not None:
                try:
                    if float(y_val) > threshold_y_numeric:
                        count += 1
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {y_val} for x={x_val} in template 63")
                    continue
                    
        return question, count, None, image

    def handle_template_64(self, template: str) -> Tuple[Optional[str], Optional[int], Optional[list], Optional[list]]:
        """ How many <plural form of X label> have <Y label> values strictly above that of <ithx tick> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        x_label = self.generator.get_column_by_role('x')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not x_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=1)
        if not legend_values or not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        legend_value = legend_values[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 64")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        
        # Get the threshold Y value for the specific tick within the legend group
        filter_dict_threshold = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend_value)
        threshold_y = self.generator.get_value(y_label, filter_dict_threshold)
        
        if threshold_y is None:
            logger.warning(f"Could not retrieve threshold Y value for tick={ith_tick_value}, legend={legend_value} in template 64")
            return None, None, None, None
            
        try:
            threshold_y_numeric = float(threshold_y)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric threshold Y value {threshold_y} in template 64")
            return None, None, None, None
        
        # Count how many x values have y values greater than the threshold within the same legend group
        count = 0
        x_values = self.generator.get_column_values(x_label)
        
        for x_val in x_values:
            if x_val == ith_tick_value:
                continue
                
            filter_dict = self.generator.get_filter_dict(x_tick=x_val, legend_value=legend_value)
            y_val = self.generator.get_value(y_label, filter_dict)
            
            if y_val is not None:
                try:
                    if float(y_val) > threshold_y_numeric:
                        count += 1
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y value {y_val} for x={x_val}, legend={legend_value} in template 64")
                    continue
                    
        return question, count, None, image

    def handle_template_65(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the ratio of <Y label> between <ithx tick> and the highest value within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=1)
        if not legend_values or not x_ticks:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        legend_value = legend_values[0]
        image_base64 = self.generator.get_field_images(ith_tick_value)
        image = [(ith_tick_value, image_base64) if image_base64 else None]

        if image_base64 is None:
            logger.info(f"No image found for tick value: {ith_tick_value} in template 65")
            return None, None, None, None

        question = self.generator.replace_placeholders(template, placeholders)
        
        # Get the Y value for the specific tick within the legend group
        filter_dict_tick = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend_value)
        specific_y = self.generator.get_value(y_label, filter_dict_tick)
        
        # Get the maximum Y value within the legend group
        filter_dict_legend = self.generator.get_filter_dict(legend_value=legend_value)
        max_y = self.generator.get_max(y_label, filter_dict_legend)
        
        if specific_y is None or max_y is None:
            logger.warning(f"Missing data for ratio calculation in template 65: specific_y={specific_y}, max_y={max_y}")
            return None, None, None, None
            
        try:
            float_specific_y = float(specific_y)
            float_max_y = float(max_y)
            
            # Avoid division by zero
            if float_max_y == 0:
                logger.warning("Division by zero in ratio calculation, template 65")
                return None, None, None, None
                
            ratio = float_specific_y / float_max_y
            formatted_ratio = format_numeric_value(ratio)
            
            return question, formatted_ratio, None, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in ratio calculation for template 65")
            return None, None, None, None

    def _get_y_values_with_legend(self, y_label, x_ticks, legend_value=None, sort_values=False):
        """
        获取指定刻度和图例的 Y 值及相关数据，可选是否按 Y 值排序
        
        Args:
            y_label: Y 轴标签名
            x_ticks: X 刻度值列表
            legend_value: 图例值，如果为 None 则不考虑图例
            sort_values: 是否按 Y 值从小到大排序
            
        Returns:
            处理后的 (y_val, filter_dict, tick_value, image_base64) 数据列表，若任一 Y 值缺失或非数值则返回 None
        """
        data_list = []
        
        for tick_value in x_ticks:
            # 创建适当的 filter_dict
            if legend_value is not None:
                filter_dict = self.generator.get_filter_dict(x_tick=tick_value, legend_value=legend_value)
            else:
                filter_dict = self.generator.get_filter_dict(x_tick=tick_value)
                
            y_val = self.generator.get_value(y_label, filter_dict)
            image_base64 = self.generator.get_field_images(tick_value)
            
            # 检查 Y 值和图像是否存在
            if y_val is None:
                logger.debug(f"Missing Y value for tick {tick_value}")
                return None
                
            if image_base64 is None:
                logger.debug(f"Missing image for tick {tick_value}")
                return None
                
            try:
                float_y_val = float(y_val)
                data_list.append((float_y_val, y_val, filter_dict, tick_value, image_base64))
            except (ValueError, TypeError):
                logger.debug(f"Non-numeric Y value {y_val} for tick {tick_value}")
                return None
        
        # 如果需要排序
        if sort_values:
            data_list.sort(key=lambda x: x[0])
        
        # 返回数据（移除 float_y_val，保留原始 y_val）
        return [(item[1], item[2], item[3], item[4]) for item in data_list]

    def handle_template_66(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ What is the difference between the <Y label> of <ithx tick> and <jthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if len(x_ticks) < 2:
            return None, None, None, None
                        
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
        ]

        question = self.generator.replace_placeholders(template, placeholders)
            
        try:
            diff = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
            
            return question, diff, None, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in percentage difference calculation, template 64")
            return None, None, None, None

    def handle_template_67(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the difference between the <Y label> of <ithx tick> and <jthx tick> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not legend_values or len(x_ticks) < 2:
            return None, None, None, None

        legend_value = legend_values[0]
            
        data = self._get_y_values_with_legend(y_label, x_ticks, legend_value)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
        ]

        question = self.generator.replace_placeholders(template, placeholders)
            
        try:
            diff = self.generator.get_difference(y_label, filter_dict1, filter_dict2)
            
            return question, diff, None, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in difference calculation, template 67")
            return None, None, None, None

    def handle_template_68(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which has a higher <Y label>: <ithx tick> or <jthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if len(x_ticks) < 2:
            return None, None, None, None
            
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None:
            logger.warning(f"Missing Y values for comparison in template 65")
            return None, None, None, None
            
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            
            if float_val1 == float_val2:
                answer = "both are equal"
                confusion = [ith_tick_value, jth_tick_value]
            elif float_val1 > float_val2:
                answer = str(ith_tick_value)
                confusion = [str(jth_tick_value), "both are equal"]
            else:
                answer = str(jth_tick_value)
                confusion = [str(ith_tick_value), "both are equal"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison, template 65")
            return None, None, None, None

    def handle_template_69(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which has a higher <Y label> within the <legend label> group: <ithx tick> or <jthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=2)
        if not legend_values or len(x_ticks) < 2:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        jth_tick_value = x_ticks[1]
        legend_value = legend_values[0]

        data = self._get_y_values_with_legend(y_label, x_ticks, legend_value)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None:
            logger.warning(f"Missing Y values for comparison in template 69")
            return None, None, None, None
            
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            
            if float_val1 == float_val2:
                answer = "both are equal"
                confusion = [ith_tick_value, jth_tick_value]
            elif float_val1 > float_val2:
                answer = str(ith_tick_value)
                confusion = [str(jth_tick_value), "both are equal"]
            else:
                answer = str(jth_tick_value)
                confusion = [str(ith_tick_value), "both are equal"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison, template 69")
            return None, None, None, None

    def handle_template_70(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the sum of <Y label> values for <ithx tick> and <jthx tick> greater than the <Y label> of <kthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=3)
        if len(x_ticks) < 3:
            return None, None, None, None
            
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for comparison in template 70")
            return None, None, None, None
            
        try:
            sum_vals = float(y_val1) + float(y_val2)
            is_greater = sum_vals > float(y_val3)
            answer = "Yes" if is_greater else "No"
            return self._format_yes_no_question(question, answer, image)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison, template 70")
            return None, None, None, None

    def handle_template_71(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the sum of <Y label> values for <ithx tick> and <jthx tick> greater than the <Y label> of <kthx tick> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=3)
        if not legend_values or len(x_ticks) < 3:
            return None, None, None, None

        legend_value = legend_values[0]
            
        data = self._get_y_values_with_legend(y_label, x_ticks, legend_value)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for comparison in template 71")
            return None, None, None, None
            
        try:
            sum_vals = float(y_val1) + float(y_val2)
            is_greater = sum_vals > float(y_val3)
            answer = "Yes" if is_greater else "No"
            return self._format_yes_no_question(question, answer, image)
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison, template 71")
            return None, None, None, None

    def handle_template_72(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the average <Y label> of <ithx tick>, <jthx tick>, and <kthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=3)
        if len(x_ticks) < 3:
            return None, None, None, None
            
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for average calculation in template 72")
            return None, None, None, None
            
        try:
            avg_val = (float(y_val1) + float(y_val2) + float(y_val3)) / 3
            formatted_avg = format_numeric_value(avg_val)
            return question, formatted_avg, None, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in average calculation, template 72")
            return None, None, None, None

    def handle_template_73(self, template: str) -> Tuple[Optional[str], Optional[float], Optional[list], Optional[list]]:
        """ What is the average <Y label> of <ithx tick>, <jthx tick>, and <kthx tick> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=3)
        if not legend_values or len(x_ticks) < 3:
            return None, None, None, None

        legend_value = legend_values[0]
            
        data = self._get_y_values_with_legend(y_label, x_ticks, legend_value)
        if data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]
        
        question = self.generator.replace_placeholders(template, placeholders)

        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for average calculation in template 73")
            return None, None, None, None
            
        try:
            avg_val = (float(y_val1) + float(y_val2) + float(y_val3)) / 3
            formatted_avg = format_numeric_value(avg_val)
            return question, formatted_avg, None, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in average calculation, template 73")
            return None, None, None, None

    def handle_template_74(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which has a greater percentage change in <Y label>: from <ithx tick> to <jthx tick> or from <jthx tick> to <kthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=3)
        if len(x_ticks) < 3:
            return None, None, None, None

        sorted_data = self._get_y_values_with_legend(y_label, x_ticks, sort_values=True)
        if sorted_data is None:
            return None, None, None, None
            
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = sorted_data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        placeholders["ithx tick"] = ith_tick_value
        placeholders["jthx tick"] = jth_tick_value
        placeholders["kthx tick"] = kth_tick_value

        question = self.generator.replace_placeholders(template, placeholders)

        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for percentage change calculation in template 74")
            return None, None, None, None
                
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            float_val3 = float(y_val3)
            
            # Avoid division by zero
            if float_val1 == 0 or float_val2 == 0:
                logger.warning("Division by zero in percentage change calculation, template 74")
                return None, None, None, None
                
            # Calculate percentage changes
            pct_change1 = abs((float_val2 - float_val1) / float_val1) * 100
            pct_change2 = abs((float_val3 - float_val2) / float_val2) * 100
            
            # Determine which change is greater
            if pct_change1 == pct_change2:
                answer = "both are equal"
                confusion = [f"from {ith_tick_value} to {jth_tick_value}", f"from {jth_tick_value} to {kth_tick_value}"]
            elif pct_change1 > pct_change2:
                answer = f"from {ith_tick_value} to {jth_tick_value}"
                confusion = [f"from {jth_tick_value} to {kth_tick_value}", "both are equal"]
            else:
                answer = f"from {jth_tick_value} to {kth_tick_value}"
                confusion = [f"from {ith_tick_value} to {jth_tick_value}", "both are equal"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in percentage change calculation, template 74")
            return None, None, None, None

    def handle_template_75(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which has a greater percentage change in <Y label> within the <legend label> group: from <ithx tick> to <jthx tick> or from <jthx tick> to <kthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=3)
        if not legend_values or len(x_ticks) < 3:
            return None, None, None, None
            
        legend_value = legend_values[0]
        
        data = self._get_y_values_with_legend(y_label, x_ticks, legend_value, sort_values=False)
        if data is None:
            return None, None, None, None
        
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]
        
        question = self.generator.replace_placeholders(template, placeholders)
        
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            float_val3 = float(y_val3)
            
            # 避免除以零
            if float_val1 == 0 or float_val2 == 0:
                logger.warning("Division by zero in percentage change calculation, template 75")
                return None, None, None, None
                
            # 计算百分比变化
            pct_change1 = abs((float_val2 - float_val1) / float_val1) * 100
            pct_change2 = abs((float_val3 - float_val2) / float_val2) * 100
            
            # 确定哪个变化更大
            if pct_change1 == pct_change2:
                answer = "both are equal"
                confusion = [f"from {ith_tick_value} to {jth_tick_value}", f"from {jth_tick_value} to {kth_tick_value}"]
            elif pct_change1 > pct_change2:
                answer = f"from {ith_tick_value} to {jth_tick_value}"
                confusion = [f"from {jth_tick_value} to {kth_tick_value}", "both are equal"]
            else:
                answer = f"from {jth_tick_value} to {kth_tick_value}"
                confusion = [f"from {ith_tick_value} to {jth_tick_value}", "both are equal"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in percentage change calculation, template 75")
            return None, None, None, None

    def handle_template_76(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the <Y label> of <ithx tick> closer to the <Y label> of <jthx tick> or <kthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        if not y_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=3)
        if len(x_ticks) < 3:
            return None, None, None, None
                    
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
        
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for proximity comparison in template 76")
            return None, None, None, None
            
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            float_val3 = float(y_val3)
            
            # Calculate differences
            diff1 = abs(float_val1 - float_val2)
            diff2 = abs(float_val1 - float_val3)
            
            # Determine which is closer
            if diff1 == diff2:
                answer = "equally close to both"
                confusion = [str(jth_tick_value), str(kth_tick_value)]
            elif diff1 < diff2:
                answer = str(jth_tick_value)
                confusion = [str(kth_tick_value), "equally close to both"]
            else:
                answer = str(kth_tick_value)
                confusion = [str(jth_tick_value), "equally close to both"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in proximity comparison, template 76")
            return None, None, None, None

    def handle_template_77(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Is the <Y label> of <ithx tick> closer to the <Y label> of <jthx tick> or <kthx tick> within the <legend label> group? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=3)
        if not legend_values or len(x_ticks) < 3:
            return None, None, None, None
            
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
        
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for proximity comparison in template 77")
            return None, None, None, None
            
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            float_val3 = float(y_val3)
            
            # Calculate differences
            diff1 = abs(float_val1 - float_val2)
            diff2 = abs(float_val1 - float_val3)
            
            # Determine which is closer
            if diff1 == diff2:
                answer = "equally close to both"
                confusion = [str(jth_tick_value), str(kth_tick_value)]
            elif diff1 < diff2:
                answer = str(jth_tick_value)
                confusion = [str(kth_tick_value), "equally close to both"]
            else:
                answer = str(kth_tick_value)
                confusion = [str(jth_tick_value), "equally close to both"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in proximity comparison, template 77")
            return None, None, None, None

    def handle_template_78(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ In the <legend label> group, which is greater: the <Y label> at <ithx tick> or the sum of <Y label> at <jthx tick> and <kthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, legend_values, x_ticks = self.generator.get_common_placeholders(legend_num=1, tick_num=3)
        if not legend_values or len(x_ticks) < 3:
            return None, None, None, None
            
        data = self._get_y_values_with_legend(y_label, x_ticks)
        if data is None:
            return None, None, None, None
        
        (y_val1, filter_dict1, ith_tick_value, image_base64_i), \
        (y_val2, filter_dict2, jth_tick_value, image_base64_j), \
        (y_val3, filter_dict3, kth_tick_value, image_base64_k) = data
        
        image = [
            (ith_tick_value, image_base64_i),
            (jth_tick_value, image_base64_j),
            (kth_tick_value, image_base64_k)
        ]

        question = self.generator.replace_placeholders(template, placeholders)
        
        if y_val1 is None or y_val2 is None or y_val3 is None:
            logger.warning(f"Missing Y values for comparison in template 78")
            return None, None, None, None
            
        try:
            float_val1 = float(y_val1)
            float_val2 = float(y_val2)
            float_val3 = float(y_val3)
            
            sum_val23 = float_val2 + float_val3
            
            # Determine which is greater
            if float_val1 == sum_val23:
                answer = "both are equal"
                confusion = [f"the {y_label} at {ith_tick_value}", f"the sum of {y_label} at {jth_tick_value} and {kth_tick_value}"]
            elif float_val1 > sum_val23:
                answer = f"the {y_label} at {ith_tick_value}"
                confusion = [f"the sum of {y_label} at {jth_tick_value} and {kth_tick_value}", "both are equal"]
            else:
                answer = f"the sum of {y_label} at {jth_tick_value} and {kth_tick_value}"
                confusion = [f"the {y_label} at {ith_tick_value}", "both are equal"]
            
            return question, answer, confusion, image
        except (ValueError, TypeError):
            logger.warning(f"Non-numeric values in comparison, template 78")
            return None, None, None, None

    def handle_template_79(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which <legend label> has the highest <Y label> at the sum of <ithx tick> and <jthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if len(x_ticks) < 2:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        jth_tick_value = x_ticks[1]
        
        image_base64_i = self.generator.get_field_images(ith_tick_value)
        image_base64_j = self.generator.get_field_images(jth_tick_value)
        
        # Need at least one image
        if image_base64_i is None or image_base64_j is None:
            logger.info(f"No images found for ticks in template 79")
            return None, None, None, None
            
        # Compile images we have
        image = []
        if image_base64_i:
            image.append((ith_tick_value, image_base64_i))
        if image_base64_j:
            image.append((jth_tick_value, image_base64_j))

        # Replace '<legend label>' with the actual group label name in the question
        placeholders["legend label"] = group_label
        question = self.generator.replace_placeholders(template, placeholders)
        
        # Find all legend values present for these ticks
        filtered_df_i = self.generator.get_filtered_data(self.generator.get_filter_dict(x_tick=ith_tick_value))
        filtered_df_j = self.generator.get_filtered_data(self.generator.get_filter_dict(x_tick=jth_tick_value))
        
        legends_at_tick_i = []
        legends_at_tick_j = []
        
        if not filtered_df_i.empty and group_label in filtered_df_i.columns:
            legends_at_tick_i = list(filtered_df_i[group_label].unique())
        if not filtered_df_j.empty and group_label in filtered_df_j.columns:
            legends_at_tick_j = list(filtered_df_j[group_label].unique())
        
        # Find common legends present at both ticks
        common_legends = set(legends_at_tick_i).intersection(set(legends_at_tick_j))
        
        if not common_legends:
            logger.warning(f"No common legends found for both ticks in template 79")
            return None, None, None, None
        
        max_sum = float('-inf')
        max_legend = None
        
        for legend in common_legends:
            filter_dict_i = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend)
            filter_dict_j = self.generator.get_filter_dict(x_tick=jth_tick_value, legend_value=legend)
            
            y_val_i = self.generator.get_value(y_label, filter_dict_i)
            y_val_j = self.generator.get_value(y_label, filter_dict_j)
            
            if y_val_i is not None and y_val_j is not None:
                try:
                    sum_val = float(y_val_i) + float(y_val_j)
                    if sum_val > max_sum:
                        max_sum = sum_val
                        max_legend = legend
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y values for legend {legend} in template 79")
                    continue
        
        if max_legend is not None:
            # Create confusion options from other legends
            confusion = [legend for legend in common_legends if legend != max_legend]
            if len(confusion) > 3:
                confusion = random.sample(confusion, 3)
            
            print("confusion", confusion)
            return question, max_legend, confusion, image
        else:
            logger.warning(f"No legend with valid numeric Y values found in template 79")
            return None, None, None, None

    def handle_template_80(self, template: str) -> Tuple[Optional[str], Optional[str], Optional[list], Optional[list]]:
        """ Which <legend label> has the lowest <Y label> at the sum of <ithx tick> and <jthx tick>? """
        y_label = self.generator.get_column_by_role('y')
        group_label = self.generator.get_column_by_role('group')
        if not y_label or not group_label:
            return None, None, None, None

        placeholders, _, x_ticks = self.generator.get_common_placeholders(tick_num=2)
        if len(x_ticks) < 2:
            return None, None, None, None
            
        ith_tick_value = x_ticks[0]
        jth_tick_value = x_ticks[1]
        
        image_base64_i = self.generator.get_field_images(ith_tick_value)
        image_base64_j = self.generator.get_field_images(jth_tick_value)
        
        # Need at least one image
        if image_base64_i is None or image_base64_j is None:
            logger.info(f"No images found for ticks in template 80")
            return None, None, None, None
            
        # Compile images we have
        image = []
        if image_base64_i:
            image.append((ith_tick_value, image_base64_i))
        if image_base64_j:
            image.append((jth_tick_value, image_base64_j))

        # Replace '<legend label>' with the actual group label name in the question
        placeholders["legend label"] = group_label
        question = self.generator.replace_placeholders(template, placeholders)
        
        # Find all legend values present for these ticks
        filtered_df_i = self.generator.get_filtered_data(self.generator.get_filter_dict(x_tick=ith_tick_value))
        filtered_df_j = self.generator.get_filtered_data(self.generator.get_filter_dict(x_tick=jth_tick_value))
        
        legends_at_tick_i = []
        legends_at_tick_j = []
        
        if not filtered_df_i.empty and group_label in filtered_df_i.columns:
            legends_at_tick_i = list(filtered_df_i[group_label].unique())
        if not filtered_df_j.empty and group_label in filtered_df_j.columns:
            legends_at_tick_j = list(filtered_df_j[group_label].unique())
        
        # Find common legends present at both ticks
        common_legends = set(legends_at_tick_i).intersection(set(legends_at_tick_j))
        
        if not common_legends:
            logger.warning(f"No common legends found for both ticks in template 80")
            return None, None, None, None
        
        min_sum = float('inf')
        min_legend = None
        
        for legend in common_legends:
            filter_dict_i = self.generator.get_filter_dict(x_tick=ith_tick_value, legend_value=legend)
            filter_dict_j = self.generator.get_filter_dict(x_tick=jth_tick_value, legend_value=legend)
            
            y_val_i = self.generator.get_value(y_label, filter_dict_i)
            y_val_j = self.generator.get_value(y_label, filter_dict_j)
            
            if y_val_i is not None and y_val_j is not None:
                try:
                    sum_val = float(y_val_i) + float(y_val_j)
                    if sum_val < min_sum:
                        min_sum = sum_val
                        min_legend = legend
                except (ValueError, TypeError):
                    logger.debug(f"Skipping non-numeric Y values for legend {legend} in template 80")
                    continue
        
        if min_legend is not None:
            # Create confusion options from other legends
            confusion = [legend for legend in common_legends if legend != min_legend]
            if len(confusion) > 3:
                confusion = random.sample(confusion, 3)
            
            return question, min_legend, confusion, image
        else:
            logger.warning(f"No legend with valid numeric Y values found in template 80")
            return None, None, None, None