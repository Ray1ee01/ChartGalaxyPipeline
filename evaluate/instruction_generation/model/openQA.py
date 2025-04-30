import json
import textwrap
from typing import Optional

from model.base import BaseQAGenerator


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
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["type"] = "retrieval"
            qa_dict["category"] = "Data Understanding"
            qa_dict["subcategory"] = "Data Identification"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require IDENTIFYING SPECIFIC TARGETS from the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR IDENTIFY QUESTIONS
            
            Generate multiple choice questions that ask to identify a specific element, data point, or attribute in the chart and describe its characteristics.
            
            "Identify" questions should:
            - Focus on a particular target in the chart (a specific data point, category, or attribute)
            - Ask about the characteristics, properties, or values associated with that target
            - Require descriptive answers that go beyond simple data retrieval
            
            Examples of good "identify" questions:
            - "What are Americans' views on abortion rights, according to the chart?"
            - "How do people perceive the economic situation in their country, based on the data?"
            - "What are the current thoughts on direct democracy reflected in the chart?"
            - "What characterizes the voting patterns in the Midwest region, as shown in the chart?"
            
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, providing a descriptive characterization of the identified target based SOLELY on the chart data. It should be at least one complete sentence.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Related to the topic but incorrect interpretations of the chart data.
                - Potentially focusing on minor details while missing the main point.
                - Making assumptions or bringing in outside information not present in the chart.
                - Similar in length and style to the correct answer.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your identify question here",
                  "options": {{
                    "A": "Plausible Distractor: Incorrect description 1",
                    "B": "Correct Answer: A descriptive sentence or paragraph that accurately characterizes the identified target based on the chart.",
                    "C": "Plausible Distractor: Incorrect description 2",
                    "D": "Plausible Distractor: Incorrect description 3"
                  }},
                  "answer": "B" // Letter of the correct option
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
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["type"] = "analysis"
            qa_dict["category"] = "Data Understanding"
            qa_dict["subcategory"] = "Summarization and Analysis"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require SUMMARIZING STATISTICAL PATTERNS in the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR SUMMARIZE QUESTIONS
            
            Generate multiple choice questions that ask to summarize the chart based on specific statistical analysis tasks. These questions should focus on overall patterns rather than individual data points.
            
            A "summarize" question MUST explicitly ask for one of these analytical patterns:
            
            1. DISTRIBUTION ANALYSIS: Questions about how values are distributed across categories
               Example: "Which option best explains the distribution of people who know a transgender person, according to the chart?"
               
            2. TREND ANALYSIS: Questions about changes over time or across categories
               Example: "How has public opinion on climate change evolved over the past decade, based on the chart?"
               
            3. OUTLIER IDENTIFICATION: Questions about unusual or extreme values in the data
               Example: "Which statement best describes the notable outliers in household income across these demographics?"
               
            4. PATTERN RECOGNITION: Questions about general patterns or relationships in the data
               Example: "What patterns can be observed in voting behavior across different age groups, as shown?"
               
            5. CENTRAL TENDENCY: Questions about averages, medians, or typical values
               Example: "How would you characterize the typical American's view on immigration, based on the data?"
               
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, providing a comprehensive summary of the requested statistical pattern (at least 2-3 sentences) based SOLELY on the chart data.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Incorrect summaries (e.g., misinterpreting trends, focusing on wrong patterns).
                - Statements that are partially true but incomplete or misleading.
                - Summaries that include external information not present in the chart.
                - Similar in length and style to the correct answer.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your summarize question here",
                  "options": {{
                    "A": "Plausible Distractor: Incorrect summary 1",
                    "B": "Correct Answer: A detailed summary of the requested statistical pattern, distribution, trend, or outliers based on the chart.",
                    "C": "Plausible Distractor: Incorrect summary 2",
                    "D": "Plausible Distractor: Incorrect summary 3"
                  }},
                  "answer": "B" // Letter of the correct option
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
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["type"] = "analysis"
            qa_dict["category"] = "Data Understanding"
            qa_dict["subcategory"] = "Data Comparison"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require COMPARING SPECIFIED TARGETS in the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR COMPARE QUESTIONS
            
            Generate multiple choice questions that explicitly ask for comparisons between two or more specified targets within the chart. The comparison should require analyzing differences and similarities.
            
            A "compare" question MUST have these characteristics:
            
            1. EXPLICIT COMPARISON: Question must clearly identify which two or more entities to compare
               Example: "Which option best compares Americans and Germans views about the world economic leader based on the chart?"
               
            2. COMPARISON DIMENSIONS: The question may optionally specify what aspect to compare
               Example: "How do rural and urban voters differ in their trust of government institutions, according to the data?"
               
            3. MEANINGFUL CONTRAST: The targets being compared should have interesting differences or similarities
               Example: "Which statement best compares the support for environmental policies between younger and older voters?"
               
            Examples of good "compare" questions:
            - "How do men and women differ in their attitudes toward online dating, according to the chart?"
            - "Compare Republicans' and Democrats' views on healthcare spending, as shown in the data."
            - "What differences exist between East and West Coast residents regarding housing affordability, based on the chart?"
            - "How do high-income and low-income households compare in their spending on entertainment, according to the data?"
            
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, clearly addressing both similarities and differences (at least 2-3 sentences) based SOLELY on the chart data.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Comparisons that are inaccurate or misinterpret the relationship between targets.
                - Comparisons that focus only on similarities OR differences, not both.
                - Statements that bring in external assumptions or data.
                - Similar in length and style to the correct answer.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your compare question here",
                  "options": {{
                    "A": "Plausible Distractor: Incorrect comparison 1",
                    "B": "Correct Answer: A detailed comparison highlighting similarities and differences between the specified targets based on the chart.",
                    "C": "Plausible Distractor: Incorrect comparison 2",
                    "D": "Plausible Distractor: Incorrect comparison 3"
                  }},
                  "answer": "B" // Letter of the correct option
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
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["type"] = "analysis"
            qa_dict["category"] = "Data Understanding"
            qa_dict["subcategory"] = "Summarization and Analysis"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require DISCOVERING KEY INSIGHTS from the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR DISCOVER QUESTIONS
            
            Generate multiple choice questions that require analyzing the entire chart to derive key insights through inference and reasoning. Unlike "summarize" questions, "discover" questions do NOT specify a particular analytical task (like distribution or trend analysis).
            
            A "discover" question should:
            - Be open-ended and broad in scope
            - Require holistic analysis of the entire chart
            - Encourage drawing inferences beyond basic observation
            - Not specify a particular statistical pattern to analyze
            - Invite interpretation of what the data reveals or implies
            
            Examples of good "discover" questions:
            - "How do Americans see the coronavirus statistics, according to the insights from this chart?"
            - "What does this chart reveal about public perception of social media?"
            - "What key insights can be drawn from this data about consumer spending habits?"
            - "What does this data suggest about changing family structures?"
            - "What can we learn about political polarization from this chart?"
            
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, providing substantive insights (at least 3-4 sentences) integrating multiple chart aspects and making reasonable inferences based SOLELY on the chart data.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Insights that are superficial, incorrect, or not supported by the chart data.
                - Statements focusing on isolated data points rather than holistic insights.
                - Inferences that rely heavily on external knowledge or assumptions not present in the chart.
                - Similar in length and style to the correct answer.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your discover question here",
                  "options": {{
                    "A": "Plausible Distractor: Incorrect insight 1",
                    "B": "Correct Answer: An insightful analysis revealing key insights from the chart through inference and reasoning based on the data.",
                    "C": "Plausible Distractor: Incorrect insight 2",
                    "D": "Plausible Distractor: Incorrect insight 3"
                  }},
                  "answer": "B" // Letter of the correct option
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)


