from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.line import LineTemplate
from ..color_template import ColorDesign


class BumpChartConstraint(LayoutConstraint):
    """ Bump Chart 的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BumpChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        # chart_template.x_axis.field_type = "quantitative"
        chart_template.y_axis.orientation = "left"
        # chart_template.y_axis.field_type = "quantitative"


class BumpChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bump"
        self.sort = None
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field_type = "quantitative"
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        self.y_axis.field_type = "nominal"
        self.y_axis.field = meta_data['y_label']
        
        self.mark = LineTemplate(color_template)
        
        if len(data[0].keys()) == 2: # single line
            self.color_encoding = None
        else:
            self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
    
    def update_specification(self, specification: dict) -> None:
        specification["encoding"]["order"] = {
            "field": specification["encoding"]["x"]["field"],
            "type": "quantitative"
        }
        specification["mark"]["point"] = True
        return specification
    
    def dump(self):
        result = {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }
        
        if self.sort is not None:
            result["sort"] = self.sort
            
        return result
