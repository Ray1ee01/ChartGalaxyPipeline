# 图表类型指南

本文档提供了系统支持的各种图表类型的全面概述。通过这份指南，数据分析人员和设计师可以了解每种图表的适用场景、数据要求和最佳用途，从而为特定数据和分析目标选择最合适的可视化方式。

无论您是需要展示时间trend、comparison不同类别、显示relationship、展示composition还是分析distribution，本指南都将帮助您做出明智的图表选择决策。每种图表类型都附有详细说明，包括其数据要求、最佳使用场景和适合的分析类型。

## 如何使用本指南

1. 浏览[图表类型概览](#图表类型概览)表格，根据您的分析目的快速找到适合的图表类型
2. 查看[图表格式概览](#图表格式概览)了解图表的基本分类
3. 深入阅读特定图表类型的详细描述
4. 参考[数据类型说明](#数据类型说明)和[分析类型说明](#分析类型说明)了解术语含义
5. 使用[选择合适的图表](#选择合适的图表)部分的指导原则做出最终决定
6. 具体例子可以参考[Data Visualization Project](https://datavizproject.com/)

## 目录

- [图表类型概览](#图表类型概览)
- [图表格式概览](#图表格式概览)
- [基础图表 (x+y)](#基础图表-xy)
- [分组图表 (x+y+group)](#分组图表-xygroup)
- [范围图表 (x+y1+y2)](#范围图表-xy1y2)
- [排序图表 (x+y+order)](#排序图表-xyorder)
- [三维图表 (x+y+size)](#三维图表-xysize)
- [数据类型说明](#数据类型说明)
- [分析类型说明](#分析类型说明)

## 图表类型概览

下表提供了根据不同分析目的选择图表类型的快速指南：

| 分析目的 | 适合的图表类型 |
|---------|-------------|
| **trend分析** | 线图、样条图、面积图、多线图、多样条图、多面积图、堆叠面积图、流图、斜率图 |
| **comparison分析** | 垂直柱状图、水平柱状图、三角柱状图、图像柱状图、点状图、比例圆/方形/图标面积图、图像单位图、垂直/水平分组/堆叠柱状图、蝴蝶图、凸点图 |
| **relationship分析** | 散点图、层叠面积图、气泡图 |
| **composition分析** | 饼图、环形图、半环形图、堆叠面积图、流图、垂直/水平堆叠柱状图、图像堆叠图、多饼图、多环形图、多半环形图、跨度图 |
| **distribution分析** | 直方图、范围面积图、柱形范围图 |

## 图表格式概览

如果你的chart属于多个chart的复合类型，例如Grouped Bar Chart + Proportional Circle Chart，那么数据要求需要写成对应的：
  ```json
  {
    "require_fields": [
      ["x", "y", "group"],
      ["x", "y"]
    ],
    "require_field_types": [
      [["categorical"], ["numerical"],["categorical"]],
      [["categorical"], ["numerical"]],
    ]
  }
  ```


我们的图表系统根据数据维度和结构将图表分为以下几种主要格式（如果有遗漏可以增加）：

| 格式 | 描述 | 适用场景 |
|------|------|----------|
| x+y | 基础图表，在标准坐标系中显示一个变量对另一个变量 | 可视化直接relationship、comparison不同类别的值、显示trend或distribution |
| x+y+group | 显示多组数据或按类别分组的值 | comparison不同类别或组随时间变化的trend、模式或composition |
| x+y1+y2 | 可视化范围、区间或成对comparison值的图表 | 显示数据范围、不确定性、可变性或成对指标的直接comparison |
| x+y+order | 显示跨类别或时间的顺序、排名或位置变化的图表 | 跟踪相对位置或排名变化而非绝对值 |
| x+y+size | 使用位置和大小维度表示三个变量的图表 | 显示三个变量之间的relationship，其中两个定义位置，一个定义大小 |

## 基础图表 (x+y)

基础图表在标准坐标系中显示一个变量对另一个变量，适用于可视化直接relationship、comparison不同类别的值、显示trend或distribution。

### 线图 (Line Graph)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["numerical", "temporal"], ["numerical"]]
  }
  ```
- **最适用于**：可视化连续数据随时间的变化，显示trend，突出数据的模式
- **分析类型**：trend

### 样条图 (Spline Graph)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["numerical", "temporal"], ["numerical"]]
  }
  ```
- **最适用于**：通过曲线显示平滑连续trend，为数据进展提供更流畅的可视化
- **分析类型**：trend

### 面积图 (Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["numerical", "temporal"], ["numerical"]]
  }
  ```
- **最适用于**：强调随时间变化的幅度，同时突出trend线下的区域
- **分析类型**：trend

### 垂直柱状图 (Vertical Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical", "temporal"], ["numerical"]]
  }
  ```
- **最适用于**：通过明确区分各个值，comparison离散类别的大小
- **分析类型**：comparison

### 水平柱状图 (Horizontal Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：comparison带有长标签或众多类别的值，提高可读性
- **分析类型**：comparison

### 三角柱状图 (Triangle Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：为标准柱状comparison增加视觉趣味，同时保持comparison大小的能力
- **分析类型**：comparison

### 图像柱状图 (Pictorial Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：通过使用主题形状或图标代替标准柱状图增强吸引力，同时保持数据准确性
- **分析类型**：comparison

### 点状图 (Dot Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：使用点而非柱状创建简洁清晰的类别值显示，减少视觉噪音
- **分析类型**：comparison

### 散点图 (Scatter Plot)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["numerical", "temporal"], ["numerical"]]
  }
  ```
- **最适用于**：检查两个连续变量之间的相关性，识别模式、聚类或异常值
- **分析类型**：relationship

### 饼图 (Pie Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：显示相对较少类别（理想情况≤7）的部分对整体relationship，强调比例
- **分析类型**：composition

### 环形图 (Donut Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：显示部分对整体relationship，同时在中心提供额外信息的空间
- **分析类型**：composition

### 半环形图 (Semi Circle Donut Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：以空间高效的格式显示比例composition，同时保持部分对整体relationship
- **分析类型**：composition

### 比例圆面积图 (Proportional Circle Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：使用圆形面积跨类别comparison数量，创建基于大小的直观comparison
- **分析类型**：comparison

### 比例方形面积图 (Proportional Square Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：使用正方形面积comparison数量，比圆形提供更准确的面积感知
- **分析类型**：comparison

### 比例图标面积图 (Proportional Icon Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：使用按比例调整大小的主题图标表示数量，为comparison添加上下文意义
- **分析类型**：comparison

### 图像单位图 (Pictorial Unit Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["categorical"], ["numerical"]]
  }
  ```
- **最适用于**：用重复图标表示离散数量，每个图标代表特定单位计数
- **分析类型**：comparison

### 直方图 (Histogram)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y"],
    "require_field_types": [["numerical"], ["numerical"]]
  }
  ```
- **最适用于**：通过显示定义区间内的频率，可视化连续变量的distribution
- **分析类型**：distribution

## 分组图表 (x+y+group)

分组图表显示多组数据或按类别分组的值，适用于comparison不同类别或组随时间变化的trend、模式或composition。

### 多线图 (Multiple Line Graph)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：comparison多个类别随时间的trend，突出收敛、发散或相似模式
- **分析类型**：trend、comparison

### 多样条图 (Multiple Spline Graph)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：通过曲线comparison多个系列的平滑trend，强调连续性和流动性
- **分析类型**：trend、comparison

### 多面积图 (Multiple Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：comparison多个系列的大小，同时强调每条trend线下的区域
- **分析类型**：trend、comparison

### 层叠面积图 (Layered Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：显示多个重叠系列，透明度有助于可视化单独和组合trend
- **分析类型**：trend、relationship

### 堆叠面积图 (Stacked Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：展示部分如何随时间composition整体，同时保持查看总值的能力
- **分析类型**：trend、composition

### 流图 (Stream Graph)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：用流动、有机的形状显示随时间变化的composition，强调相对贡献
- **分析类型**：composition、trend

### 垂直分组柱状图 (Vertical Grouped Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：同时comparison类别和子类别的值，便于组内和组间comparison
- **分析类型**：comparison

### 水平分组柱状图 (Horizontal Grouped Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：comparison带有长标签的类别中的分组值，提供比垂直排列更好的可读性
- **分析类型**：comparison

### 垂直堆叠柱状图 (Vertical Stacked Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：以垂直格式同时显示总值和这些值的composition
- **分析类型**：comparison、composition

### 水平堆叠柱状图 (Horizontal Stacked Bar Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：显示带有长标签的类别内的composition，水平强调部分对整体relationship
- **分析类型**：comparison、composition

### 图像堆叠图 (Pictorial Stacked Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：结合主题形状和堆叠数据，创建更吸引人的composition数据可视化
- **分析类型**：composition、comparison

### 多饼图 (Multiple Pie Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：comparison不同组的composition数据，识别distribution模式的差异
- **分析类型**：composition、comparison

### 多环形图 (Multiple Donut Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：comparison各组的composition数据，每个中心留有额外信息空间
- **分析类型**：composition、comparison

### 多半环形图 (Multiple Semi Circle Donut Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["categorical"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：以空间高效的格式comparison各组的部分对整体relationship
- **分析类型**：composition、comparison

### 斜率图 (Slope Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：comparison多个类别在恰好两个时间点之间的变化，强调变化方向和大小
- **分析类型**：comparison、trend

## 范围图表 (x+y1+y2)

范围图表可视化范围、区间或成对comparison值，适用于显示数据范围、不确定性、可变性或成对指标的直接comparison。

### 范围面积图 (Range Area Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y1", "y2"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["numerical"]]
  }
  ```
- **最适用于**：显示连续轴上上下界之间的区域，可视化数据不确定性或可变性
- **分析类型**：distribution

### 柱形范围图 (Column Range)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y1", "y2"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["numerical"]]
  }
  ```
- **最适用于**：以垂直柱状显示跨类别的最小值和最大值，适合显示数据范围或变化
- **分析类型**：distribution

### 蝴蝶图 (Butterfly Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y1", "y2"],
    "require_field_types": [["categorical"], ["numerical"], ["numerical"]]
  }
  ```
- **最适用于**：comparison相同类别的两组值（如男性与女性、前后对比），突出差异
- **分析类型**：comparison

### 跨度图 (Span Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y1", "y2"],
    "require_field_types": [["categorical"], ["numerical", "temporal"], ["numerical", "temporal"]]
  }
  ```
- **最适用于**：可视化持续时间、周期或区间（如项目时间线），显示跨类别的起始和结束点
- **分析类型**：composition、trend

## 排序图表 (x+y+order)

排序图表显示跨类别或时间的顺序、排名或位置变化，适用于跟踪相对位置或排名变化而非绝对值。

### 凸点图 (Bump Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "group"],
    "require_field_types": [["temporal"], ["numerical"], ["categorical"]]
  }
  ```
- **最适用于**：可视化随时间的排名位置变化，关注相对地位而非值
- **分析类型**：comparison、trend

## 三维图表 (x+y+size)

三维图表使用位置和大小维度表示三个变量，适用于显示三个变量之间的relationship，其中两个定义位置，一个定义大小。

### 气泡图 (Bubble Chart)

- **数据要求**：
  ```json
  {
    "require_fields": ["x", "y", "size"],
    "require_field_types": [["numerical", "temporal"], ["numerical"], ["numerical"]]
  }
  ```
- **最适用于**：可视化三个数值变量之间的relationship，位置指示两个维度，大小表示第三个维度
- **分析类型**：relationship

## 数据类型说明

数据类型描述了图表中使用的数据的性质和特征：

- **数值型 (numerical)**：可以测量和comparison大小的数值数据（如温度、收入、人数）
- **时间型 (temporal)**：与时间相关的数据（如日期、时间戳、年份）
- **类别型 (categorical)**：用于分类或区分数据点的类别变量（如产品类别、地区）

## 分析类型说明

分析类型描述了图表最适合展示的数据洞察类型：

- **trend**：数据随时间的变化模式
- **comparison**：不同类别或组之间的数值差异
- **relationship**：变量之间的相关性或联系
- **composition**：整体的组成部分及其相对比例
- **distribution**：数据点在范围内的分散程度和频率

## 选择合适的图表

选择合适的图表对于有效传达数据洞察至关重要。以下是选择图表时的一些指导原则：

1. **明确分析目的**：首先确定您想要展示的是trend、comparison、relationship、composition还是distribution。
   
2. **考虑数据类型**：检查您的数据是数值型、时间型还是类别型，这将限制适合的图表选择。
   
3. **观众因素**：考虑您的受众对数据可视化的熟悉程度，某些图表（如散点图）可能需要更多解释，而其他图表（如柱状图）则更为直观。
   
4. **数据复杂度**：
   - 对于简单comparison，使用柱状图、点状图或线图
   - 对于多变量数据，考虑气泡图或多线图
   - 对于部分对整体relationship，使用饼图、环形图或堆叠图
   - 对于时间trend，优先选择线图、面积图或堆叠面积图
   
5. **避免常见错误**：
   - 避免在饼图中使用太多类别（理想情况下≤7）
   - 避免截断数值轴，这可能导致误导性的comparison
   - 确保使用适当的比例和标签使图表清晰易懂
   
6. **尝试替代方案**：如果标准图表无法有效传达信息，可尝试创新的替代方案，如图像柱状图或流图等。

通过遵循这些指导原则并参考本文档中的图表类型详情，您可以为数据选择最有效的可视化方式，使您的见解清晰、准确地传达给目标受众。 