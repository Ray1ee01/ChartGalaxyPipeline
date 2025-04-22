import json
import textwrap
from typing import Optional

from .base import BaseQAGenerator


class IdentifyQAGenerator(BaseQAGenerator):
    """
    Identify 类型问题 - 占比37%
    定义：要求从图表中识别特定目标（如数据项或数据属性）并描述该目标的特征
    例如："What are the current thoughts on direct democracy?"
    """
    
    @property
    def question_type(self) -> str:
        return "identify"

    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates 'identify' questions for charts. These questions require identifying a specific target (e.g., a data item or attribute) from the chart and describing its characteristics."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "open"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 question-answer pairs that require IDENTIFYING SPECIFIC TARGETS from the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR IDENTIFY QUESTIONS
            
            Generate questions that ask to identify a specific element, data point, or attribute in the chart and describe its characteristics. 
            
            "Identify" questions should:
            - Focus on a particular target in the chart (a specific data point, category, or attribute)
            - Ask about the characteristics, properties, or values associated with that target
            - Require descriptive answers that go beyond simple data retrieval
            
            Examples of good "identify" questions:
            - "What are Americans' views on abortion rights?"
            - "How do people perceive the economic situation in their country?"
            - "What are the current thoughts on direct democracy?"
            - "What characterizes the voting patterns in the Midwest region?"
            
            # ANSWER FORMAT REQUIREMENTS
            
            Answers should:
            - Be at least one complete sentence
            - Provide descriptive information about the identified target
            - Focus only on what can be directly observed in the chart data
            - Avoid introducing external information not contained in the chart
            - Give a comprehensive description of the identified element and its significance
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your identify question here",
                  "answer": "A descriptive sentence or paragraph that characterizes the identified target."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)


class SummarizeQAGenerator(BaseQAGenerator):
    """
    Summarize 类型问题 - 占比37%
    定义：要求根据指定的统计分析任务（如描述数据分布、异常值和趋势）总结图表
    例如："Explain the distribution of people who know a transgender person?"
    """
    
    @property
    def question_type(self) -> str:
        return "summarize"
    
    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates 'summarize' questions for charts. These questions require summarizing the chart based on specified statistical analysis tasks (e.g., describing data distribution, outliers, and trends)."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "open"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 question-answer pairs that require SUMMARIZING STATISTICAL PATTERNS in the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR SUMMARIZE QUESTIONS
            
            Generate questions that ask to summarize the chart based on specific statistical analysis tasks. These questions should focus on overall patterns rather than individual data points.
            
            A "summarize" question MUST explicitly ask for one of these analytical patterns:
            
            1. DISTRIBUTION ANALYSIS: Questions about how values are distributed across categories
               Example: "Explain the distribution of people who know a transgender person?"
               
            2. TREND ANALYSIS: Questions about changes over time or across categories
               Example: "How has public opinion on climate change evolved over the past decade?"
               
            3. OUTLIER IDENTIFICATION: Questions about unusual or extreme values in the data
               Example: "What are the notable outliers in household income across these demographics?"
               
            4. PATTERN RECOGNITION: Questions about general patterns or relationships in the data
               Example: "What patterns can be observed in voting behavior across different age groups?"
               
            5. CENTRAL TENDENCY: Questions about averages, medians, or typical values
               Example: "How would you characterize the typical American's view on immigration?"
               
            # ANSWER FORMAT REQUIREMENTS
            
            Answers should:
            - Be at least 2-3 sentences long
            - Provide a comprehensive summary of the requested statistical pattern
            - Include specific data points as evidence when appropriate
            - Avoid introducing information not shown in the chart
            - Focus on objective analysis rather than subjective interpretation
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your summarize question here",
                  "answer": "A detailed summary of the requested statistical pattern, distribution, trend, or outliers in the data."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)


class CompareQAGenerator(BaseQAGenerator):
    """
    Compare 类型问题 - 占比20%
    定义：要求比较图表中指定的目标
    例如："Compare Americans and Germans views about the world economic leader?"
    """
    
    @property
    def question_type(self) -> str:
        return "compare"
    
    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates 'compare' questions for charts. These questions require making explicit comparisons between specified targets within the chart data."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "open"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 question-answer pairs that require COMPARING SPECIFIED TARGETS in the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR COMPARE QUESTIONS
            
            Generate questions that explicitly ask for comparisons between two or more specified targets within the chart. The comparison should require analyzing differences and similarities.
            
            A "compare" question MUST have these characteristics:
            
            1. EXPLICIT COMPARISON: Question must clearly identify which two or more entities to compare
               Example: "Compare Americans and Germans views about the world economic leader?"
               
            2. COMPARISON DIMENSIONS: The question may optionally specify what aspect to compare
               Example: "How do rural and urban voters differ in their trust of government institutions?"
               
            3. MEANINGFUL CONTRAST: The targets being compared should have interesting differences or similarities
               Example: "Compare the support for environmental policies between younger and older voters."
               
            Examples of good "compare" questions:
            - "How do men and women differ in their attitudes toward online dating?"
            - "Compare Republicans' and Democrats' views on healthcare spending."
            - "What differences exist between East and West Coast residents regarding housing affordability?"
            - "How do high-income and low-income households compare in their spending on entertainment?"
            
            # ANSWER FORMAT REQUIREMENTS
            
            Answers should:
            - Be at least 2-3 sentences long
            - Clearly address both similarities and differences between the compared targets
            - Provide specific data points to support the comparison
            - Organize the comparison in a structured way
            - Avoid introducing information not shown in the chart
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your compare question here",
                  "answer": "A detailed comparison highlighting similarities and differences between the specified targets."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)


class DiscoverQAGenerator(BaseQAGenerator):
    """
    Discover 类型问题 - 占比6%
    定义：要求分析整个图表以通过推理和推导得出关键见解，
    与 summarize 不同, discover 类型的问题没有明确指定分析任务
    例如："How do Americans' see the coronavirus statistics?"
    """
    
    @property
    def question_type(self) -> str:
        return "discover"
    
    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates 'discover' questions for charts. These questions require analyzing the whole chart to derive key insights through inference and reasoning, without specifying a particular analytical task."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "open"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 question-answer pairs that require DISCOVERING KEY INSIGHTS from the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR DISCOVER QUESTIONS
            
            Generate questions that require analyzing the entire chart to derive key insights through inference and reasoning. Unlike "summarize" questions, "discover" questions do NOT specify a particular analytical task (like distribution or trend analysis).
            
            A "discover" question should:
            - Be open-ended and broad in scope
            - Require holistic analysis of the entire chart
            - Encourage drawing inferences beyond basic observation
            - Not specify a particular statistical pattern to analyze
            - Invite interpretation of what the data reveals or implies
            
            Examples of good "discover" questions:
            - "How do Americans' see the coronavirus statistics?"
            - "What does this chart reveal about public perception of social media?"
            - "What insights can be drawn from this data about consumer spending habits?"
            - "What does this data suggest about changing family structures?"
            - "What can we learn about political polarization from this chart?"
            
            # ANSWER FORMAT REQUIREMENTS
            
            Answers should:
            - Be at least 3-4 sentences long
            - Provide substantive insights that integrate multiple aspects of the chart
            - Include reasonable inferences drawn from the data
            - Highlight meaningful patterns, contradictions, or surprises in the data
            - Connect observations to form a coherent narrative about what the data reveals
            - Stay grounded in the chart data without introducing external information
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your discover question here",
                  "answer": "An insightful analysis that reveals key insights from the chart through inference and reasoning."
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)