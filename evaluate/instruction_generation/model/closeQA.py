import json
import textwrap
from typing import Optional

# from evaluate.instruction_generation.base import SingleData, BaseQA, BaseQAGenerator, client
from .base import BaseQAGenerator, SingleData


# class DataRetrievalQAGenerator(BaseQAGenerator):
#     """
#     数据检索型问题 (Data retrieval) - 占13.0%
#     定义：直接从图表中检索特定的数据点或值
#     不需要复杂的计算或推理
#     通常可以通过直接查看图表元素回答
#     "What's the percentage of men who thinks Valentine's Day is overrated?"
#     "In what year did Portugal's population reach 10.29 million?"
#     """
    
#     @property
#     def question_type(self) -> str:
#         return "data_retrieval"

#     @property
#     def system_message(self) -> str:
#         return "You are an AI assistant that generates data retrieval questions for charts. These questions require DIRECTLY READING specific values or labels from the chart without any calculations or reasoning steps."
    
#     def add_question_answer_types(self, qa_dicts: list) -> None:
#         for qa_dict in qa_dicts:
#             qa_dict["question_type"] = self.question_type
#             qa_dict["answer_type"] = "close"

#     def generate_prompt(self) -> str:
#         """生成数据检索型问题的prompt"""
#         tabular_data = self.single_data.tabular_data
#         meta_data = self.single_data.meta_data

#         chart_type = self.single_data.chart_type
        
#         # TODO 具体的问题类别还需要优化
#         return textwrap.dedent(f"""
#             Task: Create 5-8 question-answer pairs for a chart based on the provided data.

#             # CHART INFORMATION
#             Title: {meta_data.get('title', 'N/A')}
#             Description: {meta_data.get('description', 'N/A')}
#             Main Insight: {meta_data.get('main_insight', 'N/A')}
#             Chart Type: {chart_type}

#             # DATA STRUCTURE
#             Table Data:
#             {json.dumps(tabular_data, indent=2)}

#             # INSTRUCTIONS
#             Generate question-answer pairs that require DIRECT DATA RETRIEVAL from the chart without requiring calculations.

#             These questions should ask for specific data points or values that can be directly observed from the chart.

#             Examples of good data retrieval questions:
#             - "What is the exact value for [specific category/year/region] in the chart?"
#             - "Which category has the highest/lowest value in the chart?"
#             - "What is the [Nth] highest/lowest value in the chart?"

#             # VERY IMPORTANT FOR ANSWERS:
#             - Answers MUST be EXTREMELY CONCISE
#             - Answers should be ONLY the specific value OR label from the data
#             - DO NOT include explanations, units, or additional context in answers
#             - Give ONLY the exact value or category label as the complete answer

#             Examples of good answer formats:
#             - "4.3" (just the number)
#             - "AT&T" (just the category)
#             - "iPhone" (just the label)

#             # RESPONSE FORMAT
#             Provide your answer in JSON format as follows:
#             ```json
#             {{
#                 "results":
#                 [
#                     {{
#                         "question": "Your question here",
#                         "answer": "4.3"  // ONLY the value or label, nothing else
#                     }},
#                     ...more question-answer pairs...
#                 ]
#             }}
#             ```
#         """)
    
# class CompositionalQAGenerator(BaseQAGenerator):
#     """
#     组合型问题 (Compositional) - 占43.0%
#     定义：需要至少两个数学/逻辑操作来回答
#     包含加法、减法、平均值等数学运算
#     涉及多步骤的逻辑推理过程
#     "How many years does the poverty percentage rose above 11%?"
#     "What was the second leading cause of death among state prisoners in 2018?"
#     """
    
#     @property
#     def question_type(self) -> str:
#         return "compositional"
    
#     @property
#     def system_message(self) -> str:
#         return "You are an AI assistant that generates compositional questions for charts. These questions require MULTIPLE STEPS of reasoning or calculation to answer correctly."
    
#     def add_question_answer_types(self, qa_dicts: list) -> None:
#         for qa_dict in qa_dicts:
#             qa_dict["question_type"] = self.question_type
#             qa_dict["answer_type"] = "close"

