from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate, PolarSetting, AngleAxisTemplate, RadiusAxisTemplate
from ..mark_template.bar import BarTemplate
from ..color_template import ColorDesign
import random
from typing import Dict
class BarChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bar"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None, config: Dict=None):
        
        self.config = config
        
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.orientation = self.config.get('x_axis_orient', {}).get('orient', None)
        
        self.y_axis = self.x_axis.copy()
        self.y_axis.orientation = self.config.get('y_axis_orient', {}).get('orient', None)
        
        mark_config = self.config.get('mark', {}).get('bar', {})
        self.mark = BarTemplate(color_template, mark_config)
        
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
        print(self.color_encoding.dump())

        if meta_data is None:
            # set default value
            self.x_axis.field = "category"
            self.x_axis.field_type = "nominal"
            
            self.y_axis.field = "value"
            self.y_axis.field_type = "quantitative"
        else:
            if meta_data['x_type'] == "categorical":
                meta_data['x_type'] = "nominal"
            elif meta_data['x_type'] == "numerical":
                meta_data['x_type'] = "quantitative"
            if meta_data['y_type'] == "categorical":
                meta_data['y_type'] = "nominal"
            elif meta_data['y_type'] == "numerical":
                meta_data['y_type'] = "quantitative"
                
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
            
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']
    
    def update_specification(self, specification: dict) -> None:
        """更新规范的基础实现"""
        encoding = specification["encoding"]
        mark_specification = specification["mark"]
        
        # 设置基本的mark属性
        mark_specification["height"] = self.mark.height
        mark_specification["width"] = self.mark.width
        if self.mark.corner_radius:
            specification["mark"]["cornerRadius"] = self.mark.corner_radius

        # 创建注释规范
        annotation_specification = self._create_annotation_specification()
        
        # 处理方向相关的配置
        if self.mark.orientation == "horizontal":
            self._apply_horizontal_orientation(encoding, mark_specification)
            self._configure_horizontal_annotation(annotation_specification)
        else:
            self._configure_vertical_annotation(annotation_specification)

        # 处理排序
        self._apply_sort_configuration(encoding)
        
        specification["encoding"] = encoding
        
        # 添加图层
        if self.has_annotation:
            specification["layer"] = [
                {"mark": mark_specification, "encoding": encoding},
                annotation_specification
            ]
        else:
            specification["layer"] = [{"mark": mark_specification}]
        
        return specification

    def _create_annotation_specification(self) -> dict:
        """创建基础的注释规范"""
        annotation_spec = {
            "mark": {
                "type": "text",
            },
            "encoding": {
                "text": {
                    "field": self.y_axis.field,
                    "type": self.y_axis.field_type
                },
            }
        }
        
        # 配置文本样式
        text_config = annotation_spec["mark"]
        if self.mark.annotation_font_style.font is not None:
            text_config["font"] = self.mark.annotation_font_style.font
        if self.mark.annotation_font_style.font_size is not None:
            text_config["fontSize"] = self.mark.annotation_font_style.font_size
        if self.mark.annotation_font_style.font_weight is not None:
            text_config["fontWeight"] = self.mark.annotation_font_style.font_weight
        if self.mark.annotation_color_style.color is not None:
            text_config["fill"] = self.mark.annotation_color_style.color
            
        return annotation_spec

    def _apply_horizontal_orientation(self, encoding: dict, mark_specification: dict) -> None:
        """应用水平方向的编码设置"""
        encoding["x"], encoding["y"] = encoding["y"], encoding["x"]
        mark_specification["orient"] = "horizontal"

    def _configure_horizontal_annotation(self, annotation_specification: dict) -> None:
        """配置水平方向的注释位置"""
        side = self.config.get('annotation', {}).get('annotation_side', "outer")
        if self.x_axis.orientation == "left" and side == "outer":
            annotation_specification["mark"]["align"] = "left"
            annotation_specification["mark"]["dx"] = 5
        elif self.x_axis.orientation == "left" and side == "inner":
            annotation_specification["mark"]["align"] = "right"
            annotation_specification["mark"]["dx"] = -5
        elif self.x_axis.orientation == "right" and side == "outer":
            annotation_specification["mark"]["align"] = "right"
            annotation_specification["mark"]["dx"] = -5
        else:
            annotation_specification["mark"]["align"] = "left"
            annotation_specification["mark"]["dx"] = 5

    def _configure_vertical_annotation(self, annotation_specification: dict) -> None:
        """配置垂直方向的注释位置"""
        side = self.config.get('annotation', {}).get('annotation_side', "outer")
        if self.x_axis.orientation == "top" and side == "outer":
            annotation_specification["mark"]["baseline"] = "top"
            annotation_specification["mark"]["dy"] = 5
        elif self.x_axis.orientation == "top" and side == "inner":
            annotation_specification["mark"]["baseline"] = "bottom"
            annotation_specification["mark"]["dy"] = -5
        elif self.x_axis.orientation == "bottom" and side == "outer":
            annotation_specification["mark"]["baseline"] = "bottom"
            annotation_specification["mark"]["dy"] = -5
        else:
            annotation_specification["mark"]["baseline"] = "top"
            annotation_specification["mark"]["dy"] = 5

    def _apply_sort_configuration(self, encoding: dict) -> None:
        """应用排序配置"""
        if self.config.get('layout', {}).get('chart_config', {}).get('sort', {}):
            sort_config = self.config.get('layout', {}).get('chart_config', {}).get('sort', {})
            if sort_config.get('by', 'y') == 'x':
                encoding["y"]["sort"] = "-x" if sort_config.get('ascending', True) else "x"
            else:
                encoding["x"]["sort"] = "y" if sort_config.get('ascending', True) else "-y"

    def dump(self):
        result = {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }
        
        # 添加排序配置到输出
        if self.sort is not None:
            result["sort"] = self.sort
            
        return result
    