class SummarizationNarrationQAGenerator(BaseQAGenerator):
    """
    Summarization-Narration 类型问题
    定义：要求生成图表的总结性叙述，强调重要数据故事和见解
    例如："Describe the main trends shown in this chart about population changes."
    """
    
    @property
    def question_type(self) -> str:
        return "summarization_narration"
    
    @property
    def system_message(self) -> str:
        return "You are an AI assistant that generates 'summarization-narration' questions for charts. These questions require creating comprehensive narratives that summarize charts, emphasizing key data stories and insights."
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        for qa_dict in qa_dicts:
            qa_dict["question_type"] = self.question_type
            qa_dict["answer_type"] = "multiple_choice"
            qa_dict["type"] = "analysis"
            qa_dict["category"] = "Data Understanding"
            qa_dict["subcategory"] = "Summarization and Analysis"

    def generate_prompt(self) -> str:
        tabular_data = self.single_data.tabular_data
        meta_data = self.single_data.meta_data
        chart_type = self.single_data.chart_type
        
        return textwrap.dedent(f"""
            Task: Create 3-5 MULTIPLE CHOICE question-answer pairs that require CREATING COMPREHENSIVE NARRATIVE SUMMARIES of the chart.

            # CHART INFORMATION
            Title: {meta_data.get('title', 'N/A')}
            Description: {meta_data.get('description', 'N/A')}
            Main Insight: {meta_data.get('main_insight', 'N/A')}
            Chart Type: {chart_type}

            # DATA STRUCTURE
            Table Data:
            {json.dumps(tabular_data, indent=2)}

            # INSTRUCTIONS FOR SUMMARIZATION-NARRATION QUESTIONS
            
            Generate multiple choice questions that ask for comprehensive narrative summaries of the chart. These questions should focus on creating a coherent data story that integrates multiple aspects of the chart.
            
            A "summarization-narration" question should:
            - Ask for a comprehensive overview of the chart's main message
            - Request a narrative that weaves together key data points into a coherent story
            - Call for explaining relationships between different elements in the chart
            - Require contextualizing the data within its domain (e.g., business, politics, social trends)
            - Focus on the "big picture" rather than specific details
            
            Examples of good "summarization-narration" questions:
            - "How would you narrate the key story shown in this chart about changes in global temperatures?"
            - "What comprehensive narrative best captures the relationship between education and income shown in this chart?"
            - "Which statement provides the most accurate narration of the main data story presented in this polling data?"
            - "How would an analyst best summarize the trends shown in this economic data chart?"
            
            # MULTIPLE CHOICE FORMAT REQUIREMENTS
            
            - For each question, provide exactly FOUR answer choices (A, B, C, D).
            - One choice must be the CORRECT answer, providing a comprehensive narrative (at least 3-4 sentences) that accurately tells the data story based SOLELY on the chart data.
            - The other three choices must be PLAUSIBLE DISTRACTORS. Distractors should be:
                - Narratives that miss key aspects of the data story or mischaracterize relationships.
                - Summaries that overemphasize minor details while missing the main message.
                - Narratives that introduce unwarranted interpretations or external data.
                - Similar in length and style to the correct answer.
                - DO NOT use options like "None of the above" or "All of the above".
            
            # RESPONSE FORMAT
            Provide your answer in JSON format as follows:
            ```json
            {{
              "results": [
                {{
                  "question": "Your summarization-narration question here",
                  "options": {{
                    "A": "Plausible Distractor: Incorrect narrative 1",
                    "B": "Correct Answer: A comprehensive narrative summary that accurately tells the data story shown in the chart.",
                    "C": "Plausible Distractor: Incorrect narrative 2",
                    "D": "Plausible Distractor: Incorrect narrative 3"
                  }},
                  "answer": "B" // Letter of the correct option
                }},
                ...more question-answer pairs...
              ]
            }}
            ```
        """)