#     def generate_prompt(self) -> str:
#         """生成组合型问题的prompt"""
#         tabular_data = self.single_data.tabular_data
#         meta_data = self.single_data.meta_data

#         chart_type = self.single_data.chart_type
        
#         return textwrap.dedent(f"""
#             Task: Create 5-8 question-answer pairs that require MULTIPLE STEPS of reasoning or calculation to answer.

#             # CHART INFORMATION
#             Title: {meta_data.get('title', 'N/A')}
#             Description: {meta_data.get('description', 'N/A')}
#             Main Insight: {meta_data.get('main_insight', 'N/A')}
#             Chart Type: {chart_type}

#             # DATA STRUCTURE
#             Table Data:
#             {json.dumps(tabular_data, indent=2)}

#             # INSTRUCTIONS FOR COMPOSITIONAL QUESTIONS
            
#             IMPORTANT: Generate questions that require AT LEAST TWO mathematical or logical operations to answer.
            
#             A compositional question MUST fall into one of these specific categories:
            
#             1. DIFFERENCE CALCULATION: Compare two specific data points to find the difference between them
#                Example: "What is the difference between the maximum and minimum values in the chart?"
               
#             2. CONDITION SATISFACTION: Find all data points that meet specific criteria
#                Example: "How many categories have values greater than [X]?"
               
#             3. AGGREGATION & COMPARISON: Calculate totals or averages and then compare them
#                Example: "How much do the average values of [Group A] and [Group B] differ?"
               
#             4. PROPORTION CALCULATION: Find what portion one value represents of another
#                Example: "What percentage of the total data is the sum of all values in [specific category]?"
               
#             5. HYPOTHETICAL CALCULATION: Calculate new values based on combining or modifying existing data
#                Example: "If the data from [Series A] and [Series B] are added together, what would the new maximum value be?"
            
#             For each question, ensure you can identify the EXACT TWO OR MORE STEPS needed to arrive at the answer.
            
#             # VERY IMPORTANT FOR ANSWERS:
#             - Answers MUST be EXTREMELY CONCISE
#             - Answers should be ONLY the final value, category, or number
#             - NO explanations, units, or steps in answers
#             - Give ONLY the exact final result as the complete answer
#             - Numbers should be rounded to 1 decimal place when appropriate
#             - Percentages should be given as whole numbers without the % symbol

#             Good answer formats:
#             - "2.1" (just the calculated number)
#             - "AT&T" (just the category name)
#             - "78" (just the percentage value, no % symbol)
#             - "3" (just the count)

#             # RESPONSE FORMAT
#             Provide your answer in JSON format as follows:
#             ```json
#             {{
#               "results": [
#                 {{
#                   "question": "Your question here",
#                   "answer": "2.1"  // ONLY the final answer, nothing else
#                 }},
#                 ...more question-answer pairs...
#               ]
#             }}
#             ```
#         """)


