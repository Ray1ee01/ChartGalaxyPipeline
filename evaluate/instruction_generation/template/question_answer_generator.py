import json
import os
from typing import Dict, List, Tuple, Any, Optional
import random
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
    
    def format_multiple_choice(self, question: str, correct_answer: str, distractors: List[str]) -> Tuple[str, Dict[str, str], str]:
        """格式化为多选题"""
        options_list = distractors + [correct_answer]
        random.shuffle(options_list)
        options_dict = {chr(ord('A') + i): opt for i, opt in enumerate(options_list)}
        correct_letter = ''
        for k, v in options_dict.items():
            # Compare numerically if possible to handle formatting differences like "5" vs "5.0"
            try:
                 if abs(float(v) - float(correct_answer)) < 1e-6:
                      correct_letter = k
                      break
            except ValueError:
                 if v == correct_answer: # Fallback to string comparison
                      correct_letter = k
                      break
        if not correct_letter: # Should always find the correct answer
            raise ValueError(f"Correct answer '{correct_answer}' not found in options: {options_dict}")


        options_str = "\n".join([f"{k}. {v}" for k, v in options_dict.items()]) # Format options vertically
        formatted_question = f"{question}\n\nSelect the correct answer from the following options:\n{options_str}\n\nAnswer with the letter corresponding to the correct option only (e.g., A, B, C, or D)."

        return formatted_question, options_dict, correct_letter

    def generate_question_answer_pairs(self) -> List[Dict]:
        if self.templates is None:
            self.load_templates()
        
        pairs = []
        
        for index, template_obj in enumerate(self.templates):
            template_id = list(template_obj.keys())[0]
            template_text = template_obj[template_id]
            
            ret = self.template_factory.process_template(template_id, template_text)
            if ret[0] is None:
                continue
                
            # 处理返回的4元组(问题, 答案, 混淆选项, 图像)
            question, answer, confusion, image = ret

            if question and answer is not None:
                str_answer = str(answer).strip()
                # Handle potential empty string answers from templates
                if not str_answer:
                     logger.warning(f"Skipping template {template_id} due to empty answer.")
                     continue

                is_numeric = False
                numeric_value = None

                try:
                    # Attempt to parse as float first for wider compatibility
                    numeric_value = float(str_answer)
                    # Check if it's actually an integer
                    if numeric_value.is_integer():
                         numeric_value = int(numeric_value)
                    is_numeric = True
                except ValueError:
                    is_numeric = False

                # Store original question and potentially the original answer text
                # The final "answer" field will hold the choice letter for MCQs
                pair_data = {
                    "question": question, # Original question text
                    "template": template_id,
                    "answer_type": "close", # Default type
                    "question_type": "template", # Add default template question type
                    # Add type, category, subcategory from template object
                    "type": template_obj.get("type", "unknown"), 
                    "category": template_obj.get("category", "unknown"),
                    "subcategory": template_obj.get("subcategory", "unknown")
                }
                
                # 添加混淆选项到pair_data
                if confusion:
                    pair_data["confusion"] = confusion

                if is_numeric and confusion and len(confusion) >= 3:
                    try:
                         # 使用已有的混淆选项
                         distractors = confusion[:3]  # 确保只取3个混淆项
                         # Use the original string answer for formatting consistency in options
                         formatted_question, options_dict, correct_letter = self.format_multiple_choice(question, str_answer, distractors)

                         pair_data["question"] = formatted_question
                         pair_data["options"] = options_dict
                         pair_data["answer"] = correct_letter # Final answer is the letter
                         pair_data["answer_type"] = "multiple_choice"
                         # type, category, subcategory are already set from template_obj
                    except Exception as e:
                         logger.error(f"Error processing numeric template {template_id} with answer {str_answer}: {e}")
                         # Fallback to original question/answer if MCQ generation fails
                         pair_data["question"] = f"{question}\n\nProvide the numerical answer." # Basic prompt
                         pair_data["answer"] = str_answer
                         pair_data["answer_type"] = "close_numeric_fallback"
                         pair_data["question_type"] = "template_fallback"
                         # Ensure type info is still present in fallback (might be less accurate)
                         pair_data["type"] = template_obj.get("type", "unknown_fallback")
                         pair_data["category"] = template_obj.get("category", "unknown_fallback")
                         pair_data["subcategory"] = template_obj.get("subcategory", "unknown_fallback")
                elif is_numeric:
                    # 数值类型但没有混淆项时的默认处理
                    pair_data["question"] = f"{question}\n\nProvide the numerical answer."
                    pair_data["answer"] = str_answer
                    pair_data["answer_type"] = "close_numeric"
                elif str_answer.lower() in ["yes", "no"]:
                     pair_data["question"] = f"{question}\n\nAnswer with exactly 'Yes' or 'No'."
                     pair_data["answer"] = str_answer.capitalize() # Standardize case
                     pair_data["answer_type"] = "yes_no"
                     # type, category, subcategory are already set from template_obj
                # Add other specific type handling here if needed (e.g., categories)
                else:
                     # Default for non-numeric, non-yes/no text answers
                     pair_data["question"] = f"{question}\n\nProvide a direct answer."
                     pair_data["answer"] = str_answer
                     pair_data["answer_type"] = "close_text"
                     # type, category, subcategory are already set from template_obj

                if image:
                    pair_data["image"] = image

                pairs.append(pair_data)
        
        return pairs
    
    def save_results(self, pairs: List[Dict]) -> None:
        try:
            with open(self.output_path, 'w') as f:
                json.dump(pairs, f, indent=2, ensure_ascii=False) # ensure_ascii=False for better readability
            
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