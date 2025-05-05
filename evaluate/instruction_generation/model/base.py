import json
import logging
import base64
import os
import csv
from openai import OpenAI
from abc import ABC, abstractmethod
from typing import Union, Optional, List, Dict, Any
import re

logger = logging.getLogger("InstructionGeneration.Base")

client = OpenAI(
    api_key="sk-7TndhZHnyzdeSVpL4755335348B4425cB64bF8Ea80379073",
    base_url="https://aihubmix.com/v1"
)

def encode_image_to_base64(image_path: str) -> Optional[str]:
    """ 将本地图片编码为 base64 字符串 """
    try:
        if not os.path.exists(image_path):
            return None
        
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        logger.error(f"无法编码图片 {image_path}: {e}")
        return None


class SingleData:
    """ 表示单个数据 """
    def __init__(self, chart_image: Optional[str]=None):

        self.tabular_data: Union[Dict, List[Dict]] = {}
        self.meta_data: dict = {}
        self.generation_info: dict = {}
        self.chart_image: Optional[str] = chart_image
        self.chart_type: str = "" # Initialize chart_type

        # Auto-parse if chart_image is a directory
        if chart_image and os.path.isdir(chart_image):
            dir_path = chart_image
            self.chart_image = os.path.join(dir_path, "chart.png")

            # Load tabular data: JSON -> CSV -> Empty Dict
            data_json_path = os.path.join(dir_path, "data.json")
            data_csv_path = os.path.join(dir_path, "data.csv")
            loaded_data = False

            if os.path.exists(data_json_path):
                try:
                    with open(data_json_path, "r", encoding="utf-8") as f:
                        self.tabular_data = json.load(f)
                        loaded_data = True
                    logger.info(f"Loaded data from JSON: {data_json_path}")
                except Exception as e:
                    logger.warning(f"Failed to load data.json {data_json_path}: {e}, trying CSV.")
                    self.tabular_data = {} # Reset before trying CSV

            if not loaded_data and os.path.exists(data_csv_path):
                try:
                    with open(data_csv_path, mode='r', encoding='utf-8', newline='') as f:
                        reader = csv.DictReader(f)
                        self.tabular_data = list(reader)
                        loaded_data = True
                    logger.info(f"Loaded data from CSV: {data_csv_path}")
                except Exception as e:
                    logger.warning(f"Failed to load data.csv {data_csv_path}: {e}")
                    self.tabular_data = {} # Ensure it's empty if CSV fails

            # Load generation info, metadata, and potentially chart_type from info.json
            info_path = os.path.join(dir_path, "info.json")
            if os.path.exists(info_path):
                try:
                    with open(info_path, "r", encoding="utf-8") as f:
                        self.generation_info = json.load(f)

                    # Attempt to load chart_type from info.json if available
                    loaded_chart_type = self.generation_info.get("chart_type")
                    if isinstance(loaded_chart_type, list):
                        self.chart_type = ", ".join(loaded_chart_type) + "\n" if loaded_chart_type else ""
                    elif isinstance(loaded_chart_type, str):
                        self.chart_type = loaded_chart_type

                    # Load original metadata if possible
                    original_data_path = self.generation_info.get("data_source")
                    if original_data_path and os.path.exists(original_data_path):
                        try:
                            with open(original_data_path, "r", encoding="utf-8") as f_orig:
                                original_data = json.load(f_orig)
                            self.meta_data = original_data.get("metadata", {})
                        except Exception as e:
                            logger.warning(f"Failed to load original data/metadata {original_data_path}: {e}")
                            self.meta_data = {}
                    # else: No action needed if path missing
                except Exception as e:
                    logger.warning(f"Failed to load info.json {info_path}: {e}")
                    self.generation_info = {}
                    self.meta_data = {}
                    self.chart_type = "" # Reset chart_type on info.json load failure
            # else: No action needed if info.json missing


