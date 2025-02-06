from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.line import LineTemplate
from ..color_template import ColorDesign
from .line_chart import LineChartTemplate

class ConnectedScatterPlotTemplate(LineChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "connected_scatterplot"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field_type = "quantitative"
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        self.y_axis.field_type = "quantitative"
        self.y_axis.field = meta_data['y_label']
        self.mark = LineTemplate(color_template)
        self.mark.point = True
        self.color_encoding = None
    
    def update_specification(self, specification):
        # specification = super().update_specification(specification)
        specification["mark"]["point"] = True
        specification["encoding"]["order"] = {
            "field": "order",
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
