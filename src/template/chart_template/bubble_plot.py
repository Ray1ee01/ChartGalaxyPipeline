from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.circle import CircleTemplate
from ..color_template import ColorDesign

class BubblePlotTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "bubble"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field_type = "quantitative"
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        self.y_axis.field_type = "quantitative"
        self.y_axis.field = meta_data['y_label']
        self.mark = CircleTemplate(color_template)
        # self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
        self.color_encoding = None
        
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
            
            print("is str", isinstance(data[0]['x_data'], str))
            if isinstance(data[0]['x_data'], str):
                meta_data['x_type'] = "ordinal"
            else:
                meta_data['x_type'] = "quantitative"
                
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
                
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']
            
    def update_specification(self, specification):
        # specification = super().update_specification(specification)
        specification["encoding"]["size"] = {
            "field": "size",
            "type": "quantitative"
        }
        return specification
        
    
    def dump(self):
        result = {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": None
        }
        
        if self.sort is not None:
            result["sort"] = self.sort
            
        return result

class BubblePlotConstraint(LayoutConstraint):
    """气泡图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, BubblePlotTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        # chart_template.x_axis.field_type = "quantitative"
        chart_template.y_axis.orientation = "left"
        # chart_template.y_axis.field_type = "quantitative"