class SingleQA:
    """
    问答对的基础类，支持多种类型的问答：
    1. 直接检索型问答：从图表中直接获取数据点或值
    2. 选择题型问答：提供多个选项的问答
    3. 开放式问答：需要解释或推理的问答
    """
    def __init__(self, 
                 instruction: str,
                 question: str, 
                 answer: Union[str, List, Dict], 
                 question_type: str, 
                 answer_type: str,
                 options: List[str] = None,
                 correct_option_index: int = None,
                 explanation: str = None,
                 difficulty: str = None):
        self.question = question
        self.instruction = instruction
        
        # 根据answer_type处理不同类型的答案
        if answer_type == "multiple_choice" and isinstance(answer, str) and len(answer) == 1:
            # 选择题，答案是单个字母（A,B,C,D...）
            self.answer = answer.upper()  # 确保大写
            # 如果没有提供correct_option_index，尝试从字母计算
            if correct_option_index is None and ord(self.answer) >= ord('A') and ord(self.answer) <= ord('Z'):
                self.correct_option_index = ord(self.answer) - ord('A')
            else:
                self.correct_option_index = correct_option_index
        elif isinstance(answer, list) and answer_type in ["multi_select", "multiple_items"]:
            # 对于多选题或多项答案，保持列表格式
            self.answer = answer
            self.correct_option_index = correct_option_index
        else:
            # 将非列表答案或单选题答案转为字符串
            self.answer = str(answer) if not isinstance(answer, (list, dict)) else answer
            self.correct_option_index = correct_option_index
            
        self.question_type = question_type
        self.answer_type = answer_type
        self.options = options or []
        self.explanation = explanation
        self.difficulty = difficulty
        self.full_question = self._generate_full_question()
    
    def _generate_full_question(self) -> str:
        """生成完整的问题文本，包括选项和引导语"""
        question_text = self.question.strip()
        
        question_text = self.instruction + "\n\n" + question_text
        # 如果有选项，添加选项部分
        if self.options:
            # 添加换行确保问题和选项分开
            question_text += "\n\n"
            # 使用字母作为选项标记
            for i, option in enumerate(self.options):
                option_letter = chr(65 + i)  # A, B, C, D...
                question_text += f"{option_letter}. {option}\n"
            
            # 添加答题引导语
            question_text += "\nAnswer with the letter of the correct option only."
        else:
            # 对于非选择题，可以添加其他类型的引导语
            if self.answer_type == "number":
                question_text += "\n\nPlease provide a numerical answer."
            elif self.answer_type == "text":
                question_text += "\n\nPlease provide your answer as specifically as possible."
        
        return question_text
    
    def __repr__(self):
        return f"SingleQA(question='{self.question}', answer='{self.answer}')"
    
    def to_dict(self):
        """ 将 QA 对转换为字典格式 """
        # 确保answer能被JSON序列化
        if isinstance(self.answer, list):
            # 列表类型的答案，确保列表中的每个元素都是可序列化的
            json_answer = [str(item) if not isinstance(item, (str, int, float, bool, type(None))) else item for item in self.answer]
        elif isinstance(self.answer, dict):
            # 字典类型的答案
            json_answer = {k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v for k, v in self.answer.items()}
        else:
            # 字符串或其他简单类型的答案
            json_answer = self.answer
            
        result = {
            "question": self.question,
            "full_question": self.full_question,
            "answer": json_answer,
            "question_type": self.question_type,
            "answer_type": self.answer_type
        }
        
        # 只在有值的情况下添加可选字段
        if self.options:
            result["options"] = self.options
        if self.correct_option_index is not None:
            result["correct_option_index"] = self.correct_option_index
        if self.explanation:
            result["explanation"] = self.explanation
        if self.difficulty:
            result["difficulty"] = self.difficulty
            
        return result

    
