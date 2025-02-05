from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.bar import BarTemplate
from ..color_template import ColorDesign

class BarChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bar"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.y_axis = self.x_axis.copy()
        
        
        self.mark = BarTemplate(color_template)
        
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
        

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
        # 这里是bar chart相关的配置，通用配置放在chart generator中    
        """更新规范"""
        encoding = specification["encoding"]
        mark_specification = specification["mark"]
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