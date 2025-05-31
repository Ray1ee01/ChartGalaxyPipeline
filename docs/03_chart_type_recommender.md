# 图表类型推荐模块 (chart_type_recommender)

图表类型推荐模块（`chart_type_recommender`）是 ChartPipeline 框架的第一个处理环节，负责分析输入数据的特征并推荐最合适的图表类型。

## 功能简介

本模块通过分析数据集的结构特征（如数据类型、维度、分布等），推荐多种潜在的可视化图表类型，并按置信度排序。每个推荐都附带理由说明，帮助用户理解为何该图表类型适合其数据。

## 输入与输出

### 输入

模块接收标准的输入数据格式，重点关注以下字段：

- `data.columns`: 列定义，包含各列的数据类型和角色
- `data.data`: 实际数据记录

### 输出

模块向输入数据添加 `chart_type` 字段，结构如下：

```json
{
  "chart_type": [
    {
      "type": "vertical_stacked_bar_chart",
      "confidence": 0.92,
      "reasoning": "选择堆叠柱状图是因为需要比较不同时间段内两种状态的分布情况，同时展示总量变化趋势"
    },
    {
      "type": "grouped_bar_chart",
      "confidence": 0.75,
      "reasoning": "分组柱状图适合清晰对比不同时期内各状态的具体数值"
    },
    {
      "type": "area_chart",
      "confidence": 0.68,
      "reasoning": "面积图能够体现紧急状态总量随时间的变化趋势"
    }
  ]
}
```

每个推荐包含以下字段：

| 字段 | 类型 | 描述 |
|------|------|------|
| `type` | 字符串 | 推荐的图表类型 |
| `confidence` | 浮点数 | 推荐的置信度（0-1） |
| `reasoning` | 字符串 | 推荐理由说明 |

## 支持的图表类型

模块目前支持以下图表类型：

- **柱状图系列**：
  - `vertical_bar_chart`: 垂直柱状图
  - `horizontal_bar_chart`: 水平柱状图
  - `vertical_stacked_bar_chart`: 垂直堆叠柱状图
  - `horizontal_stacked_bar_chart`: 水平堆叠柱状图
  - `grouped_bar_chart`: 分组柱状图

- **线图系列**：
  - `line_chart`: 折线图
  - `area_chart`: 面积图

- **饼图系列**：
  - `pie_chart`: 饼图
  - `donut_chart`: 环形图

- **其他图表**：
  - `scatter_plot`: 散点图
  - `bubble_chart`: 气泡图
  - `heatmap`: 热图

## 推荐算法

模块使用基于规则的推荐算法，主要考虑以下因素：

1. **数据类型匹配**：根据列的数据类型（时间、数值、分类）确定适合的图表
2. **数据维度分析**：根据数据的维度数量和结构推荐合适的表现形式
3. **数据规模考量**：考虑数据点数量，避免过于密集的可视化
4. **叙事目标匹配**：考虑不同图表类型对应的叙事目标（比较、分布、关系等）

## 使用示例

### 命令行调用

```bash
python -m modules.chart_type_recommender.chart_type_recommender --input input_data.json --output output_data.json
```

### 程序调用

```python
from modules.chart_type_recommender.chart_type_recommender import process

success = process(input='input_data.json', output='output_data.json')
if success:
    print("图表类型推荐完成")
else:
    print("图表类型推荐失败")
```

## 扩展指南

如需添加新的图表类型支持或修改推荐算法，可以：

1. 在 `CHART_TYPES` 常量中添加新的图表类型
2. 在 `recommend_chart_types` 函数中添加对应的推荐逻辑
3. 根据需要调整置信度计算方法

## 常见问题

**Q: 如何处理多变量数据集？**  
A: 对于多变量数据集，模块会考虑变量间的关系，优先推荐能展示多个维度的图表类型，如散点图或气泡图。

**Q: 置信度如何计算？**  
A: 置信度基于数据特征与图表类型的匹配程度，考虑多个因素加权计算而得。 