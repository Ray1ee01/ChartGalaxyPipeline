from model.closeQA import *
from model.openQA import *
from model.infographicsQA import *
from model.base import SingleData, BaseQAGenerator

class QAGeneratorFactory:
    """ QA 生成器工厂 """
    
    _generators = {
        # "data_retrieval": DataRetrievalQAGenerator,
        # "compositional": CompositionalQAGenerator,
        "visual": VisualQAGenerator,
        "visual_compositional": VisualCompositionalQAGenerator,

        "identify": IdentifyQAGenerator,
        "summarize": SummarizeQAGenerator,
        "compare": CompareQAGenerator,
        "discover": DiscoverQAGenerator,

        "summarization_narration": SummarizationNarrationQAGenerator
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
    

# import json
# if __name__ == "__main__":
#     with open("/data1/lizhen/resources/result/data_pool_v2/11592.json", "r", encoding="utf-8") as f:
#         data = json.load(f)
#     tabular_data = data["data"]
#     meta_data = data["metadata"]

#     single_data = SingleData(tabular_data, meta_data, "/home/lizhen/ChartPipeline/evaluate/instruction_generation/image.png")
#     factory = QAGeneratorFactory()
#     generators = factory.get_all_generators(single_data)

#     all_results = []

#     for generator in generators:
#         res = generator.generate()
#         all_results.extend(res.to_dict()["qa_pairs"])

#     with open("output.json", "w", encoding="utf-8") as f:
#         json.dump(all_results, f, indent=2, ensure_ascii=False)
