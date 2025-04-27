import json
import os
from typing import Dict, List, Tuple, Any, Optional
from template.base_generator import BaseGenerator
from template.template_factory import TemplateFactory
import logging

logger = logging.getLogger("InstructionGeneration.Template.QuestionAnswerGenerator")

class QuestionAnswerGenerator:
    def __init__(self, data_path: str, template_path: str, output_path: str):
        self.template_path = template_path
        self.output_path = output_path
        self.templates = None
        
        self.base_generator = BaseGenerator(data_path)
        self.base_generator.load_data()
        self.template_factory = TemplateFactory(self.base_generator)
    
    def load_templates(self) -> List[Dict]:
        try:
            with open(self.template_path, 'r') as f:
                self.templates = json.load(f)
            
            return self.templates
        except Exception as e:
            logger.error(f"加载模板错误: {e}")
            return None
    
    def get_image_path(self) -> str:
        """获取图像路径，从BaseGenerator获取"""
        return self.base_generator.get_image_path()
    
    def add_answer_suffix(self, question: str, answer: str) -> str:
        """根据答案类型添加适当的后缀提示"""
        # 对于Yes/No类问题
        if answer in ["Yes", "No"]:
            return f"{question}\n\nAnswer with exactly 'Yes' or 'No'. Do not include any explanations, punctuation, or additional text in your response."
        
        # 对于数值型答案
        try:
            float(answer)  # 尝试转换为浮点数
            return f"{question}\n\nProvide only the numerical answer without any units, explanations, or additional text. Do not round or approximate the number unless specified in the question."
        except ValueError:
            pass
        
        # 对于选择题（假设是文本选项）
        if len(answer.split()) <= 3:  # 简单选项通常是短词或短语
            chart_types = ["chart", "plot", "graph", "diagram", "map"]
            if any(chart_type in answer.lower() for chart_type in chart_types):
                options = ["bar chart", "line chart", "pie chart", "scatter plot", "area chart", "radar chart", 
                          "box plot", "histogram", "heatmap", "waterfall chart", "bubble chart", 
                          "candlestick chart", "sankey diagram", "treemap", "word cloud"]
                
                # 生成一个包含正确答案的选项列表
                if answer in options:
                    selected_options = [opt for opt in options if opt != answer][:4]
                    selected_options.append(answer)
                else:
                    selected_options = options[:4]
                    selected_options.append(answer)
                
                import random
                random.shuffle(selected_options)
                
                return f"{question}\n\nSelect the correct solution for the preceding question from the options provided: [{', '.join(selected_options)}]\nYour answer should be the content of one of the options, rather than the serial number of the option, and should not include any leading preamble words or other content."
            else:
                return f"{question}\n\nProvide a single, concise answer. Do not include any explanations, punctuation, or additional text in your response."
        
        # 默认提示
        return f"{question}\n\nProvide a direct answer to the question. Do not include any explanations, reasoning, or additional information beyond what was specifically asked."
    
    def generate_question_answer_pairs(self) -> List[Dict]:
        if self.templates is None:
            self.load_templates()
        
        pairs = []
        
        for template_obj in self.templates:
            template_id = list(template_obj.keys())[0]
            template_text = template_obj[template_id]
            
            question, answer = self.template_factory.process_template(template_id, template_text)
            
            if question and answer is not None:  # 确保answer不是None
                str_answer = str(answer).strip()
                
                # 添加后缀以确保LLM准确回答
                enhanced_question = self.add_answer_suffix(question, str_answer)
                
                pairs.append({
                    "question": enhanced_question,
                    "answer": str_answer,
                    "template": template_id
                })
        
        return pairs
    
    def save_results(self, pairs: List[Dict]) -> None:
        try:
            with open(self.output_path, 'w') as f:
                json.dump(pairs, f, indent=2)
            
            logger.info(f"已保存 {len(pairs)} 个问答对到 {self.output_path}")
        except Exception as e:
            logger.error(f"保存结果出错: {e}")
    
    def generate(self, write2disk=False) -> List[Dict]:
        self.base_generator.load_data()
        self.load_templates()
        pairs = self.generate_question_answer_pairs()
        if write2disk:
            self.save_results(pairs)
        return pairs
    
# if __name__ == "__main__":
#     generator = QuestionAnswerGenerator(
#         data_path="/data1/lizhen/resources/result/data_pool_v2/11592.json",
#         template_path="/home/lizhen/ChartPipeline/evaluate/instruction_generation/example.json",
#         output_path="/home/lizhen/ChartPipeline/evaluate/instruction_generation/template_output_34.json"
#     )
    
#     pairs = generator.generate()
#     print(f"已生成 {len(pairs)} 个问答对。")