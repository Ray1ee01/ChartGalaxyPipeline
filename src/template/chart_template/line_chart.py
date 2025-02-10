from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..mark_template.line import LineTemplate
from ..color_template import ColorDesign
from ..style_template.base import PolarSetting, AngleAxisTemplate, RadiusAxisTemplate
import pandas as pd

class LineChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "line"
        self.sort = None
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field_type = "quantitative"
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        self.y_axis.field_type = "quantitative"
        self.y_axis.field = meta_data['y_label']
        
        self.mark = LineTemplate(color_template)
        
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)

        # if meta_data is None:
        #     # set default value
        #     self.x_axis.field = "category"
        #     self.x_axis.field_type = "nominal"
            
        #     self.y_axis.field = "value"
        #     self.y_axis.field_type = "quantitative"
        # else:
        #     if meta_data['x_type'] == "categorical":
        #         meta_data['x_type'] = "nominal"
        #     elif meta_data['x_type'] == "numerical":
        #         meta_data['x_type'] = "quantitative"
        #     if meta_data['y_type'] == "categorical":
        #         meta_data['y_type'] = "nominal"
        #     elif meta_data['y_type'] == "numerical":
        #         meta_data['y_type'] = "quantitative"
                
        #     self.x_axis.field = meta_data['x_label']
        #     self.x_axis.field_type = meta_data['x_type']
            
        #     self.y_axis.field = meta_data['y_label']
        #     self.y_axis.field_type = meta_data['y_type']
    
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



class LineChartConstraint(LayoutConstraint):
    """折线图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, LineChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        # chart_template.x_axis.field_type = "quantitative"
        chart_template.y_axis.orientation = "left"
        # chart_template.y_axis.field_type = "quantitative"


class LineChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "line"
        self.sort = None
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field_type = "quantitative"
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        self.y_axis.field_type = "quantitative"
        self.y_axis.field = meta_data['y_label']
        self.mark = LineTemplate(color_template)
        
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
            
            print("is str", isinstance(data[0]['x_data'], str))
            if isinstance(data[0]['x_data'], str):
                meta_data['x_type'] = "ordinal"
            else:
                meta_data['x_type'] = "quantitative"
                
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
                
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']
    
    def update_specification(self, specification: dict) -> None:
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
        
class RadarTemplate(LineChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "radar"
        
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        super().create_template(data, meta_data, color_template)
        self.x_axis = AngleAxisTemplate(color_template)
        self.y_axis = RadiusAxisTemplate(color_template)
        
    def update_specification(self, specification: dict) -> None:
        # super().update_specification(specification)
        raise NotImplementedError("RadarChartTemplate is not implemented")
    
    def update_option(self, echart_option: dict) -> None:
        self.echart_option = echart_option
        data = echart_option["dataset"]["source"]
        df = pd.DataFrame(data[1:], columns=data[0])

        x_data = self.x_axis.field or "x_data"
        y_data = self.y_axis.field or "y_data"
        group = "group"

        max_value = df[y_data].max()
        color_encoding = self.color_encoding.dump()
        self.echart_option["colorBy"] = "series"
        self.echart_option["color"] = color_encoding["range"]
        
        self.echart_option["radar"] = {
            "indicator": [
                {
                    "name": name,
                    "max": max_value,
                } for name in df[x_data].unique().tolist()
            ],
            "radius": "75%",
            "startAngle": 90,
            "shape": "polygon",
        }
        
        self.echart_option["textStyle"] = {
            "fontFamily": self.mark.annotation_font_style.font,
            "fontSize": self.mark.annotation_font_style.font_size,
            "fontWeight": self.mark.annotation_font_style.font_weight,
        }

        self.echart_option["series"][0]["type"] = "radar"
        self.echart_option["series"][0]["coordinateSystem"] = "radar"
        self.echart_option["series"][0]["lineStyle"] = {
            "width": 2,
            "type": "solid",
            "join": "round",
        }
        self.echart_option["series"][0]["label"] = {
            "show": False,
            "position": "top",
        }
        self.echart_option["series"][0]["data"] = [
            {
                "value": df[df[group] == name][y_data].tolist(),
                "name": name,
            } for name in color_encoding["domain"]
        ]
        
        return self.echart_option