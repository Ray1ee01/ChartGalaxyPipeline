from typing import Any
import json
from .interfaces.base import DataProcessor, ChartGenerator, SVGProcessor
from .template.template import TemplateFactory
from .template.color_template import ColorDesign
from .template.font_template import FontDesign
from .template.gpt_chart_parser import ChartDesign
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
            
            # 从布局树文件随机选择一个配置文件
            import random
            # layout_file_idx = random.randint(1, 8)
            layout_file_idx = 7
            with open(f'/data1/liduan/generation/chart/chart_pipeline/src/data/layout_tree/{layout_file_idx}.json', 'r') as f:
                layout_config = json.load(f)
            chart_image_idx = 1
            with open(f'/data1/liduan/generation/chart/chart_pipeline/src/data/chart_image/{chart_image_idx}.json', 'r') as f:
                chart_image_config = json.load(f)
            
            color_template = ColorDesign(None)
            
            layout_tree = layout_config['layout_tree']
            chart_config = layout_config.get('chart_config', {})
            title_config = layout_config.get('title_config', {})
            subtitle_config = layout_config.get('subtitle_config', {})
            topic_icon_config = layout_config.get('topic_icon_config', {})
            # 创建模板
            if processed_data['meta_data']['chart_type'] == 'bar':
                # 如果没有指定orientation,随机选择
                import random
                if 'orientation' not in chart_config:
                    is_horizontal = random.choice([True, False])
                else:
                    is_horizontal = chart_config['orientation'] == 'horizontal'
                
                # 只有在chart_config中指定了sort时才配置排序
                sort_config = None
                if 'sort' in chart_config:
                    sort_config = {
                        "by": "x" if is_horizontal else "y",  # 水平图按x轴排序,垂直图按y轴排序
                        "ascending": False  # 默认降序
                    }
                    sort_config.update(chart_config['sort'])
                
                # 使用新的工厂方法创建模板
                if is_horizontal:
                    chart_template, layout_template = TemplateFactory.create_horizontal_bar_chart_template(
                        meta_data=processed_data['meta_data'],
                        layout_tree=layout_tree,
                        chart_composition=chart_image_config,
                        sort_config=sort_config,
                        color_template=color_template
                    )
                else:
                    chart_template, layout_template = TemplateFactory.create_vertical_bar_chart_template(
                        meta_data=processed_data['meta_data'],
                        layout_tree=layout_tree,
                        chart_composition=chart_image_config,
                        sort_config=sort_config,
                        color_template=color_template
                    )
                
                # 获取柱子宽度比例
                chart_design = ChartDesign()
                bar_ratio = chart_design.get_bar_ratio()
                print("bar_ratio: ", bar_ratio)
                if is_horizontal:
                    chart_template.mark.height = bar_ratio['bar_band_ratio']
                else:
                    chart_template.mark.width = bar_ratio['bar_band_ratio']
                # print(bar_ratio)
            else:
                raise ValueError(f"不支持的图表类型: {processed_data['meta_data']['chart_type']}")

            font_design = FontDesign()
            font_sizes = font_design.get_font()
            
            chart_template.x_axis.label_font_style.font_size = font_sizes['axis_label']
            chart_template.y_axis.label_font_style.font_size = font_sizes['axis_label']
            title_config['fontSize'] = font_sizes['title']
            title_config['linePadding'] = font_sizes['title_line_padding']
            subtitle_config['fontSize'] = font_sizes['subtitle']
            subtitle_config['linePadding'] = font_sizes['subtitle_line_padding']
            
            # 步骤2：生成图表
            svg, additional_configs = self.chart_generator.generate(processed_data, chart_template)
            
            # return svg
            
            
            # 配置额外信息
            additional_configs.update({
                "title_config": {"text": processed_data['meta_data']['title']},
                "subtitle_config": {"text": processed_data['meta_data']['caption']},
                "topic_icon_config": {},
                "background_config": {},
                "topic_icon_url": processed_data['icons']['topic'][0],
                "x_label_icon_url": processed_data['icons']['x_label'][0],
                "y_label_icon_url": processed_data['icons']['y_label'][0],
                'x_data_single_url': processed_data['icons']['x_data_single'][0],
                "x_data_multi_url": [icon[i] for i, icon in enumerate(processed_data['icons']['x_data_multi'])],
                "layout_template": layout_template,
                "chart_composition": chart_image_config,
                "chart_template": chart_template
            })
            additional_configs['title_config'].update(title_config)
            additional_configs['subtitle_config'].update(subtitle_config)
            additional_configs['topic_icon_config'].update(topic_icon_config)

            print("additional_configs['title_config']", additional_configs['title_config'])
            # 配置颜色
            title_color,subtitle_color = color_template.get_color('text', 2)
            additional_configs['title_config']['color'] = title_color
            additional_configs['subtitle_config']['color'] = subtitle_color
            additional_configs['background_config']['color'] = color_template.get_color('background', 1)[0]
            # 步骤3：SVG后处理
            final_svg = self.svg_processor.process(svg, additional_configs, debug=False)
            
            return final_svg
            
        except Exception as e:
            raise Exception(f"Pipeline执行失败: {str(e)}")