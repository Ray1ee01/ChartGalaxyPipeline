import json
import textwrap
from typing import Optional
import re

from .base import BaseQAGenerator, SingleData

class VisualElementDesignQAGenerator(BaseQAGenerator):
    """
    Visual/Element Design
    ● Infographic中各元素(标题、图表、文本块)的相对位置如何？
    ● 图表采用了什么样的信息层次和阅读路径？
    ● 文本内容的对齐方式是什么？
    ● 图表使用了什么color scheme？
    ● 图表中采用了哪些visual encoding channels(大小、形状、位置、颜色等)？
    ● 分析图表中的颜色对比如何引导读者注意特定数据点。
    ● 图表是否使用color gradients表示数据变化？如何解读这些渐变？
    """
    
    @property
    def question_type(self) -> str:
        return "visual_element_design"

    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates questions about visual elements, layout, typography, and visual encoding in infographics."
    
    def __init__(self, single_data: SingleData):
        super().__init__(single_data)
        self.visual = True

    def add_question_answer_types(self, qa_dicts: list) -> None:
        selection_pattern = re.compile(r'Options:\s*\["[^"]*"(?:,\s*"[^"]*")*\]')
        
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            
            if selection_pattern.search(qa_dict["question"]):
                qa_dict["answer_type"] = "selection"
            else:
                qa_dict["answer_type"] = "open"
    
    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 questions about VISUAL ELEMENTS and DESIGN aspects of the infographic.

            # INFOGRAPHIC INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR VISUAL ELEMENT DESIGN QUESTIONS
            
            Generate a mix of multiple-choice and open-ended questions analyzing visual design elements of the infographic. About 60% should be multiple-choice and 40% open-ended.
            
            Topics to create questions about:
            
            1. LAYOUT & STRUCTURE
               - Relative positioning of elements (title, charts, text blocks)
               - Information hierarchy and reading path
               - Text alignment methods
               - Organization of visual elements
            
            2. TYPOGRAPHY
               - Font styles and their purpose
               - Text hierarchy techniques
               - Text density and readability
               - Caption/annotation approaches
            
            3. COLOR USAGE
               - Color scheme type
               - Color function (decorative, categorical, sequential)
               - Color contrasts and emphasis
               - Use of color gradients to show data variation
            
            4. VISUAL ENCODING
               - Visual encoding channels used (size, shape, position, color, etc.)
               - Use of visual variables to represent data
               - Data-to-ink ratio
               - Use of visual cues to guide attention
            
            # QUESTION FORMATS
            
            For MULTIPLE-CHOICE questions:
            - Ask specific questions about visual design elements
            - Include EXACTLY 4 answer options using format: Options: ["option1", "option2", "option3", "option4"]
            - Have EXACTLY ONE correct answer
            - Focus on observable visual attributes
            
            For OPEN-ENDED questions:
            - Ask for analysis or explanation of visual design choices
            - Require specific observations about design elements
            - Focus on how design elements enhance data communication
            
            # EXAMPLES OF GOOD QUESTIONS:
            
            Multiple-choice example:
            ```
            Question: What is the text alignment method used in this infographic? Options: ["Left-aligned", "Center-aligned", "Right-aligned", "Justified"]
            Answer: Center-aligned
            ```
            
            Multiple-choice example:
            ```
            Question: What color scheme is primarily used in this chart? Options: ["Monochromatic", "Complementary", "Analogous", "Triadic"]
            Answer: Complementary
            ```
            
            Open-ended example:
            ```
            Question: Analyze how color contrast in the chart guides readers' attention to specific data points.
            Answer: The chart uses high contrast between background pastel colors and bright accent colors to highlight key data points. Statistical outliers are marked in red against a neutral blue background, creating immediate visual emphasis. Secondary data points use less saturated colors that maintain readability while not competing with the primary focus areas.
            ```
            
            # ANSWER FORMAT REQUIREMENTS
            
            For multiple-choice answers:
            - Provide ONLY the exact text of the correct option
            
            For open-ended answers:
            - Provide concise, specific explanations (2-4 sentences)
            - Include concrete observations about visual design elements
            - Explain how design choices enhance data presentation
            - Focus only on what can be directly observed
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your multiple-choice question here? Options: [\"Option A\", \"Option B\", \"Option C\", \"Option D\"]",
                  "answer": "Option A"
                }},
                {{
                  "question": "Your open-ended question here?",
                  "answer": "Your concise explanation of the visual design element."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)


class MultimediaIntegrationQAGenerator(BaseQAGenerator):
    """
    Multimedia Integration
    ● Infographic中的图像和图标如何增强数据表达？
    ● 主题图像在infographic中的位置和功能是什么？
    ● Infographic如何利用视觉层次引导读者注意力？
    """
    
    @property
    def question_type(self) -> str:
        return "multimedia_integration"

    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates open-ended questions about how images, icons, and visual hierarchy enhance data presentation in infographics."
    
    def __init__(self, single_data: SingleData):
        super().__init__(single_data)
        self.visual = True

    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "open"
    
    def generate_prompt(self) -> str:
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 OPEN-ENDED questions about MULTIMEDIA INTEGRATION in the infographic.

            # INFOGRAPHIC INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # INSTRUCTIONS FOR MULTIMEDIA INTEGRATION QUESTIONS
            
            Generate open-ended questions analyzing how multimedia elements enhance data presentation in the infographic.
            
            Topics to create questions about:
            
            1. IMAGERY & ICONS
               - How images and icons enhance data expression
               - Position and function of thematic images
               - Integration of visual elements with data
               - Consistency and style of imagery
            
            2. VISUAL HIERARCHY
               - How visual hierarchy guides reader attention
               - Use of size, color, and position to establish importance
               - Balance between decorative and informative elements
               - Navigation cues and information flow
            
            3. MEDIA INTEGRATION
               - Integration of different media types (charts, photos, illustrations)
               - Transition between different information sections
               - Use of visual metaphors to enhance understanding
               - Consistency across diverse visual elements
            
            # QUESTION FORMAT
            
            - Ask for analysis of how multimedia elements enhance data communication
            - Require specific observations about integration techniques
            - Focus on effectiveness of multimedia approach
            
            # EXAMPLES OF GOOD QUESTIONS:
            - How do the images and icons in this infographic enhance the data expression?
            - How does the infographic utilize visual hierarchy to guide readers' attention?
            
            # ANSWER FORMAT REQUIREMENTS
            
            - Provide concise, specific explanations (2-4 sentences)
            - Include concrete observations about multimedia integration
            - Explain how multimedia elements enhance data comprehension
            - Focus only on what can be directly observed
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your open-ended question here?",
                  "answer": "Your concise explanation of multimedia integration."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)