class VerticalBarChartConstraint(LayoutConstraint):
    """垂直柱状图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.x_axis.field_type = "nominal"
        chart_template.y_axis.orientation = "left"
        chart_template.y_axis.field_type = "quantitative"
        chart_template.mark.orientation = "vertical"

class HorizontalBarChartConstraint(LayoutConstraint):
    """水平柱状图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "horizontal"
        chart_template.x_axis.orientation = "left"
        chart_template.x_axis.field_type = "nominal"
        chart_template.y_axis.orientation = "top"
        chart_template.y_axis.field_type = "quantitative"
        chart_template.mark.orientation = "horizontal"
class GroupBarChartTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "groupbar"
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None, config: dict=None):
        super().create_template(data, meta_data, color_template, config)
        
    def update_specification(self, specification: dict) -> None:
        """分组柱状图特有的规范更新"""
        # 添加分组偏移设置
        encoding = specification["encoding"]
        if self.mark.orientation == "horizontal":
            encoding["yOffset"] = {"field": "group"}
        else:
            encoding["xOffset"] = {"field": "group"}
            
        # 调用父类的实现来处理通用部分
        result = super().update_specification(specification)
        
        return result
        
        
class StackedBarChartTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "stackedbar"
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        
    def update_specification(self, specification: dict) -> None:
        # 这里是bar chart相关的配置，通用配置放在chart generator中    
        """更新规范"""
        encoding = specification["encoding"]
        mark_specification = specification["mark"]
        if self.mark.orientation == "horizontal":
            encoding["xOffset"] = {"field": "group"}
        else:
            encoding["yOffset"] = {"field": "group"}
            
        corner_radiuses = {}
        for key, value in self.mark.corner_radiuses.items():
            if value is not None:
                corner_radiuses[key] = value
        if corner_radiuses:
            specification["mark"]["cornerRadius"] = corner_radiuses

        
        annotation_specification = {
            "mark": {
                "type": "text",
            },
            "encoding": {
                "text": {
                    "field": self.y_axis.field,
                    "type": self.y_axis.field_type
                },
            }
        }
        text_config = annotation_specification["mark"]
        if self.mark.annotation_font_style.font is not None:
            text_config["font"] = self.mark.annotation_font_style.font
        if self.mark.annotation_font_style.font_size is not None:
            text_config["fontSize"] = self.mark.annotation_font_style.font_size
        if self.mark.annotation_font_style.font_weight is not None:
            text_config["fontWeight"] = self.mark.annotation_font_style.font_weight
        if self.mark.annotation_color_style.color is not None:
            text_config["fill"] = self.mark.annotation_color_style.color
        
        if self.mark.orientation == "horizontal":
            side = self.mark.annotation_side
            if self.x_axis.orientation == "left" and side == "outer":
                annotation_specification["mark"]["align"] = "left"
                annotation_specification["mark"]["dx"] = 5
            elif self.x_axis.orientation == "left" and side == "inner":
                annotation_specification["mark"]["align"] = "right"
                annotation_specification["mark"]["dx"] = -5
            elif self.x_axis.orientation == "right" and side == "outer":
                annotation_specification["mark"]["align"] = "right"
                annotation_specification["mark"]["dx"] = -5
            else:
                annotation_specification["mark"]["align"] = "left"
                annotation_specification["mark"]["dx"] = 5
        else:
            side = self.mark.annotation_side
            if self.x_axis.orientation == "top" and side == "outer":
                annotation_specification["mark"]["baseline"] = "top"
                annotation_specification["mark"]["dy"] = 5
            elif self.x_axis.orientation == "top" and side == "inner":
                annotation_specification["mark"]["baseline"] = "bottom"
                annotation_specification["mark"]["dy"] = -5
            elif self.x_axis.orientation == "bottom" and side == "outer":
                annotation_specification["mark"]["baseline"] = "bottom"
                annotation_specification["mark"]["dy"] = -5
            else:
                annotation_specification["mark"]["baseline"] = "top"
                annotation_specification["mark"]["dy"] = 5
        
        if self.mark.orientation == "horizontal":
            # 交换encoding中的x和y
            encoding["x"], encoding["y"] = encoding["y"], encoding["x"]
            mark_specification["orient"] = "horizontal"

        
        if self.sort:
            sort_config = {
                "by": self.sort["by"],
                "ascending": self.sort["ascending"]
            }
            if sort_config["by"] == "x":
                encoding["y"]["sort"] = "-x" if sort_config["ascending"] else "x"
            else:
                encoding["x"]["sort"] = "-y" if sort_config["ascending"] else "y"
        specification["encoding"] = encoding
        
        if self.has_annotation:
            specification["layer"] = [
                {"mark": mark_specification, "encoding": encoding},
                annotation_specification
            ]
        else:
            specification["layer"] = [{"mark": mark_specification}]
        
        return specification    

        