class QAResult:
    """ 存储数据检索型问答对的结果集合 """
    def __init__(self):
        self.qa_pairs: list[SingleQA] = []
        self.error = None
    
    def add_qa_pair(self, qa: SingleQA):
        """ 添加一个问答对 """
        self.qa_pairs.append(qa)
    
    def add_qa_pairs(self, qa_list: list):
        """ 批量添加问答对 """
        for qa_dict in qa_list:
            qa = SingleQA(
                instruction=qa_dict.get("instruction"),
                question=qa_dict["question"],
                answer=qa_dict["answer"],
                question_type=qa_dict.get("question_type", ""),
                answer_type=qa_dict.get("answer_type", ""),
                options=qa_dict.get("options"),
                correct_option_index=qa_dict.get("correct_option_index"),
                explanation=qa_dict.get("explanation"),
                difficulty=qa_dict.get("difficulty")
            )
            self.qa_pairs.append(qa)

    def set_error(self, error_msg: str):
        """ 设置错误信息 """
        self.error = error_msg
    
    def to_dict(self):
        """ 将结果转换为字典格式 """
        result = {
            "qa_pairs": [qa.to_dict() for qa in self.qa_pairs]
        }
        if self.error:
            result["error"] = self.error
        return result


class BaseQAGenerator(ABC):
    """ 某类 QA 生成器的基类 """
    def __init__(self, single_data: SingleData):
        super().__init__()
        self.single_data: SingleData = single_data

        self.client = client
        self.logger = logger

        self.visual = True # 统一都给 chart image

    @property
    @abstractmethod
    def question_type(self) -> str:
        """ 问题类型 """
        pass
    
    @property
    def system_message(self) -> str:
        """ 系统消息 """
        return "You are an AI assistant that generates questions and answers for chart comprehension tests. Create extremely concise answers that contain ONLY the specific value or label from the data with no additional text."
    
    def generate_prompt(self) -> str:
        """ 生 成rompt """
        raise NotImplementedError("Subclasses must implement generate_prompt()")
    
    def add_question_answer_types(self, qa_dicts: list) -> None:
        """ 给大模型生成的每对 QA 生成回答类型 """
        raise NotImplementedError("Subclasses must implement add_question_answer_types()")

    def generate(self) -> QAResult:
        """ 生成QA对, 使用子类提供的 prompt """
        result = QAResult()
        chart_image = self.single_data.chart_image if hasattr(self.single_data, 'chart_image') else None
        prompt = self.generate_prompt()

        messages = [
            {"role": "system", "content": self.system_message},
            {"role": "user", "content": prompt}
        ]

        if chart_image and self.visual:
            if os.path.exists(chart_image):
                base64_image = encode_image_to_base64(chart_image)
                if base64_image:
                    messages[1]["content"] = [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url", 
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                else:
                    self.logger.warning(f"无法加载图片: {chart_image}, 将继续但没有图像")
            else:
                # URL
                messages[1]["content"] = [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": chart_image}}
                ]

        response = self.client.chat.completions.create(
            model="gemini-2.5-flash-preview-04-17-nothink",
            messages=messages,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        cleaned_content = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', content)
        
        qa_data = json.loads(cleaned_content)
        qa_dicts = qa_data["results"]
        
        # 在处理answer之前先添加问题和回答类型
        self.add_question_answer_types(qa_dicts)

        for qa in qa_dicts:
            # 处理选项格式
            if isinstance(qa.get("options"), dict):
                # 选项字典可能按照 A, B, C, D 排序，需要保持顺序
                sorted_options = []
                # 首先查找常见的选项键格式
                option_keys = ["A", "B", "C", "D", "E", "F", "G", "H"] 
                for key in option_keys:
                    if key in qa["options"]:
                        sorted_options.append(f"{qa['options'][key]}")
                
                # 如果没有找到顺序键，则尝试按字母排序
                if not sorted_options:
                    sorted_keys = sorted(qa["options"].keys())
                    sorted_options = [f"{qa['options'][key]}" for key in sorted_keys]
                
                qa["options"] = sorted_options
        result.add_qa_pairs(qa_dicts)
        
        return result
