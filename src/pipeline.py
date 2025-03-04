from typing import Any
import json
from .interfaces.base import DataProcessor, ChartGenerator, SVGProcessor
from .template.template import *
from .processors.data_enricher_modules.topic_generate import find_emphasis_phrases
from .template.style_template.base import TitleFontTemplate, BodyFontTemplate
from .template.color_template import ColorDesign
from .template.font_template import FontDesign
from .template.gpt_chart_parser import ChartDesign
from .utils.color_statics import EmphasisColors
import shutil
import random
import time
from .processors.data_enricher_modules.icon_selection import CLIPMatcher
from .processors.data_enricher_modules.bgimage_selection import ImageSearchSystem
from .data.config.config import update_configs

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

    def execute(self, input_data: Any, config: dict, matcher: CLIPMatcher = None, bgimage_searcher: ImageSearchSystem = None) -> str:
        # try:
        # with open(f'/data1/liduan/generation/chart/chart_pipeline/src/data/layout_tree copy/{config['layout']}.json', 'r') as f:
        #     layout_config = json.load(f)
        layout_config = config['layout']
        icon_config = config['icon']
        legend_config = config['legend']
        color_config = config['color']['mode']
        axis_config = {
            "x_axis": config['x_axis'],
            "y_axis": config['y_axis']
        }
        
        time_start = time.time()
        # 步骤1：数据处理
        processed_data = self.data_processor.process(input_data, layout_config['sequence'], icon_config['need_icon'], matcher, bgimage_searcher)
        config = update_configs(config, processed_data['meta_data'])
        print("config: ", config)
        time_end = time.time()
        print("processed_data: ", processed_data)
    
    
        time_start = time.time()
        color_template = ColorDesign(processed_data['palettes'], mode=color_config)
        
        layout_tree = layout_config['layout_tree']
        chart_config = layout_config.get('chart_config', {})
        title_config = layout_config.get('title_config', {})
        subtitle_config = layout_config.get('subtitle_config', {})
        topic_icon_config = layout_config.get('topic_icon_config', {})
        sort_config = layout_config.get('sort_config', {})
        # axis_config = layout_config.get('axis_config', {})
        annotation_config = config.get('annotation', {})
        # 创建模板
        print("processed_data['meta_data']['chart_type']", processed_data['meta_data']['chart_type'])
        if processed_data['meta_data']['chart_type'] == 'bar':
            if 'orientation' not in chart_config:
                is_horizontal = random.choice([True, False])
            else:
                is_horizontal = chart_config['orientation'] == 'horizontal'
            if "orientation" in processed_data['meta_data']:
                is_horizontal = processed_data['meta_data']['orientation'] == 'horizontal'
            else:
                is_horizontal = random.choice([True, False])


            # 使用新的工厂方法创建模板
            if is_horizontal:
                chart_template, layout_template = TemplateFactory.create_horizontal_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
                )
            else:
                chart_template, layout_template = TemplateFactory.create_vertical_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
                )
        elif processed_data['meta_data']['chart_type'] == 'line':
            chart_template, layout_template = TemplateFactory.create_line_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'bump':
            chart_template, layout_template = TemplateFactory.create_bump_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'scatter':
            chart_template, layout_template = TemplateFactory.create_scatterplot_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'proportionalarea':
            chart_template, layout_template = TemplateFactory.create_proportional_area_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'groupbar':
            chart_template, layout_template = TemplateFactory.create_group_bar_chart_template(
                data=processed_data['data'],
                meta_data=processed_data['meta_data'],
                color_template=color_template,
                config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'slope':
            chart_template, layout_template = TemplateFactory.create_slope_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'connectedscatter':
            chart_template, layout_template = TemplateFactory.create_connected_scatterplot_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'stackedbar':
            chart_template, layout_template = TemplateFactory.create_stacked_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'bubble':
            chart_template, layout_template = TemplateFactory.create_bubble_plot_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'radialbar':
            chart_template, layout_template = TemplateFactory.create_radial_bar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'pie':
            chart_template, layout_template = TemplateFactory.create_pie_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'donut':
            chart_template, layout_template = TemplateFactory.create_donut_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'bullet':
            chart_template, layout_template = TemplateFactory.create_bullet_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'radar':
            chart_template, layout_template = TemplateFactory.create_radar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'radialline':
            chart_template, layout_template = TemplateFactory.create_radial_line_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'radialarea':
            chart_template, layout_template = TemplateFactory.create_radial_area_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'polar':
            chart_template, layout_template = TemplateFactory.create_polar_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'radialhistogram':
            chart_template, layout_template = TemplateFactory.create_radial_histogram_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'polararea':
                chart_template, layout_template = TemplateFactory.create_polar_area_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
                )
        elif processed_data['meta_data']['chart_type'] == 'area':
            chart_template, layout_template = TemplateFactory.create_area_chart_template(
                data=processed_data['data'],
                meta_data=processed_data['meta_data'],
                color_template=color_template,
                config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'layeredarea':
            chart_template, layout_template = TemplateFactory.create_layered_area_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'semicircledonut':
            chart_template, layout_template = TemplateFactory.create_semi_circle_donut_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'multilevelpie':
            chart_template, layout_template = TemplateFactory.create_multi_level_pie_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'multileveldonut':
            chart_template, layout_template = TemplateFactory.create_multi_level_donut_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        elif processed_data['meta_data']['chart_type'] == 'stream':
                chart_template, layout_template = TemplateFactory.create_stream_graph_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
                )
        elif processed_data['meta_data']['chart_type'] == 'rangedarea':
            chart_template, layout_template = TemplateFactory.create_ranged_area_chart_template(
                    data=processed_data['data'],
                    meta_data=processed_data['meta_data'],
                    color_template=color_template,
                    config=config
            )
        else:
            raise ValueError(f"不支持的图表类型: {processed_data['meta_data']['chart_type']}")
        
        
        # 获取主题色
        theme_color = "#0000ff"
        try: 
            theme_color = chart_template.color_encoding.range[0]
        except:
            theme_color = "#0000ff"
        
        
        # 步骤2：生成图表
        svg, additional_configs = self.chart_generator.generate(processed_data, chart_template, config)
        # print('svg: ', svg)
        time_end = time.time()
        print("chart_generator time: ", time_end - time_start)
        
        # return svg,{}
        
        
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
    
        # emphasis_phrases = find_emphasis_phrases(processed_data['meta_data']['title'], processed_data['meta_data'])
        emphasis_phrases = []
        emphasis_phrases_config = []
        if chart_template.color_encoding is not None and chart_template.color_encoding.color_with_semantics:
            for phrase in emphasis_phrases:
                color = chart_template.color_encoding.find_color_by_semantics(phrase)
                emphasis_phrases_config.append({
                    "text": phrase,
                    "color": color
                })
        else:
            for phrase in emphasis_phrases:
                emphasis_phrases_config.append({
                    # "text": phrase,
                    #去除phrase首尾的双引号（如果有）
                    "text": phrase.strip('"'),
                    "color": EmphasisColors().get_color()
                })
        print("emphasis_phrases_config: ", emphasis_phrases_config)
        
        # 配置额外信息
        additional_configs.update({
            "title_config": {"text": processed_data['meta_data']['title']},
            "subtitle_config": {"text": processed_data['meta_data']['caption']},
            "topic_icon_config": {},
            "background_config": {},
            "topic_icon_url": processed_data['icons']['topic'][0] if len(processed_data['icons']['topic']) > 0 else None,
            'x_data_single_url': processed_data['icons']['x_data_single'][0] if len(processed_data['icons']['x_data_single']) > 0 else None,
            "x_data_multi_url": processed_data['icons']['x_data_multi'],
            "background_image": {"url": processed_data['icons']['background_image']},
            "x_data_multi_icon_map": processed_data['x_data_multi_icon_map'],
            "layout_template": layout_template,
            "annotation_config": annotation_config,
            "chart_template": chart_template,
            "meta_data": processed_data['meta_data'],
            "data": processed_data['data'],
            "chart_config": chart_config,
            "chart_type": processed_data["meta_data"]["chart_type"],
            "theme_color": theme_color
        })
        additional_configs['title_config'].update(title_config)
        additional_configs['subtitle_config'].update(subtitle_config)
        additional_configs['topic_icon_config'].update(topic_icon_config)

        # print("additional_configs['title_config']", additional_configs['title_config'])
        seed_text = random.randint(1, 100)
        # 配置颜色
        # title_color,subtitle_color = color_template.get_color('text', 2)
        # additional_configs['title_config']['color'] = title_color
        additional_configs['title_config']['color'] = "#0f2740"
        # additional_configs['subtitle_config']['color'] = subtitle_color
        additional_configs['subtitle_config']['color'] = "#445f7c"
        # additional_configs['background_config']['color'] = color_template.get_color('background', 1)[0]
        additional_configs['background_config']['color'] = "#ffffff"
        
        additional_configs['layout_tree'] = layout_tree
        additional_configs.update(config)
        # 步骤3：SVG后处理
        
        print("before svg_processor.process")
        final_svg, bounding_boxes = self.svg_processor.process(svg, additional_configs, debug=False)
        # final_svg = svg
        bounding_boxes = {}
        # 这里的修改是为了暂时调试
        time_end = time.time()
        return final_svg, bounding_boxes
            