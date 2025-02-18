from src.pipeline import Pipeline
from src.processors.chart_generator import VegaLiteGenerator
from src.processors.svg_processor import SVGOptimizer
from src.processors.data_processor import Chart2TableDataProcessor
import os
import json

class CustomDataProcessor(Chart2TableDataProcessor):
    def __init__(self, chart_type='area'):
        super().__init__()
        self.chart_type = chart_type
        
    def process(self, raw_data: str, layout_sequence: list, chart_image_sequence: list, matcher=None):
        # 调用父类的处理方法
        processed_data = super().process(raw_data, layout_sequence, chart_image_sequence, matcher)
        
        # 设置图表类型
        processed_data['meta_data']['chart_type'] = self.chart_type
        
        return processed_data

def generate_chart(input_data, chart_type, output_filename):
    # 创建pipeline
    pipeline = Pipeline(
        data_processor=CustomDataProcessor(chart_type),
        chart_generator=VegaLiteGenerator(),
        svg_processor=SVGOptimizer()
    )

    # 生成图表
    result, bounding_boxes = pipeline.execute(
        input_data=input_data,
        layout_file_idx=1,
        chart_image_idx=1,
        color_mode='monochromatic'
    )

    # 保存结果
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, output_filename)
    with open(output_path, 'w') as f:
        f.write(result)

def main():
    # 使用 line 类型的数据
    input_data = "line_8"

    # 生成五种不同类型的图表
    chart_configs = [
        ('line', 'line_chart.svg'),  # 添加line chart
        ('area', 'area_chart.svg'),
        ('layeredarea', 'layered_area_chart.svg'),
        ('stream', 'stream_chart.svg'),
        ('rangedarea', 'ranged_area_chart.svg')
    ]

    # 依次生成每种类型的图表
    for chart_type, output_filename in chart_configs:
        print(f"生成 {chart_type} 图表...")
        generate_chart(input_data, chart_type, output_filename)
        print(f"{chart_type} 图表已保存为 {output_filename}")

if __name__ == "__main__":
    main()