class GroupBarChartConstraint(LayoutConstraint):
    """组柱状图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, GroupBarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        # 随机apply VerticalBarChartConstraint或HorizontalBarChartConstraint        
        # if random.random() < 0.5:
        VerticalBarChartConstraint().apply(chart_template)
        # else:
        #     HorizontalBarChartConstraint().apply(chart_template)
        # chart_template.mark.orientation = "horizontal"
        # chart_template.x_axis.orientation = "left"
        # chart_template.x_axis.field_type = "nominal"
        # chart_template.y_axis.orientation = "top"
        # chart_template.y_axis.field_type = "quantitative"

class StackedBarChartConstraint(LayoutConstraint):
    """堆叠柱状图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, StackedBarChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        # 随机apply VerticalBarChartConstraint或HorizontalBarChartConstraint        
        if random.random() < 0.5:
            VerticalBarChartConstraint().apply(chart_template)
        else:
            HorizontalBarChartConstraint().apply(chart_template)
    
    
class BulletChartTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bullet"
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        self.data = data
        self.meta_data = meta_data
        
    def update_specification(self, specification: dict) -> None:
        # 这里是bar chart相关的配置，通用配置放在chart generator中    
        """更新规范"""
        encoding = specification["encoding"]
        mark_specification = specification["mark"]
        mark_specification["height"] = {"band": 0.8}
        mark_specification["encoding"] = {
            "x": {
                "field": self.y_axis.field,
                "type": self.y_axis.field_type,
            }
        }
        
        
        # only for test: update data
        x_data_key = self.x_axis.field
        y_data_key = self.y_axis.field
        y_data_list = []
        y_data_min = 0
        y_data_max = 0
        print(self.data)
        for item in self.data:
            y_data_list.append(item['y_data'])
            # y_data_min = min(y_data_min, item[y_data_key])
            y_data_max = max(y_data_max, item['y_data'])
        range_percentages = [0.6, 0.8]
        for item in self.data:
            item['ranges'] = [y_data_max*(range_percentages[0] + random.random()), y_data_max*(range_percentages[1] + random.random()),1]
        # replace 'x_data' and 'y_data' in self.data 
        specification["data"]["values"] = self.data
        specification["facet"] = {
            "row": {
                "field": self.x_axis.field,
                "type": "ordinal",
            }
        }
        specification["spacing"] = 10
        
        specification["spec"] ={
            "encoding": {
                "x": {
                    "type": "quantitative",
                    "scale": {"nice": False},
                    "title": None
                },
            }
        }
        
        specification["spec"]["layer"] = [
            {
                "mark": {
                    "type": "bar",
                    "color": "#eee",
                },
                "encoding": {
                    "x": {
                        "field": "ranges[2]",
                    }
                }
            },
            {
                "mark": {
                    "type": "bar",
                    "color": "#ddd",
                },
                "encoding": {
                    "x": {
                        "field": "ranges[1]",
                    }
                }
            },
            {
                "mark": {
                    "type": "bar",
                    "color": "#ccc",
                },
                "encoding": {
                    "x": {
                        "field": "ranges[0]",
                    }
                }
            },
            {"mark": mark_specification},
        ]
        # 从specification中删除mark字段
        del specification["mark"]
        del specification["encoding"]
        
        specification["resolve"] = {
            "scale": {
                "x": "independent",
            }
        }
        return specification
        