class SummarizationNarrationQAGenerator(BaseQAGenerator):
    """
    Summarization & Narration
    ● 为这张复杂图表创建一个简明的文字摘要。
    ● 将图表的关键信息转化为3-5个要点。
    ● 创建一个针对该图表的解释性脚本，适合口头演示。
    """
    
    @property
    def question_type(self) -> str:
        return "summarization_narration"

    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates open-ended questions about creating summaries, key points, and explanatory scripts for infographics."
    
    def __init__(self, single_data: SingleData):
        super().__init__(single_data)
        self.visual = True

    def add_question_answer_types(self, qa_dicts: list) -> None:
        """添加问题类型标记"""
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "open"
    
    def generate_prompt(self) -> str:
        """生成摘要与叙述开放式问题的prompt"""
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 OPEN-ENDED questions about SUMMARIZING AND NARRATING the infographic.

            # INFOGRAPHIC INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # INSTRUCTIONS FOR SUMMARIZATION AND NARRATION QUESTIONS
            
            Generate open-ended questions that ask for summarization, key point extraction, and narrative creation based on the infographic. These questions should focus on distilling and communicating the essence of the infographic.
            
            Topics to create questions about:
            
            1. CONCISE SUMMARIZATION
               - Creating brief textual summaries of complex infographics
               - Extracting main message and purpose
               - Balancing comprehensiveness with brevity
               - Translating visual information to textual format
            
            # QUESTION FORMAT
            
            - Ask for creation of summaries, key points, or narratives
            - Request specific output formats (paragraph summary, bullet points, script)
            - Focus on distilling and translating visual information to text
            
            # EXAMPLES OF GOOD QUESTIONS:
            - Create a concise textual summary of this complex infographic.
            - Transform the key information from this chart into 3-5 bullet points.
            - Create an explanatory script for this infographic suitable for a 2-minute oral presentation.
            
            # ANSWER FORMAT REQUIREMENTS
            
            - Provide concise, accurate summaries or narratives (2-6 sentences depending on question)
            - Include specific data points from the infographic
            - Present information in the requested format (paragraph, bullets, script)
            - Focus only on what can be directly observed in the infographic
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your open-ended question here?",
                  "answer": "Your concise summary or narrative based on the infographic."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)
    