import json
import textwrap
from typing import Optional
from .base import BaseQAGenerator, SingleData





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
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["category"] = "Visual Understanding"
            qa_dict["subcategory"] = "Visual Elements Retrieval"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type

        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require VISUAL REFERENCE to specific elements in the chart.

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
            
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, directly derivable from the chart data using visual reference.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Numerically close to the correct answer (if applicable).
                - Related to other values or labels present in the chart.
                - Designed to catch common misinterpretations of the visual elements.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your question here",
                  "options": {{
                    "A": "Plausible Distractor 1",
                    "B": "Correct Answer",
                    "C": "Plausible Distractor 2",
                    "D": "Plausible Distractor 3"
                  }},
                  "answer": "B" // Letter of the correct option
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
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["category"] = "Visual Understanding"
            qa_dict["subcategory"] = "Visual Elements Retrieval"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type

        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require BOTH VISUAL REFERENCE AND MATHEMATICAL/LOGICAL OPERATIONS.

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
            - "What is the average growth rate of the trend line between [specific time period]? (Visually identify start/end points)"
            - "What proportion of the whole does the [visually distinct part, e.g., largest slice] represent?"
            - "What is the difference between the [visually identified element, e.g., red bar] and the average of all elements?"
            
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, resulting from the visual identification and subsequent calculation/logic.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Numerically close to the correct answer.
                - Potentially derived from incorrect visual identification or calculation errors (e.g., forgetting a step, misreading a value).
                - Related to other values or labels present in the chart.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your question here",
                  "options": {{
                    "A": "Plausible Distractor 1",
                    "B": "Correct Answer",
                    "C": "Plausible Distractor 2",
                    "D": "Plausible Distractor 3"
                  }},
                  "answer": "B" // Letter of the correct option
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)