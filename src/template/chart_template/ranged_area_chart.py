from .area_chart import AreaChartTemplate, AreaChartConstraint
from ..style_template.base import AxisTemplate, ColorEncodingTemplate
from ..mark_template.area import AreaTemplate
from ..color_template import ColorDesign
import random

class RangedAreaChartTemplate(AreaChartTemplate):
    def __init__(self):
        super().__init__()
        self.chart_type = "rangedarea"
        self.sort = None

    def create_template(self, data: list, meta_data: dict=None, color_template: ColorDesign=None):
        # 首先按group分组，只取第一个group的数据
        groups = {}
        for item in data:
            group = item.get('group', 'default')
            if group not in groups:
                groups[group] = []
            groups[group].append(item)
        
        # 获取第一个group的数据
        first_group = list(groups.values())[0]
        
        # 按x值排序数据，并确保x值是浮点数
        sorted_data = sorted(first_group, key=lambda x: float(x['x_data']))
        data.clear()
        
        # 生成一个固定的随机因子序列，确保相邻点的变化更平滑
        random_factors = []
        base_factor = random.uniform(0.4, 0.6)  # 基准因子
        for _ in range(len(sorted_data)):
            # 在基准因子的基础上添加小的随机变化
            factor = base_factor + random.uniform(-0.1, 0.1)
            factor = max(0.3, min(0.7, factor))  # 限制在0.3-0.7之间
            random_factors.append(factor)
        
        # 处理数据点
        for i, item in enumerate(sorted_data):
            x_val = float(item['x_data'])
            y_val = float(item['y_data'])
            
            data.append({
                'x_data': x_val,
                'y_data': y_val,  # 上边界
                'y2_data': y_val * random_factors[i]  # 下边界
            })

        
        # 配置mark的属性
        self.mark = AreaTemplate(color_template)
        self.mark.type = "area"  # 使用area类型
        self.mark.fill_color_style.opacity = 0.3  # 设置填充区域的透明度
        self.mark.fill_color_style.color = "#4e79a7"  # 设置固定的填充颜色
        self.mark.stroke_color_style.color = "#4e79a7"  # 设置轮廓线颜色
        self.mark.stroke_color_style.opacity = 1  # 设置轮廓线透明度
        self.mark.stroke_style.stroke_width = 2  # 设置轮廓线宽度
        self.mark.interpolate = "monotone"  # 使用平滑的曲线
        self.mark.line = True  # 显示轮廓线
        self.mark.point = False  # 不显示数据点
        
        # 设置坐标轴
        self.x_axis = AxisTemplate(color_template)
        self.x_axis.field = meta_data['x_label']
        self.x_axis.field_type = "quantitative"
        self.x_axis.orientation = "bottom"
        
        self.y_axis = AxisTemplate(color_template)
        self.y_axis.field = meta_data['y_label']
        self.y_axis.field_type = "quantitative"
        self.y_axis.orientation = "left"
        
        # 设置y_encoding（上边界）
        self.y_encoding = {
            "field": meta_data['y_label'],
            "type": "quantitative",
            "scale": {"zero": False},  # 确保y轴不从0开始
            "axis": {
                "grid": False
            }
        }
        
        # 设置y2_encoding（下边界）
        self.y2_encoding = {
            "field": "y2_data",
            "type": "quantitative"
        }
        
        # 移除颜色编码
        self.color_encoding = None


class RangedAreaChartConstraint(AreaChartConstraint):
    """范围区域图的布局约束"""
    def validate(self, chart_template: AreaChartTemplate) -> bool:
        return isinstance(chart_template, RangedAreaChartTemplate)
    
    def apply(self, chart_template: AreaChartTemplate) -> None:
        if not self.validate(chart_template):
            raise ValueError("不兼容的图表类型")
        chart_template.mark.orientation = "vertical"
        chart_template.x_axis.orientation = "bottom"
        chart_template.y_axis.orientation = "left" 