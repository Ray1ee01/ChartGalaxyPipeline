from typing import Dict, Callable, Tuple, Any
from .base_generator import BaseGenerator
from .template_handlers import TemplateHandlers
import logging

logger = logging.getLogger("InstructionGeneration.Template.TemplateFactory")

class TemplateFactory:
    def __init__(self, base_generator: BaseGenerator):
        self.base_generator = base_generator
        self.handlers = TemplateHandlers(base_generator)
        self.template_handlers = {}
        
        self.register_default_handlers()
    
    def register_handler(self, template_id: str, handler_func: Callable) -> None:
        """
        注册模板处理函数
        
        Args:
            template_id: 模板标识符
            handler_func: 处理函数，接收模板字符串并返回问题和答案的元组
        """
        self.template_handlers[template_id] = handler_func
    
    def register_default_handlers(self) -> None:
        """ 注册默认的模板处理函数 """
        for attr_name in dir(self.handlers):
            if attr_name.startswith('handle_template_'):
                try:
                    template_id = attr_name.replace('handle_template_', 'template_')
                    handler = getattr(self.handlers, attr_name)
                    if callable(handler):
                        self.register_handler(template_id, handler)
                except Exception as e:
                    logger.error(f"注册模板处理器 {attr_name} 失败: {e}")
    
    def get_handler(self, template_id: str) -> Callable:
        """ 获取模板的处理函数 """
        return self.template_handlers.get(template_id)
    
    def post_process_answer(self, answer: Any) -> Any:
        """ 对答案进行后处理，格式化浮点数 """
        if isinstance(answer, float):
            decimal_places = self.base_generator.get_decimal_places()
            return round(answer, decimal_places)
        
        return answer
    
    def process_template(self, template_id: str, template_text: str) -> Tuple[Any, Any]:
        """ 处理模板 """
        handler = self.get_handler(template_id)
        if handler:
            question, answer = handler(template_text)
            processed_answer = self.post_process_answer(answer)
            return question, processed_answer
        else:
            logger.error(f"未找到模板 '{template_id}' 的处理函数")
            return None, None