import json
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
                
                pairs.append({
                    "question": question,
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