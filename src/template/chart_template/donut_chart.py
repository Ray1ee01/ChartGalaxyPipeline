from typing import Optional, Dict, Any
from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate, ColorTemplate, StrokeTemplate
from ..color_template import ColorDesign
from ..mark_template.pie import PieTemplate

class DonutChartTemplate(ChartTemplate):
    def __init__(self, color_template: ColorDesign = None):
        super().__init__(color_template)
        self.chart_type = "donut"
        self.theta: Optional[Dict[str, Any]] = None
        self.color: Optional[Dict[str, Any]] = None
        self.x_axis: Optional[AxisTemplate] = None # 占位
        self.y_axis: Optional[AxisTemplate] = None # 占位
        self.color_encoding: Optional[ColorEncodingTemplate] = None

    def create_template(self, data: list, meta_data: dict, color_template: ColorDesign = None):
        """
        创建甜甜圈图模板的核心方法
        """
        # 验证必要的字段
        value_field = meta_data.get('y_label')
        category_field = meta_data.get('x_label')
        
        if not value_field or not category_field:
            raise ValueError("Both value_field and category_field are required for pie chart")

        # 设置theta编码
        self.theta={
            "field": value_field,
            "type": "quantitative"
        }

        # 设置color编码
        self.color={
            "field": category_field,
            "type": "nominal"
        }

        self.mark = PieTemplate(color_template)
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)


    def dump(self):
        return {
            "mark": self.mark.dump(),
            "theta": self.theta,
            "color": self.color
        }