class BulletChartConstraint(LayoutConstraint):
    """子弹图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BulletChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        HorizontalBarChartConstraint().apply(chart_template)
        
        # # 随机apply VerticalBarChartConstraint或HorizontalBarChartConstraint
        # if random.random() < 0.5:
        #     VerticalBarChartConstraint().apply(chart_template)
        # else:

class RadialBarChartTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "radialbar"
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        self.y_axis = AngleAxisTemplate(color_template)
        self.x_axis = RadiusAxisTemplate(color_template)
        self.polar_setting = PolarSetting()
        
    def update_specification(self, specification: dict) -> None:
        # super().update_specification(specification)
        raise NotImplementedError("RadialBarChartTemplate is not implemented")
    
    def update_option(self, echart_option: dict) -> None:
        self.echart_option = echart_option
        polar_setting = {
            "radius": [self.polar_setting.inner_radius, self.polar_setting.outer_radius],
        }
        angleAxis = {
            "startAngle": self.y_axis.start_angle,
            "endAngle": self.y_axis.end_angle,
            "clockwise": self.y_axis.clockwise,
        }
        radiusAxis = {
            "type": "category",
        }
        self.echart_option["polar"] = polar_setting
        self.echart_option["angleAxis"] = angleAxis
        self.echart_option["radiusAxis"] = radiusAxis
        
        self.echart_option["series"][0]["type"] = "bar"
        self.echart_option["series"][0]["coordinateSystem"] = "polar"
        self.echart_option["series"][0]["encode"] = {
            "angle": self.y_axis.field,
            "radius": self.x_axis.field,
        }
        
        return self.echart_option
    
class RadialHistogramTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "radialhistogram"
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        self.x_axis = AngleAxisTemplate(color_template)
        self.x_axis.field = "x_data"
        self.y_axis = RadiusAxisTemplate(color_template)
        self.y_axis.field = "y_data"
        self.polar_setting = PolarSetting()
        
    def update_specification(self, specification: dict) -> None:
        # super().update_specification(specification)
        raise NotImplementedError("RadialBarChartTemplate is not implemented")
    
    def update_option(self, echart_option: dict) -> None:
        self.echart_option = echart_option
        polar_setting = {
            "radius": [self.polar_setting.inner_radius, self.polar_setting.outer_radius],
        }
        angleAxis = {
            "startAngle": self.x_axis.start_angle,
            "endAngle": self.x_axis.end_angle,
            "clockwise": self.x_axis.clockwise,
            "type": "category",
        }
        radiusAxis = {
            # "type": "category",
        }
        self.echart_option["polar"] = polar_setting
        self.echart_option["angleAxis"] = angleAxis
        self.echart_option["radiusAxis"] = radiusAxis
        
        self.echart_option["series"][0]["type"] = "bar"
        self.echart_option["series"][0]["coordinateSystem"] = "polar"
        self.echart_option["series"][0]["encode"] = {
            "angle": self.x_axis.field,
            "radius": self.y_axis.field,
        }
        
class WaterfallChartTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "waterfall"
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        self.data = data
        self.meta_data = meta_data
        y_list = []
        current_y = 0
        for item in self.data:
            y_list.append(current_y)
            current_y += item['y_data']
        for i, item in enumerate(self.data):
            if i == 0:
                item["y_range0"] = 0
                item["y_range1"] = y_list[i]
            elif i == len(self.data) - 1:
                item["y_range0"] = 0
                item["y_range1"] = y_list[i]
            else:
                item["y_range0"] = y_list[i-1]
                item["y_range1"] = y_list[i]
        
    def update_specification(self, specification: dict) -> None:
        mark_specification = specification["mark"]
        encoding = specification["encoding"]
        encoding["y"] = {"field": "y_range0"}
        encoding["y2"] = {"field": "y_range1"}
        
        mark_specification["width"] = {"band": 0.8}
        return specification

class WaterfallChartConstraint(LayoutConstraint):
    """瀑布图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, WaterfallChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        
