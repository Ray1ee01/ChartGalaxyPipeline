from .base import ChartTemplate, LayoutConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate
from ..mark_template.area import AreaTemplate
from ..color_template import ColorDesign

class AreaChartTemplate(ChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "area"
        self.sort = None
    
    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field_type = "quantitative"
        self.x_axis.field = meta_data['x_label']

        self.y_axis = self.x_axis.copy()
        self.y_axis.field_type = "quantitative"
        self.y_axis.field = meta_data['y_label']
        
        self.mark = AreaTemplate(color_template)
        
        self.color_encoding = ColorEncodingTemplate(color_template, meta_data, data)

        if meta_data is None:
            # 设置默认值
            self.x_axis.field = "category"
            self.x_axis.field_type = "nominal"
            
            self.y_axis.field = "value"
            self.y_axis.field_type = "quantitative"
        else:
            # 数据类型转换
            if meta_data['x_type'] == "categorical":
                meta_data['x_type'] = "nominal"
            elif meta_data['x_type'] == "numerical":
                meta_data['x_type'] = "quantitative"
            if meta_data['y_type'] == "categorical":
                meta_data['y_type'] = "nominal"
            elif meta_data['y_type'] == "numerical":
                meta_data['y_type'] = "quantitative"
            
            # 智能判断 x 轴类型
            if isinstance(data[0]['x_data'], str):
                meta_data['x_type'] = "ordinal"
            else:
                meta_data['x_type'] = "quantitative"
                
            # 应用配置
            self.x_axis.field = meta_data['x_label']
            self.x_axis.field_type = meta_data['x_type']
                
            self.y_axis.field = meta_data['y_label']
            self.y_axis.field_type = meta_data['y_type']

    def update_specification(self, specification):
        # 添加面积图特有的配置
        specification["mark"] = {
            "type": "area",
            "line": True,  # 是否显示线
            "point": False  # 是否显示数据点
        }
        return specification

class AreaChartConstraint(LayoutConstraint):
    """面积图的布局约束"""
    def validate(self, chart_template: ChartTemplate) -> bool:
        return isinstance(chart_template, AreaChartTemplate)
    
    def apply(self, chart_template: ChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.y_axis.orientation = "left"