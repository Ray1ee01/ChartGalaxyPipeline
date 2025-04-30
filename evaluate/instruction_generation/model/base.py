import json
import logging
import base64
import os
from openai import OpenAI
from abc import ABC, abstractmethod
from typing import Union, Optional

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
    def __init__(self, tabular_data: Optional[dict]=None,
                 meta_data: Optional[dict]=None,
                 chart_image: Optional[str]=None,
                 chart_type: Union[list, str]=None):
        self.tabular_data = tabular_data
        self.meta_data = meta_data
        self.chart_image = chart_image
        self.svg_path = None
        
        # 如果chart_image是目录路径，自动解析目录结构
        if chart_image and os.path.isdir(chart_image):
            dir_path = chart_image
            self.chart_image = os.path.join(dir_path, "chart.png")
            self.svg_path = os.path.join(dir_path, "chart.svg")
            data_file = os.path.join(dir_path, "data.json")
            if os.path.exists(data_file):
                with open(data_file, "r", encoding="utf-8") as f:
                    self.tabular_data = json.load(f)
            
            info_file = os.path.join(dir_path, "info.json")
            if os.path.exists(info_file):
                with open(info_file, "r", encoding="utf-8") as f:
                    self.generation_info = json.load(f)

            original_data_file = self.generation_info["data_source"]
            if os.path.exists(original_data_file):
                with open(original_data_file, "r", encoding="utf-8") as f:
                    original_data = json.load(f)
                    self.meta_data = original_data["metadata"]
        
        if isinstance(chart_type, list):
            self.chart_type = ", ".join(chart_type) + "\n" if chart_type else ""
        else:
            self.chart_type = chart_type
    
    def get_svg_path(self) -> Optional[str]:
        """获取SVG文件路径"""
        return self.svg_path


class SingleQA:
    """
    定义：直接从图表中检索特定的数据点或值
    不需要复杂的计算或推理
    通常可以通过直接查看图表元素回答
    "What's the percentage of men who thinks Valentine's Day is overrated?"
    "In what year did Portugal's population reach 10.29 million?"
    """
    def __init__(self, question: str, answer: str, question_type: str, answer_type: str):
        self.question = question
        self.answer = answer

        self.question_type = question_type
        self.answer_type = answer_type
    
    def __repr__(self):
        return f"SingleQA(question='{self.question}', answer='{self.answer}')"
    
    def to_dict(self):
        """ 将 QA 对转换为字典格式 """
        return {
            "question": self.question,
            "answer": self.answer,
            "question_type": self.question_type,
            "answer_type": self.answer_type
        }
    
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
            qa = SingleQA(qa_dict["question"], qa_dict["answer"], qa_dict["question_type"], qa_dict["answer_type"])
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
        
        try:
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
                model="gpt-4o-mini",
                messages=messages,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            
            try:
                qa_data = json.loads(content)
                
                qa_dicts = qa_data["results"]
                self.add_question_answer_types(qa_dicts)

                for qa in qa_dicts:
                    if isinstance(qa.get("answer"), dict):
                        # 如果 answer 是 list, 把其拼起来
                        qa["answer"] = "".join(str(part) for part in qa["answer"])
                
                result.add_qa_pairs(qa_dicts)
            except json.JSONDecodeError as json_err:
                error_msg = f"JSON parsing error: {json_err}. Raw content: {content[:200]}..."
                self.logger.error(error_msg)
                result.set_error(error_msg)
            
            return result
            
        except Exception as e:
            error_msg = f"Error generating {self.question_type} QA pairs: {e}"
            self.logger.error(error_msg)
            result.set_error(error_msg)
            return result
        
