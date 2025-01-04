from typing import Any
from .interfaces.base import DataProcessor, ChartGenerator, SVGProcessor
from .template.template import ChartTemplateFactory

class Pipeline:
    def __init__(
        self,
        data_processor: DataProcessor,
        chart_generator: ChartGenerator,
        svg_processor: SVGProcessor
    ):
        self.data_processor = data_processor
        self.chart_generator = chart_generator
        self.svg_processor = svg_processor

    def execute(self, input_data: Any) -> str:
        try:
            # 步骤1：数据处理
            processed_data = self.data_processor.process(input_data)
            
            chart_type = 'BarChart'
            # 步骤2：生成图表
            chart_template_factory = ChartTemplateFactory()
            chart_template = chart_template_factory.create_template(chart_type)
            print(chart_template.dump())
            return ""
            svg, additional_configs = self.chart_generator.generate(processed_data)
            
            # 步骤3：SVG后处理
            final_svg = self.svg_processor.process(svg, additional_configs, debug=False)
            
            return final_svg
            
        except Exception as e:
            raise Exception(f"Pipeline执行失败: {str(e)}")