from typing import Any
import json
from .interfaces.base import DataProcessor, ChartGenerator, SVGProcessor
from .template.template import *
from .template.color_template import ColorDesign
from .template.font_template import FontDesign
from .template.gpt_chart_parser import ChartDesign
import shutil
import random
import time


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

    def execute(self, input_data: Any, layout_file_idx: int = 1, chart_image_idx: int = 1, chart_component_idx: int = 1, color_mode: str = 'monochromatic') -> str:
        try:
            with open(f'/data1/liduan/generation/chart/chart_pipeline/src/data/layout_tree/{layout_file_idx}.json', 'r') as f:
                layout_config = json.load(f)
            with open(f'/data1/liduan/generation/chart/chart_pipeline/src/data/chart_image/{chart_image_idx}.json', 'r') as f:
                chart_image_config = json.load(f)
            with open(f'/data1/liduan/generation/chart/chart_pipeline/src/data/chart_component/{chart_component_idx}.json', 'r') as f:
                chart_component_config = json.load(f)
            
            time_start = time.time()
            # 步骤1：数据处理
            processed_data = self.data_processor.process(input_data, layout_config['sequence'], chart_image_config['sequence'])
            time_end = time.time()
            
            # 从布局树文件随机选择一个配置文件
            time_start = time.time()

            color_template = ColorDesign(processed_data['palettes'], mode=color_mode)
            
            layout_tree = layout_config['layout_tree']
            chart_config = layout_config.get('chart_config', {})
            title_config = layout_config.get('title_config', {})
            subtitle_config = layout_config.get('subtitle_config', {})
            topic_icon_config = layout_config.get('topic_icon_config', {})
            sort_config = None
            
            # 创建模板
            if processed_data['meta_data']['chart_type'] == 'bar':
                # 如果没有指定orientation,随机选择
                if 'orientation' not in chart_config:
                    is_horizontal = random.choice([True, False])
                else:
                    is_horizontal = chart_config['orientation'] == 'horizontal'
                
                # 只有在chart_config中指定了sort时才配置排序
                # is_horizontal = False
                if 'sort' in chart_config:
                    sort_config = {
                        "by": "x" if is_horizontal else "y",  # 水平图按x轴排序,垂直图按y轴排序
                        "ascending": False  # 默认降序
                    }
                    sort_config.update(chart_config['sort'])
                
                # 使用新的工厂方法创建模板
                if is_horizontal:
                    chart_template, layout_template = TemplateFactory.create_horizontal_bar_chart_template(
                        data=processed_data['data'],
                        meta_data=processed_data['meta_data'],
                        layout_tree=layout_tree,
                        chart_composition=chart_image_config,
                        sort_config=sort_config,
                        color_template=color_template,
                        chart_component=chart_component_config
                    )
                else:
                    chart_template, layout_template = TemplateFactory.create_vertical_bar_chart_template(
                        data=processed_data['data'],
                        meta_data=processed_data['meta_data'],
                        layout_tree=layout_tree,
                        chart_composition=chart_image_config,
                        sort_config=sort_config,
                        color_template=color_template,
                        chart_component=chart_component_config
                    )
                
                # 获取柱子宽度比例
                chart_design = ChartDesign()
                chart_design.image_path = ""
                bar_ratio = chart_design.get_bar_ratio()
                if is_horizontal:
                    chart_template.mark.height = bar_ratio['bar_band_ratio']
                else:
                    chart_template.mark.width = bar_ratio['bar_band_ratio']
            elif processed_data['meta_data']['chart_type'] == 'line':
                chart_template, layout_template = TemplateFactory.create_line_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'bump':
                chart_template, layout_template = TemplateFactory.create_bump_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'scatter':
                chart_template, layout_template = TemplateFactory.create_scatterplot_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'groupbar':
                chart_template, layout_template = TemplateFactory.create_group_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'slope':
                chart_template, layout_template = TemplateFactory.create_slope_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'connectedscatter':
                chart_template, layout_template = TemplateFactory.create_connected_scatterplot_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'stackedbar':
                chart_template, layout_template = TemplateFactory.create_stacked_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'bubble':
                chart_template, layout_template = TemplateFactory.create_bubble_plot_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'radialbar':
                chart_template, layout_template = TemplateFactory.create_radial_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'radialhistogram':
                chart_template, layout_template = TemplateFactory.create_radial_histogram_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            elif processed_data['meta_data']['chart_type'] == 'polararea':
                chart_template, layout_template = TemplateFactory.create_polar_area_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    layout_tree=layout_tree,
                    chart_composition=chart_image_config,
                    sort_config=sort_config,
                    color_template=color_template,
                    chart_component=chart_component_config
                )
            else:
                raise ValueError(f"不支持的图表类型: {processed_data['meta_data']['chart_type']}")
            
            # 步骤2：生成图表
            svg, additional_configs = self.chart_generator.generate(processed_data, chart_template)
            time_end = time.time()
            print("chart_generator time: ", time_end - time_start)
            
            return svg    
            
            
            time_start = time.time()
            
            title_config = {}
            title_font_template = TitleFontTemplate()
            title_font_template.large()
            title_config['fontSize'] = title_font_template.font_size
            title_config['linePadding'] = title_font_template.line_height-title_font_template.font_size
            title_config['letterSpacing'] = title_font_template.letter_spacing
            title_config['fontWeight'] = title_font_template.font_weight
            title_config['font'] = title_font_template.font
            
            subtitle_config = {}
            subtitle_font_template = BodyFontTemplate()
            subtitle_font_template.middle()
            subtitle_config['fontSize'] = subtitle_font_template.font_size
            subtitle_config['linePadding'] = 0
            subtitle_config['letterSpacing'] = subtitle_font_template.letter_spacing
            subtitle_config['fontWeight'] = subtitle_font_template.font_weight
            subtitle_config['font'] = subtitle_font_template.font
            
            # 配置额外信息
            additional_configs.update({
                "title_config": {"text": processed_data['meta_data']['title']},
                "subtitle_config": {"text": processed_data['meta_data']['caption']},
                "topic_icon_config": {},
                "background_config": {},
                "topic_icon_url": processed_data['icons']['topic'][0] if len(processed_data['icons']['topic']) > 0 else None,
                # "x_label_icon_url": processed_data['icons']['x_label'][0],
                # "y_label_icon_url": processed_data['icons']['y_label'][0],
                'x_data_single_url': processed_data['icons']['x_data_single'][0] if len(processed_data['icons']['x_data_single']) > 0 else None,
                # "x_data_multi_url": [icon[i] for i, icon in enumerate(processed_data['icons']['x_data_multi'])],
                "x_data_multi_url": processed_data['icons']['x_data_multi'],
                "x_data_multi_icon_map": processed_data['x_data_multi_icon_map'],
                "layout_template": layout_template,
                "chart_composition": chart_image_config,
                "chart_template": chart_template,
                "meta_data": processed_data['meta_data']
            })
            additional_configs['title_config'].update(title_config)
            additional_configs['subtitle_config'].update(subtitle_config)
            additional_configs['topic_icon_config'].update(topic_icon_config)

            # print("additional_configs['title_config']", additional_configs['title_config'])
            seed_text = random.randint(1, 100)
            # 配置颜色
            title_color,subtitle_color = color_template.get_color('text', 2)
            additional_configs['title_config']['color'] = title_color
            additional_configs['subtitle_config']['color'] = subtitle_color
            additional_configs['background_config']['color'] = color_template.get_color('background', 1)[0]
            # 步骤3：SVG后处理
            final_svg = self.svg_processor.process(svg, additional_configs, debug=False)
            time_end = time.time()
            print("svg_processor time: ", time_end - time_start)
            
            return final_svg
            
        except Exception as e:
            raise Exception(f"Pipeline执行失败: {str(e)}")