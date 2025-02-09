from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ShapeEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.point import PointTemplate
from ..color_template import ColorDesign

class ScatterPlotTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "scatterplot"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        # self.x_axis.field_type = "quantitative"
        self.x_axis.field_type = None
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        # self.y_axis.field_type = "quantitative"
        self.y_axis.field_type = None
        self.y_axis.field = meta_data['y_label']
        
        self.mark = PointTemplate(color_template)
        
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)
        self.shape_encoding = ShapeEncodingTemplate(meta_data, data)
        
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
            
            if isinstance(data[0]['x_data'], str):
                meta_data['x_type'] = "temporal"
            else:
                meta_data['x_type'] = "quantitative"
                
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
                
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']
    
    
    def update_specification(self, specification: dict) -> None:
        if hasattr(self, 'shape_encoding') and self.shape_encoding:
            shape_encoding = {
                "field": self.shape_encoding.field,
                "type": self.shape_encoding.field_type,
                "scale": {
                    "domain": self.shape_encoding.domain,
                    "range": self.shape_encoding.range
                }
            }
            specification["encoding"]["shape"] = shape_encoding
        return specification
    
    def dump(self):
        result = {
            "x_axis": self.x_axis.dump(),
            "y_axis": self.y_axis.dump(),
            "mark": self.mark.dump(),
            "color_encoding": self.color_encoding.dump()
        }
        if self.shape_encoding is not None:
            result["shape_encoding"] = self.shape_encoding.dump()
        # 添加排序配置到输出
        if self.sort is not None:
            result["sort"] = self.sort
            
        return result
    
class ScatterPlotConstraint(LayoutConstraint):
    """散点图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, ScatterPlotTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.x_axis.field_type = "quantitative"
        chart_template.y_axis.orientation = "left"
        chart_template.y_axis.field_type = "quantitative"
