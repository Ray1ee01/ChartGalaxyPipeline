from model.openQA import *
from model.base import SingleData, BaseQAGenerator

class QAGeneratorFactory:
    """ QA 生成器工厂 """
    
    _generators = {
        #"summarization": SummarizationQAGenerator,
        "identify": IdentifyQAGenerator,
        "compare": CompareQAGenerator,
        "calculate": CalculateQAGenerator,
        "analyze": AnalyzeQAGenerator,
        "multiple_choice_complex": MultipleChoiceQAGenerator,
        "factoid_claim_verdict": FactoidQAGenerator,
        "hypothetical": HypotheticalQAGenerator
    }
    
    @staticmethod
    def get_generator(question_type: str, single_data: SingleData) -> BaseQAGenerator:
        if question_type not in QAGeneratorFactory._generators:
            raise ValueError(f"Unknown question type: {question_type}")
        
        generator_class = QAGeneratorFactory._generators[question_type]
        return generator_class(single_data)
    
    @staticmethod
    def get_all_generators(single_data: SingleData) -> list[BaseQAGenerator]:
        return [
            generator_class(single_data) 
            for generator_class in QAGeneratorFactory._generators.values()
        ]
    