class PolarAreaChartTemplate(BarChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "polararea"
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        self.x_axis = AngleAxisTemplate(color_template)
        self.y_axis = RadiusAxisTemplate(color_template)
        self.polar_setting = PolarSetting()
        
    def update_specification(self, specification: dict) -> None:
        # super().update_specification(specification)
        raise NotImplementedError("RadialBarChartTemplate is not implemented")
    
    def update_option(self, echart_option: dict) -> None:
        self.echart_option = echart_option
        format_data = self.echart_option["dataset"]["source"]
        transformed_data = self.transform_data(format_data)
        self.echart_option["dataset"]["source"] = transformed_data
        polar_setting = {
            "radius": [self.polar_setting.inner_radius, self.polar_setting.outer_radius],
        }
        angleAxis = {
            "startAngle": self.x_axis.start_angle,
            "endAngle": self.x_axis.end_angle,
            "clockwise": self.x_axis.clockwise,
            "type": "category",
        }
        radiusAxis = {
        }
        self.echart_option["polar"] = polar_setting
        self.echart_option["angleAxis"] = angleAxis
        self.echart_option["radiusAxis"] = radiusAxis
        series = []
        for i in range(1, len(transformed_data[0])):
            series.append({
                "type": "bar",
                "coordinateSystem": "polar",
                "stack": "a",
            })
        self.echart_option["series"] = series
        self.echart_option["legend"] = {}
        # self.echart_option["series"][0]["type"] = "bar"
        # self.echart_option["series"][0]["coordinateSystem"] = "polar"
        # self.echart_option["series"][0]["encode"] = {
        #     "angle": self.x_axis.field,
        #     "radius": self.y_axis.field,
        # }
        
        return self.echart_option
    
    def transform_data(self, data: list) -> list:
        # 获取列名
        headers = data[0]  # ['x_data', 'y_data', 'group']
        
        # 获取所有的 'group' 值
        groups = sorted(set(row[2] for row in data[1:]))  # 去除重复的 group 值
        # 新的列头 ['x_data', '2012 value', '10-year average value']
        new_headers = ['x_data'] + groups
        
        # 创建一个字典来存储转换后的数据
        transformed_data = {group: [] for group in groups}
        transformed_data['x_data'] = []
        
        # 填充数据
        for row in data[1:]:
            x_data, y_data, group = row
            if x_data not in transformed_data['x_data']:
                transformed_data['x_data'].append(x_data)
            # 填入对应的 y_data
            transformed_data[group].append(y_data)
        
        # 创建二维数组，首先加入表头
        result = [new_headers]
        
        # 将数据按行填入二维数组
        for i in range(len(transformed_data['x_data'])):
            row = [transformed_data['x_data'][i]]
            for group in groups:
                row.append(transformed_data[group][i])
            result.append(row)
        
        return result