class VisualQAGenerator(BaseQAGenerator):
    """
    比较型问题 (Compare) - 占20%
    定义：需要比较图表中指定的多个目标
    对比图表中的不同组
    分析两个或多个数据系列之间的差异
    寻找相似性和不同点
    "Compare Americans and Germans views about the world economic leader?"
    "How do married adults conceive their relationship satisfaction in comparison to adults living with a partner?"
    "Compare the British approval and rejection levels about being a member of the EU."
    """

    def __init__(self, single_data: SingleData):
        super().__init__(single_data)
        self.visual = True
    
    @property
    def question_type(self) -> str:
        return "visual"
    
    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates visual reference questions for charts. These questions require identifying chart elements using visual attributes like color, position, and size."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "close"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data

        chart_type = self.single_data.chart_type
                
        return textwrap.dedent(f"""
            Task: Create 3-5 question-answer pairs that require VISUAL REFERENCE to specific elements in the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR VISUAL REFERENCE QUESTIONS
            
            IMPORTANT: Generate questions that require identifying chart elements using VISUAL ATTRIBUTES such as:
            - Color (e.g., blue, red, green, etc.)
            - Position (e.g., leftmost, rightmost, middle, top, bottom)
            - Size (e.g., tallest, shortest, largest, smallest)
            - Shape (e.g., steepest, flattest, sharpest)
            - Appearance (e.g., striped, dotted, patterned)
            
            A visual reference question MUST use at least one visual attribute to identify a specific element in the chart.
            
            Examples of good visual reference questions:
            - "What is the value of the tallest/shortest element in the chart?"
            - "What does the data series represented by [specific color] represent?"
            - "Which category is positioned at the [specific location] of the chart?"
            - "What is the label of the element marked with [specific pattern]?"
            
            # VERY IMPORTANT FOR ANSWERS:
            - Answers MUST be EXTREMELY CONCISE
            - Answers should be ONLY the specific value or label identified by the visual reference
            - DO NOT include explanations, units, or additional context in answers
            - Give ONLY the exact value or category label as the complete answer

            Good answer formats:
            - "4.3" (just the number)
            - "AT&T" (just the category name)
            - "iPhone" (just the label)

            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your question here",
                  "answer": "4.3"  // ONLY the value or label, nothing else
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)
    
        
class VisualCompositionalQAGenerator(BaseQAGenerator):
    """
    视觉组合型问题 (Both visual & compositional) - 占33.3%
    定义：结合视觉引用和数学/逻辑操作
    先通过视觉特征识别图表元素
    然后对识别的元素执行数学/逻辑操作
    "Between the second and the third age groups from the left, which opinion deviates the most?"
    "Which year has the most divergent opinions about Brazil's economy?"
    """

    def __init__(self, single_data: SingleData):
        super().__init__(single_data)
        self.visual = True
    
    @property
    def question_type(self) -> str:
        return "visual_compositional"
    
    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates visual-compositional questions for charts. These questions require FIRST identifying chart elements using visual attributes, THEN performing multiple steps of calculation or reasoning on those elements."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "close"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 question-answer pairs that require BOTH VISUAL REFERENCE AND MATHEMATICAL/LOGICAL OPERATIONS.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR VISUAL-COMPOSITIONAL QUESTIONS
            
            IMPORTANT: Generate questions that require a TWO-PHASE approach to answer:
            
            PHASE 1: First VISUALLY IDENTIFY specific elements using visual attributes such as:
            - Color (e.g., blue, red, green)
            - Position (e.g., leftmost, rightmost, middle, top, bottom)
            - Size (e.g., tallest, shortest, largest, smallest)
            - Shape (e.g., steepest, flattest, sharpest)
            - Appearance (e.g., striped, dotted, patterned)
            
            PHASE 2: Then perform MATHEMATICAL or LOGICAL OPERATIONS on these identified elements, such as:
            - Calculating differences between visually identified elements
            - Finding maximum/minimum values among visually identified groups
            - Determining rankings among visually identified elements
            - Calculating proportions or percentages involving visually identified elements
            - Comparing trends or patterns between visually identified elements
            
            A good visual-compositional question MUST include BOTH a clear visual reference AND require at least one mathematical/logical operation.
            
            Examples of good visual-compositional questions:
            - "By what percentage is the [color A] element higher than the [color B] element?"
            - "What is the average growth rate of the trend line between [specific time period]?"
            - "What proportion of the whole does the [visually distinct part] represent?"
            - "What is the difference between the [visually identified element] and the average of all elements?"
            
            # VERY IMPORTANT FOR ANSWERS:
            - Answers MUST be EXTREMELY CONCISE
            - Answers should be ONLY the final value, category, or label after both visual identification and calculation
            - DO NOT include explanations, units, or additional context in answers
            - Give ONLY the exact final result as the complete answer
            - Numbers should be rounded to 1 decimal place when appropriate
            - Percentages should be given as whole numbers without the % symbol

            Good answer formats:
            - "2.1" (just the calculated number)
            - "AT&T" (just the category name)
            - "78" (just the percentage value, no % symbol)
            - "iPhone" (just the label)

            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your question here",
                  "answer": "2.1"  // ONLY the final answer, nothing else
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)