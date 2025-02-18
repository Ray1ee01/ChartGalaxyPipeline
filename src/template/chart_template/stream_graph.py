from .area_chart import AreaChartTemplate, AreaChartConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate
from ..mark_template.area import AreaTemplate
from ..color_template import ColorDesign

class StreamGraphTemplate(AreaChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "stream"
        self.sort = None

    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None, config: dict=None):
        # 首先调用父类的create_template
        super().create_template(data, meta_data, color_template, config)
        
        # 配置mark的属性
        self.mark.type = "area"  # 使用area类型
        self.mark.fill_color_style.opacity = 0.8  # 设置填充区域的透明度
        self.mark.interpolate = "monotone"  # 使用平滑的曲线
        self.mark.line = False  # 不显示轮廓线
        self.mark.point = False  # 不显示数据点
        
        # 设置y_encoding，使用symlog堆叠
        self.y_encoding = {
            "field": meta_data['y_label'],
            "type": meta_data['y_type'],
            "stack": "center",  # 使用center堆叠方式
            "axis": {
                "grid": False
            }
        }

class StreamGraphConstraint(AreaChartConstraint):
    """Stream图的布局约束"""
    def validate(self, chart_template: AreaChartTemplate) -> bool:
        return isinstance(chart_template, StreamGraphTemplate)
    
    def apply(self, chart_template: AreaChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.y_axis.orientation = "left" 